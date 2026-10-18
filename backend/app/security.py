"""Password migration and server-side API authorization."""
import hashlib
import hmac
from bson import ObjectId
from pymongo.errors import PyMongoError
from flask import current_app, request, jsonify, g
from datetime import datetime, timedelta
import secrets
from .identity import find_user
from werkzeug.security import generate_password_hash, check_password_hash


def hash_password(password):
    return generate_password_hash(password)


def verify_password(stored, password):
    if not isinstance(stored, str) or not isinstance(password, str) or not password:
        return False
    if stored.startswith(('scrypt:', 'pbkdf2:')):
        return check_password_hash(stored, password)
    # Migrate both historical plaintext accounts and admin-created SHA256 accounts.
    return hmac.compare_digest(stored.encode(), password.encode()) or hmac.compare_digest(stored.encode(), hashlib.sha256(password.encode()).hexdigest().encode())


COOKIE_NAME = 'oms_session'

JSON_REQUEST_METHODS = {
    'auth.login': {'POST'}, 'auth.register': {'POST'}, 'auth.check_email': {'POST'},
    'auth.check_username': {'POST'}, 'auth.request_password_reset': {'POST'}, 'auth.forgot_password': {'POST'},
    'admin.create_user': {'POST'}, 'admin.update_user': {'PUT'}, 'admin.create_discount': {'POST'},
    'admin.get_order_details': {'PUT'}, 'orders.orders': {'POST'}, 'orders.order_detail': {'PUT'},
    'orders.calculate_shipping': {'POST'}, 'orders.confirm_order_receipt': {'PUT'},
    'users.user_profile': {'PUT'}, 'users.user_addresses': {'PUT'},
    'users.workspace_preferences': {'PUT'},
    'checkout.checkout': {'PUT', 'PATCH'}, 'checkout.quote': {'POST'},
    'cart.add_to_cart': {'POST'}, 'cart.update_cart_item': {'PUT'}, 'cart.remove_from_cart': {'DELETE'},
    'products.check_product_stock': {'POST'}, 'products.update_product_stock': {'PUT'},
    'access.roles': {'POST'}, 'access.role_detail': {'PUT'}, 'access.account_options': {'PUT'},
    'access.product_catalog_options': {'PUT'},
    'notifications.read': {'PATCH'}, 'notifications.read_all': {'POST'},
    'policies.publish': {'PUT'},
    'content.update': {'PUT'},
}



def protect_auth_requests():
    """Origin checks also protect public sign-in and recovery mutations."""
    if request.method in ('GET', 'HEAD', 'OPTIONS'):
        return None
    origin = request.headers.get('Origin')
    allowed = {request.host_url.rstrip('/'), *current_app.config.get('CORS_ORIGINS', [])}
    if (origin and origin not in allowed) or (not origin and request.headers.get('Sec-Fetch-Site') == 'cross-site'):
        return jsonify(success=False, error='This request origin is not allowed.'), 403
    if request.endpoint and request.endpoint.startswith('auth.'):
        if request.content_length and request.content_length > 16 * 1024:
            return jsonify(success=False, error='Authentication requests must be smaller than 16 KB.'), 413
    from .rate_limits import limit_auth_account
    return limit_auth_account()


def password_version(user):
    return hashlib.sha256(user.get('password', '').encode()).hexdigest()


def issue_session(user):
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(32)
    current_app.db.sessions.insert_one({
        '_id': hashlib.sha256(token.encode()).hexdigest(), 'userId': user['_id'],
        'passwordVersion': password_version(user), 'csrfToken': csrf,
        'createdAt': datetime.utcnow(), 'expiresAt': datetime.utcnow() + timedelta(days=1),
    })
    return token, csrf


def set_session_cookie(response, token):
    response.set_cookie(COOKIE_NAME, token, max_age=86400, httponly=True,
                        secure=current_app.config.get('SESSION_COOKIE_SECURE', False),
                        samesite='Lax', path='/')
    return response


def authenticate_session():
    token = request.cookies.get(COOKIE_NAME, '')
    if not token or len(token) > 128:
        return None
    session = current_app.db.sessions.find_one({
        '_id': hashlib.sha256(token.encode()).hexdigest(), 'expiresAt': {'$gt': datetime.utcnow()},
    })
    if not session:
        return None
    user = current_app.db.users.find_one({'_id': session['userId']}, {
        'password': 1, 'isActive': 1, 'isAdmin': 1, 'roleId': 1, 'username': 1, 'user_id': 1,
    })
    if not user or not user.get('isActive', True) or not hmac.compare_digest(password_version(user), session.get('passwordVersion', '')):
        return None
    g.session = session
    from .access import access_fields
    user = {**user, **access_fields(user)}
    g.user = user
    return user


