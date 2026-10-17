from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
import os
import secrets
from werkzeug.middleware.proxy_fix import ProxyFix
from dotenv import load_dotenv
from datetime import datetime, timezone
from werkzeug.exceptions import HTTPException
from flask.json.provider import DefaultJSONProvider
from bson import ObjectId


class MongoJSONProvider(DefaultJSONProvider):
    @staticmethod
    def default(value):
        if isinstance(value, ObjectId):
            return str(value)
        return DefaultJSONProvider.default(value)

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

def create_app():
    app = Flask(__name__)
    app.json = MongoJSONProvider(app)
    app.config['SESSION_COOKIE_SECURE'] = os.getenv('SESSION_COOKIE_SECURE') == '1'
    # Avoid redirecting POST/multipart requests between /products and /products/.
    app.url_map.strict_slashes = False
    app.secret_key = os.getenv('SECRET_KEY') or secrets.token_hex(32)
    # Set TRUST_PROXY=1 only when deployed behind a trusted reverse proxy.
    if os.getenv('TRUST_PROXY') == '1':
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    from .security import authorize_request
    app.before_request(authorize_request)

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
        if request.path == '/api/auth/session':
            # Retire old browser-stored account/checkout data on upgrade. This
            # directive clears web storage without deleting the session cookie.
            response.headers['Clear-Site-Data'] = '"storage"'
            response.headers['Cache-Control'] = 'no-store'
        if request.path.startswith('/api/') and response.status_code >= 500:
            # Route failures must not expose database URLs, credentials or traces.
            response.set_data(app.json.dumps({'success': False, 'error': 'The server is temporarily unavailable. Please try again shortly.'}))
            response.content_type = 'application/json'
        if request.path.startswith('/api/auth/') or request.path == '/api/checkout':
            response.headers['Cache-Control'] = 'no-store'
        return response

    # Configure file upload settings
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'static', 'uploads')
    app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

    # ✅ FIXED: Configure CORS properly - SIMPLIFIED VERSION
    CORS(app,
         origins=os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(','),
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         allow_headers=["Content-Type", "X-CSRF-Token", "Accept"],
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
        upload_folder = app.config['UPLOAD_FOLDER']
        return send_from_directory(upload_folder, filename)

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
    from .routes.checkout import bp as checkout_bp
    app.register_blueprint(checkout_bp)
    from .routes.settings import bp as settings_bp
    app.register_blueprint(settings_bp)
    from .schema import ensure_indexes, ensure_validators
    ensure_indexes(app.db)
    legacy_carts = app.db.carts.count_documents({'user_id': {'$not': {'$type': 'objectId'}}})
    legacy_orders = app.db.orders.count_documents({'userId': {'$not': {'$type': 'objectId'}}})
    if not legacy_carts and not legacy_orders:
        ensure_validators(app.db)

    # Add health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
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
