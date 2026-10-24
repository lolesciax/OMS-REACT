from flask import Flask, jsonify, request, g
from flask_cors import CORS
from pymongo import MongoClient
import os
import secrets
from dotenv import load_dotenv
from datetime import datetime, timezone
from werkzeug.exceptions import HTTPException
from flask.json.provider import DefaultJSONProvider
from bson import ObjectId
from urllib.parse import urlsplit


class MongoJSONProvider(DefaultJSONProvider):
    def dumps(self, obj, **kwargs):
        def visible(value):
            if isinstance(value, dict):
                return {key: visible(item) for key, item in value.items() if key not in ('_notificationOutbox', 'stockNoticeCycle')}
            if isinstance(value, (list, tuple)):
                return [visible(item) for item in value]
            return value
        return super().dumps(visible(obj), **kwargs)

    @staticmethod
    def default(value):
        if isinstance(value, ObjectId):
            return str(value)
        if isinstance(value, datetime):
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            return value.astimezone(timezone.utc).isoformat()
        return DefaultJSONProvider.default(value)

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

def create_app():
    # All uploaded files must pass our access checks, including /static aliases.
    app = Flask(__name__, static_folder=None)
    app.json = MongoJSONProvider(app)
    app.config['TRUSTED_HOSTS'] = [host.strip() for host in os.getenv('TRUSTED_HOSTS', 'localhost,127.0.0.1,[::1]').split(',') if host.strip()]
    app.config['SESSION_COOKIE_SECURE'] = os.getenv('SESSION_COOKIE_SECURE') == '1'
    # Avoid redirecting POST/multipart requests between /products and /products/.
    app.url_map.strict_slashes = False
    app.secret_key = os.getenv('SECRET_KEY') or secrets.token_hex(32)
    from .proxy import ProxyBoundary
    proxy_token = os.getenv('OMS_PROXY_TOKEN', '')
    if os.getenv('TRUST_PROXY') == '1' and not proxy_token:
        raise ValueError('TRUST_PROXY requires an OMS_PROXY_TOKEN; unauthenticated proxy trust is disabled')
    app.wsgi_app = ProxyBoundary(app.wsgi_app, proxy_token, os.getenv('OMS_PROXY_PEERS', '127.0.0.1/32,::1/128'))
    app.config['CORS_ORIGINS'] = [origin.strip().rstrip('/') for origin in
                                  os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(',') if origin.strip()]
    for origin in app.config['CORS_ORIGINS']:
        parsed = urlsplit(origin)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or '*' in origin or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
            raise ValueError('CORS_ORIGINS must contain exact HTTP(S) origins, without wildcards or paths')
    from .security import authorize_request, protect_auth_requests
    from .rate_limits import limit_requests, release_successful_action
    app.before_request(limit_requests)
    app.before_request(protect_auth_requests)
    app.before_request(authorize_request)
    app.after_request(release_successful_action)
    from .notifications import deliver_after_response
    app.after_request(deliver_after_response)

    @app.errorhandler(HTTPException)
    def http_error(error):
        if request.path.startswith('/api/'):
            message = 'This file is too large. The maximum upload size is 16 MB.' if error.code == 413 else error.description
            response = error.get_response()
            response.data = app.json.dumps({'success': False, 'error': message})
            response.content_type = 'application/json'
            return response
        return error

    @app.after_request
    def api_error_response(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        # The API serves JSON and images, never executable documents.
        response.headers['Content-Security-Policy'] = "default-src 'none'; frame-ancestors 'none'; sandbox"
        if request.is_secure:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000'
        if request.path.startswith('/api/') and response.status_code >= 500:
            # Route failures must not expose database URLs, credentials or traces.
            response.set_data(app.json.dumps({'success': False, 'error': 'The server is temporarily unavailable. Please try again shortly.'}))
            response.content_type = 'application/json'
        if request.path.startswith('/api/') and not getattr(g, 'public_cache_response', False) and response.headers.get('Cache-Control') != 'private, no-store':
            response.headers['Cache-Control'] = 'no-store'
        return response

    # Configure file upload settings
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    app.config['UPLOAD_FOLDER'] = os.getenv('OMS_UPLOAD_FOLDER') or os.path.join(app.root_path, 'static', 'uploads')
    app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

    # ✅ FIXED: Configure CORS properly - SIMPLIFIED VERSION
    CORS(app,
         origins=app.config['CORS_ORIGINS'],
         methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
         allow_headers=["Content-Type", "X-CSRF-Token", "Accept", "If-None-Match", "Cache-Control"],
         expose_headers=['Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'ETag', 'X-Store-Cache'],
         supports_credentials=True)

    # MongoDB Atlas Connection
    MONGODB_URI = os.getenv('MONGODB_URI')

    if not MONGODB_URI:
        raise Exception(" MONGODB_URI not found in .env file")

    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        app.db = client.get_database()
        client.admin.command('ping')
        print(" Connected to MongoDB Atlas!")
        print(f" Database: {app.db.name}")
    except Exception as e:
        print(f" MongoDB connection failed: {e}")
        raise e

    # Create upload directory if it doesn't exist
    upload_folder = app.config['UPLOAD_FOLDER']
    os.makedirs(upload_folder, exist_ok=True)
    print(f" Upload directory ready: {upload_folder}")

    # Serve static files
    @app.route('/uploads/<path:filename>')
    @app.route('/static/uploads/<path:filename>')
    def serve_uploaded_files(filename):
        from .uploads import serve_image
        return serve_image(filename)

    # Import and register routes
    try:
        from .routes import auth, users, products, orders, admin

        app.register_blueprint(auth.bp)
        app.register_blueprint(users.bp)
        app.register_blueprint(products.bp)
        app.register_blueprint(orders.bp)
        app.register_blueprint(admin.bp)
        print(" All routes registered successfully!")
    except ImportError as e:
        print(f" Route import error: {e}")
        raise e

    from .routes.cart import bp as cart_bp
    app.register_blueprint(cart_bp)
    from .routes.favorites import bp as favorites_bp
    app.register_blueprint(favorites_bp)
    from .routes.checkout import bp as checkout_bp
    app.register_blueprint(checkout_bp)
    from .routes.settings import bp as settings_bp
    app.register_blueprint(settings_bp)
    from .routes.access import bp as access_bp
    app.register_blueprint(access_bp)
    from .routes.notifications import bp as notifications_bp
    app.register_blueprint(notifications_bp)
    from .routes.policies import bp as policies_bp
    app.register_blueprint(policies_bp)
    from .routes.content import bp as content_bp
    app.register_blueprint(content_bp)
    from .schema import ensure_indexes, ensure_validators
    ensure_indexes(app.db)
    legacy_carts = app.db.carts.count_documents({'user_id': {'$not': {'$type': 'objectId'}}})
    legacy_orders = app.db.orders.count_documents({'userId': {'$not': {'$type': 'objectId'}}})
    if not legacy_carts and not legacy_orders:
        ensure_validators(app.db)

    # Add health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        from pymongo.errors import PyMongoError
        try:
            app.db.command('ping')
        except PyMongoError:
            return jsonify(status='unavailable'), 503
        return jsonify({
            'status': 'healthy',
            'message': 'Server is running',
            'timestamp': datetime.now(timezone.utc).isoformat()
        })

    @app.route('/')
    def home():
        return jsonify({
            'message': 'Old Goods Thrift Backend API',
            'status': 'running',
            'endpoints': {
                'health': '/api/health',
                'auth': '/api/auth',
                'products': '/api/products',
                'cart': '/api/cart',
                'orders': '/api/orders',
                'admin': '/api/admin',
                'static_files': '/static/uploads/'
            }
        })

    from .public_cache import configure_public_cache
    configure_public_cache(app)
    return app

def get_db():
    """Helper function to get database instance"""
    try:
        from flask import current_app
        db = current_app.db
        if db is None:
            return None
        try:
            db.command('ping')
        except:
            return None
        return db
    except RuntimeError:
        return None
    except Exception as e:
        print(f" Database connection error in get_db: {e}")
        return None