def authorize_request():
    path = request.path.rstrip('/')
    if request.method == 'OPTIONS' or not path.startswith('/api/'):
        return None
    if request.url_rule is None:
        return None
    if request.method in JSON_REQUEST_METHODS.get(request.endpoint, set()) and not request.is_json:
        return jsonify(success=False, error='Send this request as a JSON object with Content-Type: application/json.'), 415
    if request.is_json and not isinstance(request.get_json(silent=True), dict):
        return jsonify(success=False, error='A JSON object is required'), 400
    args = request.view_args or {}
    for key in ('pid', 'product_id', 'order_id', 'discount_id', 'customer_id'):
        if key in args and not ObjectId.is_valid(args[key]):
            return jsonify(success=False, error=f'Invalid {key.replace("_", " ")}'), 400
    if path.startswith('/api/admin/users/') and not ObjectId.is_valid(args.get('user_id')):
        return jsonify(success=False, error='Invalid user ID'), 400
    public_endpoints = {
        'auth.login', 'auth.register', 'auth.check_email', 'auth.check_username',
        'auth.captcha', 'policies.published', 'content.published',
        'auth.request_password_reset', 'auth.forgot_password', 'health_check',
        'orders.calculate_shipping', 'products.get_products', 'products.get_product',
        'products.uploaded_file', 'products.check_product_stock', 'settings.public_payments',
    }
    if request.endpoint in public_endpoints:
        return None
    try:
        user = authenticate_session()
    except PyMongoError:
        return jsonify(success=False, error='The database is temporarily unavailable. Please try again shortly.'), 503
    if not user:
        return jsonify(success=False, error='Your session has expired. Please log in again.'), 401
    from .rate_limits import limit_user_requests
    blocked = limit_user_requests()
    if blocked is not None:
        return blocked
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        supplied = request.headers.get('X-CSRF-Token', '')
        if not supplied or not hmac.compare_digest(supplied, g.session['csrfToken']):
            return jsonify(success=False, error='Your session could not be verified. Refresh and try again.'), 403
    if path in ('/api/auth/session', '/api/auth/logout', '/api/checkout', '/api/checkout/quote'):
        return None
    if request.endpoint and request.endpoint.startswith(('notifications.', 'favorites.')):
        return None
    aliases = {value for value in (str(user['_id']), user.get('username'), user.get('user_id')) if value}
    args = request.view_args or {}
    if path.startswith('/api/cart/') or path.startswith('/api/users/profile/') or path.startswith('/api/orders/user/'):
        target = args.get('user_id')
        if target:
            if str(target) in aliases or user.get('isAdmin'):
                owner = find_user(current_app.db, target, {'_id': 1})
                if not owner:
                    return jsonify(success=False, error='User not found'), 404
                args['user_id'] = owner['_id']
                return None
            return jsonify(success=False, error='Access denied'), 403
    if path.startswith('/api/orders/') and args.get('order_id'):
        if request.method == 'GET' or path.endswith('/confirm-receipt'):
            order_id = args['order_id']
            if not ObjectId.is_valid(order_id):
                return jsonify(success=False, error='Invalid order ID'), 400
            order = current_app.db.orders.find_one({'_id': ObjectId(order_id)})
            if order and (str(order.get('userId')) in aliases or user.get('isAdmin')):
                g.owner_id = order['userId']
                if request.is_json:
                    request.get_json()['userId'] = order['userId']
                return None
            return jsonify(success=False, error='Order not found'), 404
    if (path.rstrip('/') == '/api/orders' and request.method == 'POST') or path in ('/api/orders/upload-payment-proof', '/api/cart/add', '/api/cart/sync', '/api/cart/clear'):
        data = request.form if request.form else request.get_json(silent=True) or {}
        supplied = data.get('userId')
        if isinstance(supplied, str) and (supplied in aliases or user.get('isAdmin')):
            owner = find_user(current_app.db, supplied, {'_id': 1})
            if not owner:
                return jsonify(success=False, error='User not found'), 404
            g.owner_id = owner['_id']
            if request.is_json:
                data['userId'] = owner['_id']
            return None
        return jsonify(success=False, error='Access denied'), 403
    if user.get('isAdmin'):
        return None
    return jsonify(success=False, error='Administrator access required'), 403
