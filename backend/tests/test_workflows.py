"""Regression checks run without contacting MongoDB or sending email."""
import hashlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from bson import ObjectId
from flask import Flask
from app import MongoJSONProvider
from app.routes import orders, cart, auth, admin, products
from app.security import authorize_request, issue_session, hash_password, verify_password
from app.order_workflow import transition_order


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.json = MongoJSONProvider(self.app)
        self.app.secret_key = 'test-only-key'
        self.app.db = MagicMock()
        self.tmp = tempfile.TemporaryDirectory(dir=Path(__file__).parent)
        self.addCleanup(self.tmp.cleanup)
        self.app.config['UPLOAD_FOLDER'] = self.tmp.name
        for blueprint in (orders.bp, cart.bp, auth.bp, admin.bp, products.bp):
            self.app.register_blueprint(blueprint)
        self.client = self.app.test_client()
        self.db = self.app.db
        self.patch_db = patch('app.get_db', return_value=self.db)
        self.patch_db.start()
        self.addCleanup(self.patch_db.stop)
        self.pid = str(ObjectId())
        self.oid = str(ObjectId())

    def payload(self):
        return {
            'userId': 'customer',
            'items': [{'id': self.pid, 'qty': 2, 'name': 'Forged', 'price': .01}],
            'total': .02, 'subtotal': .02, 'paymentMethod': 'gcash',
            'shippingAddress': dict(recipient='Customer', contact='09123456789', street='Main St', barangay='Lahug', city='Cebu', province='Cebu'),
        }

    def test_server_recalculates_prices_and_regional_shipping(self):
        self.db.products.find_one.return_value = {'_id': ObjectId(self.pid), 'name': 'Shirt', 'price': 100, 'stock': 3}
        response = self.client.post('/api/orders/', json=self.payload())
        self.assertEqual(response.status_code, 201)
        order = self.db.orders.insert_one.call_args.args[0]
        self.assertEqual((order['subtotal'], order['shippingFee'], order['total']), (200, 120, 320))
        self.assertEqual(order['items'][0]['name'], 'Shirt')
        self.assertEqual(response.json['total'], 320)
        self.assertEqual(response.json['items'][0]['price'], 100)
        self.assertEqual(response.json['items'][0]['name'], 'Shirt')

    def test_rejects_empty_duplicate_and_invalid_quantities(self):
        self.db.products.find_one.return_value = {'_id': ObjectId(self.pid), 'name': 'Shirt', 'price': 100, 'stock': 3}
        for items in ([], [{'id': self.pid, 'qty': -1}], [{'id': self.pid, 'qty': 1.5}], [{'id': self.pid, 'qty': True}], [{'id': 'invalid', 'qty': 1}], [{'id': self.pid, 'qty': 1}] * 2):
            with self.subTest(items=items):
                data = self.payload()
                data['items'] = items
                self.assertEqual(self.client.post('/api/orders/', json=data).status_code, 400)
        self.db.orders.insert_one.assert_not_called()

    def test_cart_legacy_qty_field_updates_actual_quantity(self):
        self.db.products.find_one.return_value = {'stock': 5}
        self.db.carts.update_one.return_value.matched_count = 1
        response = self.client.put('/api/cart/customer/update', json={'product_id': self.pid, 'qty': 3})
        self.assertEqual(response.status_code, 200)
        update = self.db.carts.update_one.call_args.args[1]
        self.assertEqual(update['$set']['items.$.qty'], 3)

    def test_cart_rejects_negative_fractional_boolean_and_invalid_ids(self):
        for qty in (-1, 0, 1.5, True, '2'):
            with self.subTest(qty=qty):
                response = self.client.post('/api/cart/customer/add', json={'product_id': self.pid, 'quantity': qty})
                self.assertEqual(response.status_code, 400)
        response = self.client.post('/api/cart/customer/add', json={'product_id': 'bad', 'quantity': 1})
        self.assertEqual(response.status_code, 400)
        self.db.products.update_one.assert_not_called()

    def upload(self, data=b'\x89PNG\r\n\x1a\nimage', filename='proof.png'):
        return self.client.post('/api/orders/upload-payment-proof', data={
            'orderId': self.oid, 'userId': 'customer', 'paymentProof': (io.BytesIO(data), filename),
        })

    def test_invalid_proof_never_deducts_stock(self):
        self.assertEqual(self.upload(b'not an image').status_code, 400)
        self.assertEqual(self.upload(b'anything', 'proof.exe').status_code, 400)
        self.db.products.update_one.assert_not_called()
        self.db.orders.update_one.assert_not_called()

    def test_stock_failure_rolls_back_prior_items_and_releases_claim(self):
        self.db.orders.find_one.return_value = {'status': 'pending', 'items': [
            {'id': self.pid, 'name': 'First', 'qty': 1}, {'id': str(ObjectId()), 'name': 'Second', 'qty': 1},
        ]}
        self.db.orders.update_one.return_value.modified_count = 1
        self.db.products.update_one.side_effect = [MagicMock(modified_count=1), MagicMock(modified_count=0), MagicMock(modified_count=1)]
        self.assertEqual(self.upload().status_code, 409)
        self.assertEqual(self.db.products.update_one.call_args.args[1], {'$inc': {'stock': 1}})
        self.assertEqual(self.db.orders.update_one.call_args.args[1], {'$unset': {'paymentProcessing': ''}})

    def test_repeated_proof_is_idempotent(self):
        self.db.orders.find_one.return_value = {'paymentProof': '/static/uploads/existing.png'}
        self.assertEqual(self.upload().status_code, 200)
        self.db.products.update_one.assert_not_called()

    def test_simultaneous_proof_claim_does_not_deduct_stock(self):
        self.db.orders.find_one.return_value = {'status': 'pending'}
        self.db.orders.update_one.return_value.modified_count = 0
        self.assertEqual(self.upload().status_code, 409)
        self.db.products.update_one.assert_not_called()

    def test_successful_proof_uses_raw_cart_quantity_and_single_stock_increment(self):
        self.db.orders.find_one.return_value = {'status': 'pending', 'items': [{'id': self.pid, 'qty': 2}]}
        self.db.orders.update_one.return_value.modified_count = 1
        self.db.products.update_one.return_value.modified_count = 1
        self.db.carts.find_one.return_value = {'items': [{'product_id': self.pid, 'qty': 3}]}
        self.assertEqual(self.upload().status_code, 200)
        self.assertEqual(self.db.products.update_one.call_args.args[1], {'$inc': {'stock': -2}})
        self.assertEqual(self.db.carts.update_one.call_args.args[1], {'$inc': {'items.$.qty': -2}})

    def test_password_migration_accepts_all_existing_formats(self):
        password = 'Example-password-123'
        for stored in (password, hashlib.sha256(password.encode()).hexdigest(), hash_password(password)):
            self.assertTrue(verify_password(stored, password))
            self.assertFalse(verify_password(stored, 'wrong'))

    def test_reset_requires_email_verification(self):
        response = self.client.post('/api/auth/forgot-password', json={'username': 'customer', 'email': 'user@example.com', 'new_password': 'new-password-123'})
        self.assertEqual(response.status_code, 400)
        self.db.users.update_one.assert_not_called()

    def test_api_requires_real_session_and_admin_role(self):
        user = {'_id': ObjectId(), 'username': 'customer', 'password': hash_password('example123'), 'isAdmin': False}
        self.db.users.find_one.return_value = user
        with self.app.app_context():
            token, csrf = issue_session(user)
            self.db.sessions.find_one.return_value = self.db.sessions.insert_one.call_args.args[0]
        with self.app.test_request_context('/api/admin/stats'):
            self.assertEqual(authorize_request()[1], 401)
        with self.app.test_request_context('/api/admin/stats', headers={'Cookie': f'oms_session={token}', 'X-CSRF-Token': csrf}):
            self.assertEqual(authorize_request()[1], 403)
        user['isAdmin'] = True
        with self.app.test_request_context('/api/admin/stats', headers={'Cookie': f'oms_session={token}', 'X-CSRF-Token': csrf}):
            self.assertIsNone(authorize_request())

    def test_password_change_invalidates_session(self):
        user = {'_id': ObjectId(), 'password': 'old-password'}
        with self.app.app_context():
            token, csrf = issue_session(user)
            self.db.sessions.find_one.return_value = self.db.sessions.insert_one.call_args.args[0]
        user['password'] = 'new-password'
        self.db.users.find_one.return_value = user
        with self.app.test_request_context('/api/orders/', headers={'Cookie': f'oms_session={token}', 'X-CSRF-Token': csrf}):
            self.assertEqual(authorize_request()[1], 401)

    def test_status_changes_require_proof_and_valid_sequence(self):
        for order, data in [({'status': 'pending'}, {'status': 'confirmed'}), ({'status': 'pending'}, {'status': 'shipped'}), ({'status': 'completed'}, {'status': 'pending'}), ({'status': 'processing'}, {'status': 'shipped', 'trackingNumber': 'bad'})]:
            with self.assertRaises(ValueError):
                transition_order(order, data)
        result = transition_order({'status': 'processing'}, {'status': 'shipped', 'trackingNumber': '123456789012'})
        self.assertEqual(result['trackingNumber'], '123456789012')

    def test_regular_user_cannot_read_another_customers_orders(self):
        user = {'_id': ObjectId(), 'username': 'customer', 'password': 'test-password'}
        self.db.users.find_one.return_value = user
        with self.app.app_context():
            token, csrf = issue_session(user)
            self.db.sessions.find_one.return_value = self.db.sessions.insert_one.call_args.args[0]
        with self.app.test_request_context('/api/orders/user/another', headers={'Cookie': f'oms_session={token}', 'X-CSRF-Token': csrf}):
            from flask import request
            request.view_args = {'user_id': 'another'}
            self.assertEqual(authorize_request()[1], 403)

    def test_discount_validation_rejects_invalid_amounts(self):
        for value in (-1, 0, 101, 'not-a-number'):
            response = self.client.post('/api/admin/discounts', json={'code': 'SAVE', 'discountType': 'percentage', 'value': value})
            self.assertEqual(response.status_code, 400)
        self.db.discounts.insert_one.assert_not_called()

    def test_discount_creation_normalizes_code_and_keeps_scope(self):
        self.db.discounts.find_one.return_value = None
        response = self.client.post('/api/admin/discounts', json={'code': ' save10 ', 'discountType': 'percentage', 'value': '10', 'minPurchase': '200', 'applyTo': 'category', 'category': 'Shirts'})
        self.assertEqual(response.status_code, 201)
        saved = self.db.discounts.insert_one.call_args.args[0]
        self.assertEqual((saved['code'], saved['value'], saved['minPurchase'], saved['category']), ('SAVE10', 10, 200, 'Shirts'))

    def test_application_factory_health_and_cors(self):
        from app import create_app
        with patch('app.MongoClient', return_value=MagicMock()), patch.dict('os.environ', {'MONGODB_URI': 'mongodb://unused/test', 'SECRET_KEY': 'test-key', 'CORS_ORIGINS': 'http://localhost:5173'}):
            app = create_app()
        response = app.test_client().get('/api/health')
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.json['timestamp'], '2024-01-01T00:00:00Z')
        response = app.test_client().options('/api/cart/customer', headers={'Origin': 'http://localhost:5173', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'Authorization,Content-Type'})
        self.assertEqual(response.headers['Access-Control-Allow-Origin'], 'http://localhost:5173')

    def test_shipping_regions(self):
        for province, expected in [('Metro Manila', 50), ('Cavite', 80), ('Cebu', 120), ('Davao del Sur', 150)]:
            self.assertEqual(orders.calculate_shipping_fee(province), expected)

    def test_product_edits_keep_numeric_fields_numeric(self):
        self.db.products.find_one.return_value = {'_id': ObjectId(self.pid), 'name': 'Shirt'}
        self.db.products.update_one.return_value.modified_count = 1
        response = self.client.put(f'/api/products/{self.pid}', data={'price': '250.50', 'stock': '3', 'is_active': 'false'})
        self.assertEqual(response.status_code, 200)
        saved = self.db.products.update_one.call_args.args[1]['$set']
        self.assertEqual((saved['price'], saved['stock']), (250.5, 3))
        self.assertNotIn('is_active', saved)

    def test_invalid_product_numbers_never_write(self):
        self.db.products.find_one.return_value = {'_id': ObjectId(self.pid)}
        for data in ({'price': 'nan'}, {'price': '-1'}, {'stock': '1.5'}, {'stock': '-1'}, {'name': ' '}):
            with self.subTest(data=data):
                self.assertEqual(self.client.put(f'/api/products/{self.pid}', data=data).status_code, 400)
        self.db.products.update_one.assert_not_called()

    def test_stock_checks_reject_invalid_quantities(self):
        for quantity in (-1, 0, True, 1.5, '2'):
            self.assertEqual(self.client.post(f'/api/products/check-stock/{self.pid}', json={'quantity': quantity}).status_code, 400)

    def test_non_ascii_legacy_password_mismatch_does_not_crash(self):
        self.assertFalse(verify_password('caf\u00e9-password', 'wrong-password'))
        self.assertTrue(verify_password('caf\u00e9-password', 'caf\u00e9-password'))

    def test_missing_customer_identity_cannot_authorize_order_creation(self):
        user = {'_id': ObjectId(), 'username': 'customer', 'password': 'secret'}
        self.db.users.find_one.return_value = user
        with self.app.app_context():
            token, csrf = issue_session(user)
            self.db.sessions.find_one.return_value = self.db.sessions.insert_one.call_args.args[0]
        with self.app.test_request_context('/api/orders/', method='POST', json={'items': []}, headers={'Cookie': f'oms_session={token}', 'X-CSRF-Token': csrf}):
            self.assertEqual(authorize_request()[1], 403)

    def test_api_errors_preflights_and_slashes(self):
        from app import create_app
        with patch('app.MongoClient', return_value=MagicMock()), patch.dict('os.environ', {'MONGODB_URI': 'mongodb://unused/test', 'SECRET_KEY': 'test-key'}):
            app = create_app()
        client = app.test_client()
        response = client.get('/api/does-not-exist')
        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.json['success'])
        response = client.get('/api/products/invalid-id')
        self.assertEqual(response.status_code, 400)
        response = client.options('/api/cart/customer', headers={'Content-Type': 'application/json'})
        self.assertLess(response.status_code, 400)
        response = client.post('/api/auth/login', data='[]', content_type='application/json')
        self.assertEqual(response.status_code, 400)
        response = client.post('/api/products', data={'name': 'Shirt'})
        self.assertEqual(response.status_code, 401)
        self.assertNotIn(response.status_code, (301, 302, 307, 308))

    def test_legacy_catalog_repair_preserves_amounts_and_concurrent_edits(self):
        from normalize_catalog import numeric_repairs, normalize_catalog
        self.assertEqual(numeric_repairs({'price': '250.50', 'stock': '3'}), {'price': 250.5, 'stock': 3})
        for value in ('nan', 'inf', '-1', 'bad', '0.123456789123456789'):
            self.assertEqual(numeric_repairs({'price': value}), {})
        self.assertEqual(numeric_repairs({'stock': '1.5'}), {})
        self.db.products.find.return_value = [{'_id': self.pid, 'stock': '3'}]
        self.assertEqual(normalize_catalog(self.db.products)['products'], 1)
        self.db.products.update_one.assert_not_called()
        self.db.products.update_one.return_value.modified_count = 1
        self.assertEqual(normalize_catalog(self.db.products, apply=True)['updated'], 1)
        self.db.products.update_one.assert_called_once_with({'_id': self.pid, 'stock': '3'}, {'$set': {'stock': 3}})


if __name__ == '__main__':
    unittest.main()
