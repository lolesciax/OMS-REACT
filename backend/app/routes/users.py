from datetime import datetime
from flask import Blueprint, current_app, jsonify, request
from ..identity import find_user, public_user
from ..validation import profile, addresses

bp = Blueprint('users', __name__, url_prefix='/api/users')


@bp.route('/')
def get_users():
    return jsonify(users=[public_user(user) for user in current_app.db.users.find({})])


@bp.route('/profile/<user_id>', methods=['GET', 'PUT'])
def user_profile(user_id):
    user = find_user(current_app.db, user_id)
    if not user:
        return jsonify(error='User not found'), 404
    if request.method == 'GET':
        return jsonify(user=public_user(user))
    try:
        changes = profile(request.get_json())
    except ValueError as error:
        return jsonify(error=str(error)), 400
    if changes:
        current_app.db.users.update_one({'_id': user['_id']}, {'$set': {**changes, 'updated_at': datetime.utcnow()}})
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
