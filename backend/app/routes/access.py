"""Admin-maintained role and account option catalogs."""
from bson import ObjectId
from flask import Blueprint, current_app, jsonify, request, g
from pymongo.errors import DuplicateKeyError
from ..access import PERMISSIONS, validate_role
from ..admin_validation import FieldValidationError, clean_text
from ..notifications import enqueue, event
from uuid import uuid4

bp = Blueprint('access', __name__, url_prefix='/api/admin')


def roles_response():
    roles = []
    for role in current_app.db.roles.find({}).sort('label', 1):
        roles.append({**role, '_id': str(role['_id']),
                      'assignedAccounts': current_app.db.users.count_documents({'roleId': role['_id']})})
    return jsonify(success=True, roles=roles, permissions=PERMISSIONS)


@bp.route('/roles', methods=['GET', 'POST'])
def roles():
    if request.method == 'GET':
        return roles_response()
    try:
        values = validate_role(request.get_json())
        current_app.db.roles.insert_one({**values, 'system': False})
        return roles_response(), 201
    except FieldValidationError as error:
        return error.response()
    except DuplicateKeyError:
        return jsonify(error='This role code already exists.', fields={'code': 'Choose a unique role code.'}), 409


@bp.route('/roles/<role_id>', methods=['PUT', 'DELETE'])
def role_detail(role_id):
    if not ObjectId.is_valid(role_id):
        return jsonify(error='Invalid role ID.'), 400
    db = current_app.db
    role = db.roles.find_one({'_id': ObjectId(role_id)})
    if not role:
        return jsonify(error='Role not found.'), 404
    if request.method == 'DELETE':
        if role.get('system') or db.users.find_one({'roleId': role['_id']}):
            return jsonify(error='Reassign accounts before removing a custom role. Built-in roles cannot be removed.'), 409
        db.roles.delete_one({'_id': role['_id']})
        return roles_response()
    try:
        values = validate_role(request.get_json(), role)
        if str(g.user.get('roleId')) == role_id and (not values['active'] or 'admin.access' not in values['permissions']):
            raise FieldValidationError({'permissions': 'You cannot remove your own administrator access.'})
        changed = values['active'] != role['active'] or values['permissions'] != role['permissions']
        notice = event(f'role:{uuid4().hex}', 'account', 'Account access updated',
                       'Your account role permissions or availability changed. Review your account or contact the store for help.',
                       '/profile', role_id=role['_id']) if changed else None
        db.roles.update_one({'_id': role['_id']}, enqueue({'$set': values}, 'roles', role['_id'], notice))
        return roles_response()
    except FieldValidationError as error:
        return error.response()


@bp.route('/account-options', methods=['GET', 'PUT'])
def account_options():
    if request.method == 'PUT':
        try:
            values = request.get_json().get('genders')
            if not isinstance(values, list) or not 1 <= len(values) <= 20:
                raise ValueError('Add between 1 and 20 profile options.')
            values = [clean_text(value, 'profile option', 30, True) for value in values]
            if len({value.casefold() for value in values}) != len(values):
                raise ValueError('Profile options must be unique.')
            current_app.db.account_options.update_one({'_id': 'profile'}, {'$set': {'genders': values}}, upsert=True)
        except ValueError as error:
            return jsonify(error=str(error), fields={'genders': str(error)}), 400
    options = current_app.db.account_options.find_one({'_id': 'profile'}) or {}
    return jsonify(success=True, genders=options.get('genders', []))
