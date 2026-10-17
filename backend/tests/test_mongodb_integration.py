"""Opt-in integration tests; use and remove a uniquely named test database only.

OMS_MONGODB_INTEGRATION=1 py -m unittest discover -s tests -v
"""
import io
import os
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from app import create_app
from app.schema import ensure_indexes
from app.security import hash_password
from normalize_database import plan_normalization, apply_normalization


@unittest.skipUnless(os.getenv('OMS_MONGODB_INTEGRATION') == '1', 'Opt-in MongoDB integration test')
class MongoIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client_connection = cls.app.db.client

    def setUp(self):
        self.database_name = 'oms_test_' + uuid4().hex[:24]
        self.db = self.client_connection.get_database(self.database_name)
        self.app.db = self.db
        self.addCleanup(self.clean_database)
        ensure_indexes(self.db)
        self.tmp = tempfile.TemporaryDirectory(dir=Path(__file__).parent)
        self.addCleanup(self.tmp.cleanup)
        self.app.config['UPLOAD_FOLDER'] = self.tmp.name
        self.client = self.app.test_client()
        self.uid = ObjectId()
        self.pid = ObjectId()
        self.db.users.insert_one({'_id': self.uid, 'username': 'integration-user', 'email': 'test@example.invalid',
                                  'password': hash_password('Example-123!'), 'user_id': 'USR-000001', 'isAdmin': False})
        self.db.products.insert_one({'_id': self.pid, 'name': 'Integration shirt', 'price': 125.5,
                                     'stock': 5, 'is_active': True, 'image': '/p1.jpg'})
        self.address = dict(recipient='Test Customer', contact='09123456789', street='Main St', barangay='Lahug', city='Cebu', province='Cebu')

    def clean_database(self):
        if not self.database_name.startswith('oms_test_') or len(self.database_name) != 33:
            raise RuntimeError('Refusing to remove an unexpected database')
        self.client_connection.drop_database(self.database_name)

    def login(self, client=None):
        client = client or self.client
        response = client.post('/api/auth/login', json={'username': 'integration-user', 'password': 'Example-123!'})
        self.assertEqual(response.status_code, 200, response.json)
        self.csrf = response.json['csrfToken']
        return response

    def mutate(self, method, path, data=None, **kwargs):
        return getattr(self.client, method)(path, json=data, headers={'X-CSRF-Token': self.csrf}, **kwargs)

    def test_cookie_session_restoration_csrf_revocation_and_expiry(self):
        response = self.login()
        self.assertIn('HttpOnly', response.headers['Set-Cookie'])
        self.assertIn('SameSite=Lax', response.headers['Set-Cookie'])
        self.assertNotIn('accessToken', response.json['user'])
        self.assertNotIn('password', response.json['user'])
        session = self.db.sessions.find_one({})
        cookie = self.client.get_cookie('oms_session').value
        self.assertNotEqual(session['_id'], cookie)
        restored = self.app.test_client()
        restored.set_cookie('oms_session', cookie)
        restored_response = restored.get('/api/auth/session')
        self.assertEqual(restored_response.json['user']['_id'], str(self.uid))
        self.assertEqual(restored_response.headers['Clear-Site-Data'], '"storage"')
        self.assertEqual(restored_response.headers['Cache-Control'], 'no-store')
        self.assertEqual(self.client.post('/api/auth/logout').status_code, 403)
        self.assertEqual(self.mutate('post', '/api/auth/logout').status_code, 200)
        self.assertEqual(restored.get('/api/auth/session').status_code, 401)
        self.login()
        self.db.sessions.update_many({}, {'$set': {'expiresAt': datetime.utcnow() - timedelta(seconds=1)}})
        self.assertEqual(self.client.get('/api/auth/session').status_code, 401)
        self.login()
        self.db.users.update_one({'_id': self.uid}, {'$set': {'password': hash_password('Changed-123!')}})
        self.assertEqual(self.client.get('/api/auth/session').status_code, 401)

    def test_database_checkout_reload_idempotent_order_and_proof_cleanup(self):
        self.login()
        self.db.carts.insert_one({'user_id': self.uid, 'items': [{'product_id': self.pid, 'qty': 3, 'selected': True}]})
        response = self.mutate('put', '/api/checkout', {'items': [{'id': str(self.pid), 'qty': 2, 'price': .01}]})
        self.assertEqual(response.status_code, 200, response.json)
        checkout = response.json['checkout']
        self.assertEqual(checkout['items'][0]['price'], 125.5)
        stored = self.db.checkouts.find_one({'userId': self.uid})
        self.assertEqual(stored['items'], [{'productId': self.pid, 'qty': 2}])
        self.assertNotIn('price', stored)
        self.assertEqual(self.mutate('patch', '/api/checkout', {'checkoutId': checkout['checkoutId'], 'shippingAddress': self.address, 'paymentMethod': 'gcash'}).status_code, 200)
        reloaded = self.client.get('/api/checkout').json['checkout']
        self.assertEqual(reloaded['shippingAddress']['province'], 'Cebu')
        payload = {'userId': str(self.uid), 'checkoutId': checkout['checkoutId'], 'items': [{'id': str(self.pid), 'qty': 2}],
                   'shippingAddress': self.address, 'paymentMethod': 'gcash', 'total': .01}
        first = self.mutate('post', '/api/orders', payload)
        self.assertEqual(first.status_code, 201, first.json)
        second = self.mutate('post', '/api/orders', payload)
        self.assertEqual(second.status_code, 200, second.json)
        self.assertEqual(first.json['orderId'], second.json['orderId'])
        self.assertEqual(self.db.orders.count_documents({}), 1)
        order = self.db.orders.find_one({})
        self.assertEqual(order['userId'], self.uid)
        self.assertEqual(order['items'][0]['id'], self.pid)
        self.assertNotIn('stock', order['items'][0])
        self.assertEqual(order['total'], 371)
        self.assertEqual(self.client.get('/api/checkout').json['checkout']['pendingOrder']['orderId'], first.json['orderId'])
        self.assertEqual(self.client.get(f'/api/orders/user/{self.uid}').json['orders'][0]['_id'], first.json['orderId'])
        for _ in range(2):
            response = self.client.post('/api/orders/upload-payment-proof', data={'orderId': first.json['orderId'], 'userId': str(self.uid),
                'paymentProof': (io.BytesIO(b'\x89PNG\r\n\x1a\nimage'), 'proof.png')}, headers={'X-CSRF-Token': self.csrf})
            self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(self.db.products.find_one({'_id': self.pid})['stock'], 3)
        self.assertEqual(self.db.carts.find_one({'user_id': self.uid})['items'][0]['qty'], 1)
        self.assertIsNone(self.db.checkouts.find_one({'userId': self.uid}))

    def test_account_isolation_and_atomic_display_ids(self):
        self.login()
        self.assertEqual(self.client.get(f'/api/cart/{self.uid}').json['cart'], [])
        self.assertEqual(self.db.carts.count_documents({}), 0)
        for qty in (2, 1):
            response = self.mutate('post', f'/api/cart/{self.uid}/add', {'product_id': str(self.pid), 'quantity': qty})
            self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(self.db.carts.count_documents({}), 1)
        self.assertEqual(self.db.carts.find_one({})['items'][0]['qty'], 3)
        self.assertEqual(self.mutate('put', f'/api/cart/{self.uid}/update', {'product_id': str(self.pid), 'selected': True}).status_code, 200)
        response = self.mutate('put', '/api/checkout', {'fromCart': True})
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json['checkout']['items'][0]['qty'], 3)
        other_id = self.db.users.insert_one({'username': 'other', 'email': 'other@example.invalid', 'password': hash_password('Example-123!')}).inserted_id
        self.assertEqual(self.client.get(f'/api/cart/{other_id}').status_code, 403)
        self.assertEqual(self.mutate('post', '/api/orders', {'userId': str(other_id)}).status_code, 403)
        self.assertEqual(self.mutate('put', '/api/checkout', {'items': [{'id': str(self.pid), 'qty': 99}]}).status_code, 409)
        self.assertEqual(self.mutate('put', '/api/checkout', {'items': [{'id': str(self.pid), 'qty': True}]}).status_code, 400)
        from app.identity import next_display_id
        ids = [next_display_id(self.db, 'users', 'user_id', 'USR') for _ in range(3)]
        self.assertEqual(ids, ['USR-000002', 'USR-000003', 'USR-000004'])

    def test_normalization_preserves_accounts_history_and_archives_originals(self):
        # Simulate legacy schema before the partial ObjectId cart index applies.
        self.db.users.insert_one({'username': 'second', 'user_id': 'USR-000001', 'email': 'test@example.invalid'})
        self.db.carts.insert_many([
            {'user_id': 'integration-user', 'items': [{'product_id': str(self.pid), 'qty': 2, 'selected': True}]},
            {'user_id': str(self.uid), 'items': [{'product_id': str(self.pid), 'qty': 1, 'selected': False}]},
        ])
        self.db.orders.insert_one({'userId': 'integration-user', 'total': 125.5, 'shippingAddress': self.address,
                                  'items': [{'id': str(self.pid), 'name': 'Historical name', 'price': 125.5, 'qty': 1, 'stock': 9}]})
        plan, report = plan_normalization(self.db)
        self.assertEqual(report['duplicateCartsMerged'], 1)
        apply_normalization(self.db, plan)
        self.assertEqual(plan_normalization(self.db)[1]['changes'], 0)
        self.assertEqual(self.db.users.count_documents({}), 2)
        self.assertEqual(self.db.carts.count_documents({}), 1)
        self.assertEqual(self.db.orders.count_documents({}), 1)
        self.assertEqual(self.db.carts.find_one({})['items'][0]['qty'], 2)
        self.assertEqual(self.db.orders.find_one({})['items'][0]['name'], 'Historical name')
        self.assertEqual(self.db.normalization_backups.count_documents({}), len(plan))
        with self.assertRaises(DuplicateKeyError):
            self.db.carts.insert_one({'user_id': self.uid, 'items': []})

    def test_account_deletion_keeps_order_owners_and_cleans_unused_state(self):
        self.login()
        self.db.users.update_one({'_id': self.uid}, {'$set': {'isAdmin': True}})
        other = self.db.users.insert_one({'username': 'remove-me', 'email': 'remove@example.invalid', 'password': 'unused'}).inserted_id
        self.db.carts.insert_one({'user_id': other, 'items': []})
        self.db.checkouts.insert_one({'userId': other, 'orderId': ObjectId(), 'items': [{'productId': self.pid, 'qty': 1}], 'expiresAt': datetime.utcnow() + timedelta(days=1)})
        self.db.sessions.insert_one({'_id': 'other-session', 'userId': other, 'csrfToken': 'other', 'passwordVersion': 'other', 'expiresAt': datetime.utcnow() + timedelta(days=1)})
        order_id = self.db.orders.insert_one({'userId': other, 'items': []}).inserted_id
        self.assertEqual(self.mutate('delete', f'/api/admin/users/{other}').status_code, 400)
        self.db.orders.delete_one({'_id': order_id})
        self.assertEqual(self.mutate('delete', f'/api/admin/users/{other}').status_code, 200)
        self.assertIsNone(self.db.carts.find_one({'user_id': other}))
        self.assertIsNone(self.db.checkouts.find_one({'userId': other}))
        self.assertIsNone(self.db.sessions.find_one({'userId': other}))
