from .. import validation
from pymongo.errors import DuplicateKeyError
from flask import Blueprint, request, jsonify, current_app, g
from ..identity import public_user, next_display_id
from datetime import datetime
import random
import string
import os
import secrets
import hashlib
import smtplib
from email.message import EmailMessage
from datetime import timedelta
from ..security import hash_password, verify_password, issue_session, set_session_cookie, COOKIE_NAME

bp = Blueprint('auth', __name__, url_prefix='/api/auth')


# -----------------------------------------------------
# 🧩 Utility: Generate clean, professional User ID
# -----------------------------------------------------
def generate_user_id(db):
    return next_display_id(db, 'users', 'user_id', 'USR')

# -----------------------------------------------------
# 🧩 Function to create admin account if not exists
# -----------------------------------------------------
def create_admin_account():
    try:
        from flask import current_app
        admin_user = current_app.db.users.find_one({"username": "admin"})
        if not admin_user and os.getenv('ADMIN_PASSWORD'):
            admin_data = {
                "username": "admin",
                "email": "admin@oldgoodsthrift.com",
                "password": hash_password(os.environ["ADMIN_PASSWORD"]),
                "isAdmin": True,
                "user_id": "ADMIN-000001",
                "created_at": datetime.utcnow()
            }
            current_app.db.users.insert_one(admin_data)
    except Exception as e:
        pass

# -----------------------------------------------------
# 🧩 CORS Preflight Handler for Auth Routes
# -----------------------------------------------------

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
        email = validation.email(data.get('email'))


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

    except ValueError as error:
        return jsonify(error=str(error)), 400
    except DuplicateKeyError:
        return jsonify(error="This account already exists. Choose another username or sign in."), 409
    except Exception as e:
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
        username = validation.text(data.get('username'), 'username', True, 80)


        existing_user = current_app.db.users.find_one({"username": username})
        return jsonify({
            "exists": existing_user is not None,
            "available": existing_user is None
        })
    except ValueError as error:
        return jsonify(error=str(error)), 400
    except DuplicateKeyError:
        return jsonify(error="This account already exists. Choose another username or sign in."), 409
    except Exception as e:
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
        username = validation.text(data.get('username'), 'username', True, 80)
        password = data.get('password')
        if not isinstance(password, str) or not password or len(password) > 128:
            return jsonify(error='Enter your password.'), 400


        user = current_app.db.users.find_one({"username": username})
        if user and user.get('isActive', True) and verify_password(user.get('password'), password):
            if not user.get('password', '').startswith(('scrypt:', 'pbkdf2:')):
                user['password'] = hash_password(password)
                current_app.db.users.update_one({'_id': user['_id']}, {'$set': {'password': user['password']}})
            token, csrf = issue_session(user)
            response = jsonify(message='Login successful!', user=public_user(user), csrfToken=csrf)
            # Revoke the previous browser session when switching accounts.
            old = request.cookies.get(COOKIE_NAME)
            if old:
                current_app.db.sessions.delete_one({'_id': hashlib.sha256(old.encode()).hexdigest()})
            return set_session_cookie(response, token)

        return jsonify({"error": "Invalid username or password"}), 401

    except ValueError as error:
        return jsonify(error=str(error)), 400
    except DuplicateKeyError:
        return jsonify(error="This account already exists. Choose another username or sign in."), 409
    except Exception as e:
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
        email = validation.email(data.get('email'))
        password = validation.password(data.get('password'))
        username = validation.username(data.get('username'))


        if current_app.db.users.find_one({"email": email}):
            return jsonify({"error": "Email already registered. Please use a different email or login."}), 400

        if current_app.db.users.find_one({"username": username}):
            return jsonify({"error": "Username already taken. Please choose another username."}), 400

        # ✅ Generate new user ID
        user_id = generate_user_id(current_app.db)

        user_data = {
            "user_id": user_id,
            "email": email,
            "password": hash_password(password),
            "username": username,
            "isAdmin": False,
            "created_at": datetime.utcnow()
        }

        result = current_app.db.users.insert_one(user_data)

        return jsonify({
            "message": "User registered successfully!",
            "user_id": str(result.inserted_id),
            "user_display_id": user_id
        })

    except ValueError as error:
        return jsonify(error=str(error)), 400
    except DuplicateKeyError:
        return jsonify(error="This account already exists. Choose another username or sign in."), 409
    except Exception as e:
        return jsonify({"error": "Server error"}), 500

