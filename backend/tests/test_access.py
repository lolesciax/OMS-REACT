"""Role resolution fails closed without depending on historical boolean flags."""
import unittest
from unittest.mock import MagicMock
from bson import ObjectId
from app.access import access_fields, validate_role
from app.admin_validation import FieldValidationError


class AccessTests(unittest.TestCase):
    def test_explicit_role_wins_over_legacy_admin_flag(self):
        db = MagicMock()
        role_id = ObjectId()
        db.roles.find_one.return_value = {'_id': role_id, 'code': 'staff', 'label': 'Staff', 'active': True, 'permissions': []}
        result = access_fields({'roleId': role_id, 'isAdmin': True}, db)
        self.assertFalse(result['isAdmin'])
        db.roles.find_one.assert_called_once_with({'_id': role_id})

    def test_missing_invalid_and_inactive_roles_cannot_grant_access(self):
        db = MagicMock()
        db.roles.find_one.return_value = None
        self.assertFalse(access_fields({'roleId': ObjectId(), 'isAdmin': True}, db)['isAdmin'])
        db.roles.find_one.reset_mock()
        self.assertFalse(access_fields({'roleId': {'$ne': None}, 'isAdmin': True}, db)['isAdmin'])
        db.roles.find_one.assert_not_called()
        db.roles.find_one.return_value = {'_id': ObjectId(), 'code': 'staff', 'label': 'Store staff', 'active': False, 'permissions': ['admin.access']}
        result = access_fields({'roleId': ObjectId()}, db)
        self.assertFalse(result['isAdmin'])
        self.assertEqual(result['permissions'], [])
        self.assertEqual(result['roleLabel'], 'Store staff')

    def test_role_validation_rejects_unknown_capabilities_and_protects_builtin_access(self):
        values = {'code': 'staff', 'label': 'Staff', 'active': True, 'permissions': ['admin.access']}
        self.assertEqual(validate_role(values), values)
        for permissions in (['unknown'], {'admin.access': True}, [True]):
            with self.assertRaises(FieldValidationError):
                validate_role({**values, 'permissions': permissions})
        for changes in ({'permissions': []}, {'active': False}):
            with self.assertRaises(FieldValidationError):
                validate_role({**values, **changes}, {**values, 'system': True})
