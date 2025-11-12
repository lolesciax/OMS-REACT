from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
import random
import string
import requests

bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# In-memory storage for verification codes (use Redis in production)
verification_codes = {}

# -----------------------------------------------------
# 🧩 Utility: Generate clean, professional User ID
# -----------------------------------------------------
def generate_user_id(db):
    """Generate a sequential, 6-digit user ID (USR-000001)"""
    last_user = db.users.find_one(
        {"user_id": {"$regex": "^USR-"}},
        sort=[("created_at", -1)]
    )

    next_id = 1
    if last_user and "user_id" in last_user:
        try:
            next_id = int(last_user["user_id"].split("-")[1]) + 1
        except Exception as e:
            print(f"⚠️ User ID parse error: {e}")

    return f"USR-{next_id:06d}"

# -----------------------------------------------------
# 🧩 Function to create admin account if not exists
# -----------------------------------------------------
def create_admin_account():
    try:
        from flask import current_app
        admin_user = current_app.db.users.find_one({"username": "admin"})
        if not admin_user:
            admin_data = {
                "username": "admin",
                "email": "admin@oldgoodsthrift.com",
                "password": "admin12345",
                "isAdmin": True,
                "user_id": "ADMIN-000001",
                "created_at": datetime.utcnow()
            }
            current_app.db.users.insert_one(admin_data)
            print("✅ Admin account created: admin / admin12345")
    except Exception as e:
        print(f"❌ Error creating admin account: {e}")

# -----------------------------------------------------
# 🧩 CORS Preflight Handler for Auth Routes
# -----------------------------------------------------
@bp.before_request
def handle_options():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

# -----------------------------------------------------
# 🧩 Check Email Availability (MISSING ENDPOINT)
# -----------------------------------------------------
@bp.route('/check-email', methods=['POST', 'OPTIONS'])
def check_email():
    """Check if email is available for registration"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'preflight'}), 200
        
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        
        print(f"🔍 Checking email availability: {email}")

        if not email:
            return jsonify({"error": "Email is required"}), 400

        # Basic email validation
        if '@' not in email or '.' not in email:
            return jsonify({"error": "Invalid email format"}), 400

        # Check if email exists in database
        existing_user = current_app.db.users.find_one({'email': email})
        
        return jsonify({
            "exists": existing_user is not None,
            "available": existing_user is None,
            "email": email
        })
        
    except Exception as e:
        print(f"❌ Email check error: {e}")
        return jsonify({"error": "Server error during email check"}), 500

# -----------------------------------------------------
# 🧩 Check Username
# -----------------------------------------------------
@bp.route('/check-username', methods=['POST', 'OPTIONS'])
def check_username():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'preflight'}), 200
        
    try:
        data = request.get_json()
        username = data.get('username')

        print(f"🔍 Checking username: {username}")

        existing_user = current_app.db.users.find_one({"username": username})
        return jsonify({
            "exists": existing_user is not None,
            "available": existing_user is None
        })
    except Exception as e:
        print(f"❌ Username check error: {e}")
        return jsonify({"error": "Server error"}), 500

# -----------------------------------------------------
# 🧩 Login Route
# -----------------------------------------------------
@bp.route('/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'preflight'}), 200
        
    try:
        create_admin_account()

        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        print(f"🔐 Login attempt for username: {username}")

        user = current_app.db.users.find_one({"username": username})
        if user and user.get('password') == password:
            # Prepare user data for response
            user['_id'] = str(user['_id'])
            user_data = {k: v for k, v in user.items() if k != 'password'}

            print(f"✅ Login successful for username: {username}")
            print(f"👑 Admin status: {user_data.get('isAdmin', False)}")
            
            return jsonify({
                "message": "Login successful!",
                "user": user_data
            })

        print(f"❌ Login failed for username: {username}")
        return jsonify({"error": "Invalid username or password"}), 401

    except Exception as e:
        print(f"❌ Login error: {e}")
        return jsonify({"error": "Server error"}), 500

# -----------------------------------------------------
# 🧩 Register Route
# -----------------------------------------------------
@bp.route('/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'preflight'}), 200
        
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        username = data.get('username')

        print(f"📝 Registration attempt - Username: {username}, Email: {email}")

        if current_app.db.users.find_one({"email": email}):
            return jsonify({"error": "Email already registered. Please use a different email or login."}), 400

        if current_app.db.users.find_one({"username": username}):
            return jsonify({"error": "Username already taken. Please choose another username."}), 400

        # ✅ Generate new user ID
        user_id = generate_user_id(current_app.db)

        user_data = {
            "user_id": user_id,
            "email": email,
            "password": password,  # NOTE: Hash in production
            "username": username,
            "isAdmin": False,
            "created_at": datetime.utcnow()
        }

        result = current_app.db.users.insert_one(user_data)

        print(f"✅ User registered: {username} with email: {email} and ID: {user_id}")
        return jsonify({
            "message": "User registered successfully!",
            "user_id": str(result.inserted_id),
            "user_display_id": user_id
        })

    except Exception as e:
        print(f"❌ Registration error: {e}")
        return jsonify({"error": "Server error"}), 500

# -----------------------------------------------------
# 🧩 Forgot Password Route
# -----------------------------------------------------
@bp.route('/forgot-password', methods=['POST', 'OPTIONS'])
def forgot_password():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'preflight'}), 200
        
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        new_password = data.get('new_password')

        print(f"🔑 Password reset attempt - Username: {username}, Email: {email}")

        # Validate required fields
        if not username or not email or not new_password:
            return jsonify({"error": "Username, email, and new password are required"}), 400

        # Find user by username AND email - BOTH MUST MATCH THE SAME USER
        user = current_app.db.users.find_one({
            "username": username,
            "email": email
        })
        
        if not user:
            print(f"❌ User not found with username '{username}' and email '{email}'")
            return jsonify({"error": "No user found with this username and email combination"}), 404

        # Update password
        result = current_app.db.users.update_one(
            {
                "username": username,
                "email": email
            },
            {"$set": {
                "password": new_password,  # NOTE: Hash in production
                "updated_at": datetime.utcnow()
            }}
        )

        if result.modified_count > 0:
            print(f"✅ Password updated successfully for user: {username}")
            return jsonify({
                "message": "Password reset successfully! You can now login with your new password."
            })
        else:
            print(f"❌ Failed to update password for user: {username}")
            return jsonify({"error": "Failed to update password"}), 500

    except Exception as e:
        print(f"❌ Forgot password error: {e}")
        return jsonify({"error": "Server error"}), 500