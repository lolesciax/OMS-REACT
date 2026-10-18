from datetime import datetime
from flask import Blueprint, current_app, jsonify, request, g
from ..identity import find_user, public_user
from ..validation import profile, addresses
from ..admin_validation import FieldValidationError
from ..notifications import enqueue, account_event

bp = Blueprint('users', __name__, url_prefix='/api/users')


@bp.put('/workspace-preferences')
def workspace_preferences():
    from ..workspace_preferences import validate_workspace_preferences
    try:
        preferences = validate_workspace_preferences(request.get_json())
    except ValueError as error:
        return jsonify(success=False, error=str(error)), 400
    current_app.db.users.update_one({'_id': g.user['_id']}, {
        '$set': {'workspacePreferences': preferences},
    })
    return jsonify(success=True, workspacePreferences=preferences)


@bp.route('/')
def get_users():
    return jsonify(users=[public_user(user) for user in current_app.db.users.find({})])


@bp.route('/profile/<user_id>', methods=['GET', 'PUT'])
def user_profile(user_id):
    user = find_user(current_app.db, user_id)
    if not user:
        return jsonify(error='User not found'), 404
    if request.method == 'GET':
        options = current_app.db.account_options.find_one({'_id': 'profile'}) or {}
        return jsonify(user=public_user(user), options={'genders': options.get('genders', [])})
    try:
        changes = profile(request.get_json(), user)
    except FieldValidationError as error:
        return error.response()
    except ValueError as error:
        return jsonify(error=str(error)), 400
    if changes:
        current_app.db.users.update_one({'_id': user['_id']}, enqueue({'$set': {**changes, 'updated_at': datetime.utcnow()}}, 'users', user['_id'],
            account_event(user['_id'], 'Contact number changed', 'Your account contact number was updated. Contact the store if you did not make this change.') if 'phone' in changes and changes['phone'] != user.get('phone', '') else None))
    updated = current_app.db.users.find_one({'_id': user['_id']})
    return jsonify(success=True, user=public_user(updated), message='Profile saved')


@bp.route('/profile/<user_id>/address', methods=['PUT'])
def user_addresses(user_id):
    user = find_user(current_app.db, user_id)
    if not user:
        return jsonify(error='User not found'), 404
    try:
        saved = addresses(request.get_json().get('addresses'))
    except ValueError as error:
        return jsonify(error=str(error)), 400
    current_app.db.users.update_one({'_id': user['_id']}, {'$set': {'addresses': saved, 'updated_at': datetime.utcnow()}})
    return jsonify(success=True, addresses=saved, message='Addresses saved')
