from flask import Flask, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Configure file upload settings
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'static', 'uploads')
    app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    
    # ✅ FIXED: Configure CORS properly - SIMPLIFIED VERSION
    CORS(app, 
         origins=["http://localhost:5173", "http://localhost:3000"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         allow_headers=["Content-Type", "Authorization", "Accept"],
         supports_credentials=True)
    
    # MongoDB Atlas Connection
    MONGODB_URI = os.getenv('MONGODB_URI')
    
    if not MONGODB_URI:
        raise Exception("❌ MONGODB_URI not found in .env file")
    
    try:
        client = MongoClient(MONGODB_URI)
        app.db = client.get_database()
        client.admin.command('ping')
        print("✅ Connected to MongoDB Atlas!")
        print(f"📊 Database: {app.db.name}")
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        raise e
    
    # Create upload directory if it doesn't exist
    upload_folder = app.config['UPLOAD_FOLDER']
    os.makedirs(upload_folder, exist_ok=True)
    print(f"📁 Upload directory ready: {upload_folder}")
    
    # Serve static files
    @app.route('/static/uploads/<path:filename>')
    def serve_uploaded_files(filename):
        upload_folder = app.config['UPLOAD_FOLDER']
        return send_from_directory(upload_folder, filename)
    
    # Import and register routes
    try:
        from .routes import auth, users, products, customers, orders, admin
        
        app.register_blueprint(auth.bp)
        app.register_blueprint(users.bp)
        app.register_blueprint(products.bp)
        app.register_blueprint(customers.bp)
        app.register_blueprint(orders.bp)
        app.register_blueprint(admin.bp)
        print("✅ All routes registered successfully!")
    except ImportError as e:
        print(f"❌ Route import error: {e}")
        raise e
    
    # Import cart routes separately
    try:
        from .routes.cart import bp as cart_bp
        app.register_blueprint(cart_bp)
        print("✅ Cart routes registered!")
    except ImportError as e:
        print(f"❌ Cart routes import error: {e}")
        from flask import Blueprint, jsonify
        cart_bp = Blueprint('cart', __name__, url_prefix='/api/cart')
        
        @cart_bp.route('/<user_id>', methods=['GET'])
        def get_user_cart(user_id):
            return jsonify({'success': True, 'cart': []})
            
        @cart_bp.route('/<user_id>/add', methods=['POST'])
        def add_to_cart(user_id):
            return jsonify({'success': True, 'message': 'Cart functionality not implemented'})
            
        app.register_blueprint(cart_bp)
        print("⚠️ Using fallback cart routes")
    
    # ✅ FIXED: Add global OPTIONS handler for all routes
    @app.before_request
    def handle_options():
        from flask import request
        if request.method == 'OPTIONS':
            response = app.make_default_options_response()
            headers = {
                'Access-Control-Allow-Origin': 'http://localhost:5173',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
                'Access-Control-Allow-Credentials': 'true'
            }
            for key, value in headers.items():
                response.headers[key] = value
            return response
    
    # Add health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy', 
            'message': 'Server is running',
            'timestamp': '2024-01-01T00:00:00Z'
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
        print(f"❌ Database connection error in get_db: {e}")
        return None