# -----------------------------------------------------
# 🧩 Forgot Password Route
# -----------------------------------------------------
@bp.route('/request-password-reset', methods=['POST'])
def request_password_reset():
    data = request.get_json(silent=True) or {}
    try:
        account = validation.text(data.get('username'), 'username', True, 80)
        recipient = validation.email(data.get('email'))
    except ValueError as error:
        return jsonify(error=str(error)), 400
    if not os.getenv('SMTP_HOST') or not os.getenv('SMTP_FROM'):
        return jsonify(error='Password recovery is currently unavailable. Please contact the store.'), 503
    user = current_app.db.users.find_one({'username': account, 'email': recipient})
    message = 'If the account details match, a verification code has been sent to your email.'
    if not user:
        return jsonify(message=message)
    token = secrets.token_urlsafe(24)
    current_app.db.users.update_one({'_id': user['_id']}, {'$set': {
        'password_reset_digest': hashlib.sha256(token.encode()).hexdigest(),
        'password_reset_expires': datetime.utcnow() + timedelta(minutes=15),
    }})
    mail = EmailMessage()
    mail['Subject'] = 'Old Goods Thrift password recovery'
    mail['From'] = os.environ['SMTP_FROM']
    mail['To'] = user['email']
    mail.set_content(f'Your password reset code is: {token}\n\nIt expires in 15 minutes. If you did not request this, you can ignore this email.')
    try:
        with smtplib.SMTP(os.environ['SMTP_HOST'], int(os.getenv('SMTP_PORT', '587')), timeout=15) as smtp:
            smtp.starttls()
            if os.getenv('SMTP_USERNAME'):
                smtp.login(os.environ['SMTP_USERNAME'], os.environ['SMTP_PASSWORD'])
            smtp.send_message(mail)
    except Exception:
        current_app.logger.exception('Password recovery email failed')
        return jsonify(error='Unable to send verification email. Please try again later.'), 503
    return jsonify(message=message)


@bp.route('/forgot-password', methods=['POST', 'OPTIONS'])
def forgot_password():
    if request.method == 'OPTIONS':
        return '', 200
    data = request.get_json(silent=True) or {}
    try:
        password = validation.password(data.get('new_password'))
        account = validation.text(data.get('username'), 'username', True, 80)
        recipient = validation.email(data.get('email'))
        token = validation.text(data.get('token'), 'verification code', True, 250)
    except ValueError as error:
        return jsonify(error=str(error)), 400
    result = current_app.db.users.update_one({
        'username': account,
        'email': recipient,
        'password_reset_digest': hashlib.sha256(token.encode()).hexdigest(),
        'password_reset_expires': {'$gt': datetime.utcnow()},
    }, {'$set': {'password': hash_password(password), 'updated_at': datetime.utcnow()}, '$unset': {'password_reset_digest': '', 'password_reset_expires': ''}})
    if not result.modified_count:
        return jsonify(error='The verification code is invalid or expired. Request a new code.'), 400
    return jsonify(message='Password reset successfully. You can now log in.')


@bp.route('/session', methods=['GET'])
def current_session():
    return jsonify(user=public_user(g.user), csrfToken=g.session['csrfToken'])


@bp.route('/logout', methods=['POST'])
def logout():
    current_app.db.sessions.delete_one({'_id': g.session['_id']})
    response = jsonify(success=True)
    response.delete_cookie(COOKIE_NAME, path='/', httponly=True, samesite='Lax')
    return response
