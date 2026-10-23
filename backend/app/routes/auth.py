from .. import validation
from pymongo.errors import DuplicateKeyError
from flask import Blueprint, request, jsonify, current_app, g
from ..identity import public_user, next_display_id
from ..access import selected_role
from ..notifications import prepare_document, account_event, enqueue
from bson import ObjectId
from ..captcha import challenge_response, require_captcha
from ..policies import acceptance
from ..admin_validation import collect, FieldValidationError
from datetime import datetime
import os
import re
import secrets
import hashlib
import smtplib
from email.message import EmailMessage
from datetime import timedelta
from ..security import hash_password, verify_password, issue_session, set_session_cookie, COOKIE_NAME

bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def email_owner(value):
    # New addresses are normalized; also protect older mixed-case accounts.
    return current_app.db.users.find_one({'email': value}, {'_id': 1}) or current_app.db.users.find_one(
        {'email': {'$regex': '^' + re.escape(value) + '$', '$options': 'i'}}, {'_id': 1})


@bp.get('/captcha')
def captcha():
    return challenge_response(request.args.get('purpose'))


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
                "roleId": current_app.db.roles.find_one({'code': 'admin', 'active': True})['_id'],
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
        existing_user = email_owner(email)

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
        values = collect({'username': lambda: validation.text(data.get('username'), 'username', True, 80),
                          'password': lambda: validation.text(data.get('password'), 'password', True, 128)})
        username, password = values['username'], data['password']
        require_captcha(data.get('captcha'), 'login')


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

    except FieldValidationError as error:
        return error.response()
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
        def confirm():
            if not isinstance(data.get('confirmPassword'), str) or data['confirmPassword'] != data.get('password'):
                raise ValueError('Confirm your password exactly as entered above.')
            return data['confirmPassword']
        values = collect({'email': lambda: validation.email(data.get('email')),
                          'username': lambda: validation.username(data.get('username')),
                          'password': lambda: validation.password(data.get('password')), 'confirm': confirm})
        email, username, password = values['email'], values['username'], values['password']
        consent = acceptance(data, 'account')


        if email_owner(email):
            raise FieldValidationError({'email': 'This email is already registered. Sign in or use another email.'})

        if current_app.db.users.find_one({"username": username}):
            raise FieldValidationError({'username': 'This username is already taken. Choose another username.'})
        require_captcha(data.get('captcha'), 'signup')

        # ✅ Generate new user ID
        user_id = generate_user_id(current_app.db)

        user_data = {
            "user_id": user_id,
            "email": email,
            "emailUnique": True,
            "password": hash_password(password),
            "username": username,
            "roleId": selected_role({})['_id'],
            "created_at": datetime.utcnow()
        }
        user_data['termsAcceptance'] = consent

        user_data['_id'] = ObjectId()
        prepare_document(user_data, 'users', account_event(user_data['_id'], 'Welcome to Old Goods', 'Your account is ready. Add your delivery details and find your next favorite.', key=f"welcome:{user_data['_id']}"))
        result = current_app.db.users.insert_one(user_data)

        return jsonify({
            "message": "User registered successfully!",
            "user_id": str(result.inserted_id),
            "user_display_id": user_id
        }), 201

    except FieldValidationError as error:
        return error.response()
    except ValueError as error:
        return jsonify(error=str(error)), 400
    except DuplicateKeyError as error:
        keys = (error.details or {}).get('keyPattern', {})
        field = 'email' if 'email' in keys else 'username' if 'username' in keys else None
        message = 'This email is already registered.' if field == 'email' else 'This username is already taken.' if field else 'This account already exists. Choose another username or email, or sign in.'
        return jsonify(error=message, fields={field: message} if field else {}), 409
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
    reset_user = current_app.db.users.find_one({'username': account, 'email': recipient}, {'_id': 1})
    reset_update = {'$set': {'password': hash_password(password), 'updated_at': datetime.utcnow()}, '$unset': {'password_reset_digest': '', 'password_reset_expires': ''}}
    if isinstance(reset_user, dict) and reset_user.get('_id'):
        enqueue(reset_update, 'users', reset_user['_id'], account_event(reset_user['_id'], 'Password changed', 'Your password was reset successfully. Contact the store immediately if you did not request this change.'))
    result = current_app.db.users.update_one({
        'username': account,
        'email': recipient,
        'password_reset_digest': hashlib.sha256(token.encode()).hexdigest(),
        'password_reset_expires': {'$gt': datetime.utcnow()},
    }, reset_update)
    if not result.modified_count:
        return jsonify(error='The verification code is invalid or expired. Request a new code.'), 400
    return jsonify(message='Password reset successfully. You can now log in.')


@bp.route('/session', methods=['GET'])
def current_session():
    user = current_app.db.users.find_one({'_id': g.user['_id']})
    if not user:
        return jsonify(authenticated=False, user=None), 200
    return jsonify(authenticated=True, user=public_user(user), csrfToken=g.session['csrfToken'])


@bp.route('/logout', methods=['POST'])
def logout():
    current_app.db.sessions.delete_one({'_id': g.session['_id']})
    response = jsonify(success=True)
    response.delete_cookie(COOKIE_NAME, path='/', httponly=True, samesite='Lax')
    return response
