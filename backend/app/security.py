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
    if not token:
        return None
    session = current_app.db.sessions.find_one({
        '_id': hashlib.sha256(token.encode()).hexdigest(), 'expiresAt': {'$gt': datetime.utcnow()},
    })
    if not session:
        return None
    user = current_app.db.users.find_one({'_id': session['userId']})
    if not user or not user.get('isActive', True) or not hmac.compare_digest(password_version(user), session.get('passwordVersion', '')):
        return None
    g.session = session
    g.user = user
    return user


def authorize_request():
    path = request.path
    if request.method == 'OPTIONS' or not path.startswith('/api/'):
        return None
    if request.url_rule is None:
        return None
    if request.is_json and not isinstance(request.get_json(silent=True), dict):
        return jsonify(success=False, error='A JSON object is required'), 400
    args = request.view_args or {}
    for key in ('pid', 'product_id', 'order_id', 'discount_id', 'customer_id'):
        if key in args and not ObjectId.is_valid(args[key]):
            return jsonify(success=False, error=f'Invalid {key.replace("_", " ")}'), 400
    if path.startswith('/api/admin/users/') and not ObjectId.is_valid(args.get('user_id')):
        return jsonify(success=False, error='Invalid user ID'), 400
    if (path.startswith('/api/auth/') and path not in ('/api/auth/session', '/api/auth/logout')) or path in ('/api/health', '/api/orders/calculate-shipping'):
        return None
    if path.startswith('/api/products') and request.method == 'GET':
        return None
    if path == '/api/payments' and request.method == 'GET':
        return None
    if path.startswith('/api/products/check-stock/') and request.method == 'POST':
        return None
    try:
        user = authenticate_session()
    except PyMongoError:
        return jsonify(success=False, error='The database is temporarily unavailable. Please try again shortly.'), 503
    if not user:
        return jsonify(success=False, error='Your session has expired. Please log in again.'), 401
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        supplied = request.headers.get('X-CSRF-Token', '')
        if not supplied or not hmac.compare_digest(supplied, g.session['csrfToken']):
            return jsonify(success=False, error='Your session could not be verified. Refresh and try again.'), 403
    if path in ('/api/auth/session', '/api/auth/logout', '/api/checkout', '/api/checkout/quote'):
        return None
    aliases = {value for value in (str(user['_id']), user.get('username'), user.get('user_id')) if value}
    args = request.view_args or {}
    if path.startswith('/api/cart/') or path.startswith('/api/users/profile/') or path.startswith('/api/orders/user/'):
        target = args.get('user_id')
        if target:
            if str(target) in aliases or user.get('isAdmin'):
                owner = find_user(current_app.db, target)
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
            owner = find_user(current_app.db, supplied)
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
