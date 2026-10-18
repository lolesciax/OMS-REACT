import json
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch
from bson import ObjectId
from flask import Flask
from app import admin_validation as validators
from app.routes import admin, products, settings, orders


class AdminValidationTests(unittest.TestCase):
    def test_shared_validation_cases(self):
        cases = json.loads(Path(__file__).with_name('admin_validation_cases.json').read_text())
        for case in cases:
            with self.subTest(case=case):
                try:
                    getattr(validators, case['kind'])(case['input'])
                    errors = {}
                except validators.FieldValidationError as error:
                    errors = error.fields
                self.assertEqual(set(errors), set(case['errors']))

    def setUp(self):
        self.app = Flask(__name__)
        self.app.url_map.strict_slashes = False
        self.app.db = MagicMock()
        for blueprint in (admin.bp, products.bp, settings.bp, orders.bp):
            self.app.register_blueprint(blueprint)
        self.client = self.app.test_client()
        self.database = self.app.db
        self.database.products.find_one.return_value = {'_id': ObjectId(), 'name': 'Original'}

    def test_invalid_product_returns_all_fields_before_writing(self):
        with patch('app.get_db', return_value=self.database):
            response = self.client.post('/api/products', data={'name': ' ', 'category': '', 'stock': '1.5', 'price': '1.001'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.json['fields']), {'name', 'category', 'stock', 'price'})
        self.database.products.insert_one.assert_not_called()

    def test_product_limits_legacy_condition_and_normalization(self):
        with self.assertRaises(validators.FieldValidationError) as error:
            validators.product({'name':'x'*151,'category':'Tops','stock':'1','price':'10','description':'x'*2001})
        self.assertEqual(set(error.exception.fields), {'name','description'})
        self.assertEqual(validators.product({'condition':'Historical condition'}, {'condition':'Historical condition'})['condition'], 'Historical condition')
        self.assertEqual(validators.product({'name':' Shirt ', 'category':' Tops ', 'stock':'1','price':'10.25'})['name'], 'Shirt')

    def test_invalid_accounts_return_field_errors_and_never_write(self):
        response = self.client.post('/api/admin/users', json={'username':'x','email':'bad','password':'        ','phone':{'$ne':None}})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.json['fields']), {'username','email','password','phone'})
        self.database.users.insert_one.assert_not_called()

    def test_existing_account_preserves_legacy_username_and_blank_password(self):
        values = validators.account({'username':'old.user-name','password':'','firstName':' Alex '}, {'username':'old.user-name'})
        self.assertEqual(values['firstName'], 'Alex')
        self.assertNotIn('password', values)

    def test_discount_categories_and_dates_require_scalar_inputs(self):
        for payload in ({'code':[],'category':{}}, {'code':12,'validUntil':[]}, {'code':'A','validUntil':'20991231'}):
            response = self.client.post('/api/admin/discounts', json={'discountType':'fixed','value':'10','applyTo':'category',**payload})
            self.assertEqual(response.status_code, 400)
            self.assertTrue(response.json['fields'])
        self.database.discounts.insert_one.assert_not_called()

    def test_payment_errors_are_mapped_to_fields(self):
        response = self.client.put('/api/admin/settings/payments/gcash', data={'merchantName':' ', 'enabled':'sometimes'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.json['fields']), {'merchantName','enabled'})
        self.database.settings.update_one.assert_not_called()

    def test_malformed_status_and_tracking_are_client_errors_on_both_apis(self):
        self.database.orders.find_one.return_value = {'status':'processing'}
        with patch('app.get_db', return_value=self.database):
            for prefix in ('/api/admin/orders/','/api/orders/'):
                for data, key in (({'status':[]},'status'),({'status':{}},'status'),({'status':'shipped','trackingNumber':123456789012},'trackingNumber')):
                    with self.subTest(prefix=prefix,data=data):
                        response = self.client.put(prefix + str(ObjectId()), json=data)
                        self.assertEqual(response.status_code, 400)
                        self.assertIn(key, response.json['fields'])
        self.database.orders.update_one.assert_not_called()
