"""Database-owned roles; code defines the capabilities that can be enforced."""
from bson import ObjectId
from flask import current_app
from .admin_validation import FieldValidationError, clean_text, boolean
from .catalog import DEFAULT_CATALOG_OPTIONS

PERMISSIONS = {'admin.access': 'Manage the store and its accounts'}


def ensure_access_data(db):
    db.roles.create_index('code', unique=True)
    for code, label, permissions in (
        ('customer', 'Customer', []),
        ('admin', 'Administrator', ['admin.access']),
    ):
        db.roles.update_one({'code': code}, {'$setOnInsert': {
            'label': label, 'permissions': permissions, 'active': True, 'system': True,
        }}, upsert=True)
    db.account_options.update_one({'_id': 'profile'}, {'$setOnInsert': {
        'genders': ['Female', 'Male', 'Non-binary', 'Other'],
    }}, upsert=True)
    db.catalog_options.update_one(
        {'_id': 'product'},
        {'$setOnInsert': DEFAULT_CATALOG_OPTIONS},
        upsert=True,
    )
    # One-time, idempotent migration. Explicit role assignments always win.
    for legacy_admin, code in ((True, 'admin'), (False, 'customer')):
        role = db.roles.find_one({'code': code})
        if isinstance(role, dict):
            query = {'roleId': {'$exists': False}, 'isAdmin': True if legacy_admin else {'$ne': True}}
            db.users.update_many(query, {'$set': {'roleId': role['_id']}, '$unset': {'isAdmin': ''}})
    db.users.update_many({'roleId': {'$type': 'objectId'}, 'isAdmin': {'$exists': True}}, {'$unset': {'isAdmin': ''}})


def role_for(user, db=None, include_inactive=False):
    db = current_app.db if db is None else db
    # Legacy accounts created before migration still resolve through a DB role.
    if 'roleId' in user:
        value = user['roleId']
        if not isinstance(value, (str, ObjectId)) or not ObjectId.is_valid(value):
            return None
        query = {'_id': ObjectId(value)}
    else:
        query = {'code': 'admin' if user.get('isAdmin') is True else 'customer'}
    role = db.roles.find_one(query)
    return role if isinstance(role, dict) and (include_inactive or role.get('active') is True) else None


def access_fields(user, db=None):
    role = role_for(user, db, include_inactive=True)
    permissions = role.get('permissions', []) if role and role.get('active') is True else []
    return {
        'roleId': str(role['_id']) if role else str(user.get('roleId', '')),
        'role': role.get('code', '') if role else '',
        'roleLabel': role.get('label', 'Unavailable role') if role else 'Unavailable role',
        'permissions': permissions,
        'isAdmin': 'admin.access' in permissions,
    }


def selected_role(data, existing=None):
    """Only account administration can assign roles; never accept permission lists."""
    if 'roleId' not in data:
        if existing is not None and 'isAdmin' not in data:
            return None
        if 'isAdmin' in data:
            raise FieldValidationError({'roleId': 'Choose a role from the account role list.'})
        role = current_app.db.roles.find_one({'code': 'customer', 'active': True})
    else:
        value = data['roleId']
        if not isinstance(value, str) or not ObjectId.is_valid(value):
            raise FieldValidationError({'roleId': 'Choose a valid account role.'})
        role = current_app.db.roles.find_one({'_id': ObjectId(value), 'active': True})
    if not isinstance(role, dict):
        raise FieldValidationError({'roleId': 'This role is unavailable. Choose an active role.'})
    return role


def validate_role(data, existing=None):
    from .admin_validation import collect
    checks = {'label': lambda: clean_text(data.get('label'), 'role name', 80, True)}
    if existing is None:
        import re
        def code():
            value = clean_text(data.get('code'), 'role code', 40, True).lower()
            if not re.fullmatch(r'[a-z][a-z0-9_-]{1,39}', value):
                raise ValueError('Use 2–40 lowercase letters, numbers, hyphens or underscores.')
            return value
        checks['code'] = code
    def permissions():
        value = data.get('permissions')
        if not isinstance(value, list) or any(not isinstance(item, str) or item not in PERMISSIONS for item in value):
            raise ValueError('Choose valid role permissions.')
        return sorted(set(value))
    checks['permissions'] = permissions
    checks['active'] = lambda: boolean(data.get('active', True), 'role status')
    values = collect(checks)
    if existing and existing.get('system'):
        if not values['active'] or values['permissions'] != existing.get('permissions', []):
            raise FieldValidationError({'permissions': 'Built-in role access is protected. Create a custom role for different access.'})
    return values
