from security_helpers import captcha_payload, consent_payload, registration_payload
"""Opt-in integration tests; use and remove a uniquely named test database only.

OMS_MONGODB_INTEGRATION=1 py -m unittest discover -s tests -v
"""
import io
import base64
import os
import tempfile
import unittest
from image_fixtures import VALID_PNG
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4
from unittest.mock import patch
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

    @classmethod
    def tearDownClass(cls):
        cls.client_connection.close()

    def setUp(self):
        self.database_name = 'oms_test_' + uuid4().hex[:24]
        self.db = self.client_connection.get_database(self.database_name)
        self.app.db = self.db
        self.addCleanup(self.clean_database)
        ensure_indexes(self.db)
        self.admin_role = self.db.roles.find_one({'code': 'admin'})['_id']
        self.customer_role = self.db.roles.find_one({'code': 'customer'})['_id']
        self.tmp = tempfile.TemporaryDirectory(dir=Path(__file__).parent)
        self.addCleanup(self.tmp.cleanup)
        self.app.config['UPLOAD_FOLDER'] = self.tmp.name
        self.client = self.app.test_client()
        self.uid = ObjectId()
        self.pid = ObjectId()
        self.db.users.insert_one({'_id': self.uid, 'username': 'integration-user', 'email': 'test@example.invalid',
                                  'password': hash_password('Example-123!'), 'user_id': 'USR-000001', 'roleId': self.customer_role})
        self.db.products.insert_one({'_id': self.pid, 'name': 'Integration shirt', 'price': 125.5,
                                     'stock': 5, 'is_active': True, 'image': '/p1.jpg'})
        self.address = dict(recipient='Test Customer', contact='09123456789', street='Main St', barangay='Lahug', city='Cebu', province='Cebu')

    def clean_database(self):
        if not self.database_name.startswith('oms_test_') or len(self.database_name) != 33:
            raise RuntimeError('Refusing to remove an unexpected database')
        self.client_connection.drop_database(self.database_name)

    def test_workspace_preferences_are_admin_owned_validated_and_csrf_protected(self):
        from app.workspace_preferences import SIDEBAR_ITEMS
        path = '/api/users/workspace-preferences'
        preferences = {'sidebarOrder': list(SIDEBAR_ITEMS), 'sidebarWidth': 300}
        self.assertEqual(self.client.put(path, json=preferences).status_code, 401)
        self.login()
        self.assertEqual(self.client.put(path, json=preferences, headers={'X-CSRF-Token': self.csrf}).status_code, 403)
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.admin_role}})
        self.assertEqual(self.client.put(path, json=preferences).status_code, 403)
        headers = {'X-CSRF-Token': self.csrf}
        self.assertEqual(self.client.put(path, json={**preferences, 'userId': str(ObjectId())}, headers=headers).status_code, 400)
        self.assertEqual(self.client.put(path, json={**preferences, 'sidebarOrder': list(reversed(SIDEBAR_ITEMS))}, headers=headers).status_code, 400)
        response = self.client.put(path, json=preferences, headers=headers)
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(self.db.users.find_one({'_id': self.uid})['workspacePreferences'], preferences)
        self.assertEqual(self.client.get('/api/auth/session').json['user']['workspacePreferences'], preferences)

    def login(self, client=None):
        client = client or self.client
        response = client.post('/api/auth/login', json={'username': 'integration-user', 'password': 'Example-123!', 'captcha': captcha_payload(client)})
        self.assertEqual(response.status_code, 200, response.json)
        self.csrf = response.json['csrfToken']
        return response

    def test_public_response_cache_tracks_stock_and_published_content(self):
        from app.public_cache import REVISION_ID
        first = self.client.get('/api/products')
        self.assertEqual(first.headers['X-Store-Cache'], 'MISS')
        self.assertEqual(self.client.get('/api/products').headers['X-Store-Cache'], 'HIT')
        etag = first.headers['ETag']
        self.assertEqual(self.client.get('/api/products', headers={'If-None-Match': etag}).status_code, 304)
        self.client.get(f'/api/products/{self.pid}')
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.admin_role}})
        self.login()
        headers = {'X-CSRF-Token': self.csrf}
        changed = self.client.put(f'/api/products/update-stock/{self.pid}', json={'stock': 0}, headers=headers)
        self.assertEqual(changed.status_code, 200, changed.json)
        self.assertGreater(self.db.settings.find_one({'_id': REVISION_ID})['revision'], 0)
        fresh = self.client.get('/api/products', headers={'If-None-Match': etag})
        self.assertEqual(fresh.status_code, 200)
        self.assertEqual(fresh.headers['X-Store-Cache'], 'MISS')
        self.assertEqual(fresh.json['products'], [])
        self.assertEqual(self.client.get(f'/api/products/{self.pid}').status_code, 404)
        published = self.client.get('/api/content/support')
        self.assertEqual(self.client.get('/api/content/support').headers['X-Store-Cache'], 'HIT')
        content = published.json['content']
        content['data']['email'] = 'cache-test@example.com'
        saved = self.client.put('/api/admin/maintenance/content/support', json={'revision': content['revision'], 'data': content['data']}, headers=headers)
        self.assertEqual(saved.status_code, 200, saved.json)
        self.assertEqual(self.client.get('/api/content/support').json['content']['data']['email'], 'cache-test@example.com')
        anonymous = self.app.test_client()
        self.assertEqual(anonymous.get('/api/orders').headers['Cache-Control'], 'no-store')
        self.assertNotIn('ETag', anonymous.get('/api/auth/captcha').headers)

    def test_captcha_requires_browser_binding_purpose_integrity_and_single_use(self):
        payload = captcha_payload(self.client)
        credentials = {'username': 'integration-user', 'password': 'Example-123!', 'captcha': payload}
        self.assertEqual(self.app.test_client().post('/api/auth/login', json=credentials).status_code, 400)
        altered = __import__('json').loads(base64.b64decode(payload))
        altered['challenge']['parameters']['cost'] = 1
        forged = base64.b64encode(__import__('json').dumps(altered).encode()).decode()
        self.assertEqual(self.client.post('/api/auth/login', json={**credentials, 'captcha': forged}).status_code, 400)
        self.assertEqual(self.client.post('/api/auth/login', json=credentials).status_code, 200)
        self.assertEqual(self.client.post('/api/auth/login', json=credentials).status_code, 400)
        signup_proof = captcha_payload(self.client, 'signup')
        self.assertEqual(self.client.post('/api/auth/login', json={**credentials, 'captcha': signup_proof}).status_code, 400)

    def test_registration_requires_current_terms_confirmation_and_valid_email(self):
        values = {'username': 'consent_user', 'email': 'consent@example.invalid', 'password': 'Example-123!'}
        payload = registration_payload(self.client, values)
        for changes in ({'email': 'a@-invalid.com'}, {'confirmPassword': 'Different-123!'}, {'termsAccepted': False}, {'termsVersion': str(ObjectId())}):
            response = self.client.post('/api/auth/register', json={**payload, **changes})
            self.assertEqual(response.status_code, 400, response.json)
        response = self.client.post('/api/auth/register', json=payload)
        self.assertEqual(response.status_code, 201, response.json)
        user = self.db.users.find_one({'username': values['username']})
        self.assertEqual(str(user['termsAcceptance']['version']), payload['termsVersion'])
        self.assertIsInstance(user['termsAcceptance']['acceptedAt'], datetime)

    def test_signup_email_checks_preserve_mixed_case_legacy_accounts(self):
        self.db.users.update_one({'_id': self.uid}, {'$set': {'email': 'Legacy.Customer@Example.INVALID'}})
        response = self.client.post('/api/auth/check-email', json={'email': 'legacy.customer@example.invalid'})
        self.assertEqual(response.status_code, 200, response.json)
        self.assertFalse(response.json['available'])
        # Dots in an address must be literal, rather than regex wildcards.
        response = self.client.post('/api/auth/check-email', json={'email': 'legacyXcustomer@example.invalid'})
        self.assertTrue(response.json['available'])
        payload = registration_payload(self.client, {'username': 'legacy_signup', 'email': 'LEGACY.CUSTOMER@example.invalid', 'password': 'Example-123!'})
        response = self.client.post('/api/auth/register', json=payload)
        self.assertEqual(response.status_code, 400, response.json)
        self.assertIn('email', response.json['fields'])
        self.assertEqual(self.db.users.count_documents({'username': 'legacy_signup'}), 0)
        self.assertEqual(self.db.users.find_one({'_id': self.uid})['email'], 'Legacy.Customer@Example.INVALID')

    def test_auth_budgets_are_shared_expire_and_ignore_forged_forwarded_ip(self):
        for index in range(20):
            path = '/api/auth/login' + ('/' if index % 2 else '')
            response = self.app.test_client().post(path, json={'username': 'integration-user', 'password': ''})
            self.assertEqual(response.status_code, 400)
        response = self.client.post('/api/auth/login', json={'username': 'integration-user', 'password': 'Example-123!'},
            headers={'X-Forwarded-For': '192.0.2.5'})
        self.assertEqual(response.status_code, 429)
        self.assertTrue(1 <= int(response.headers['Retry-After']) <= 300)
        self.assertEqual(self.db.sessions.count_documents({}), 0)
        self.assertIn('expiresAt_1', self.db.rate_limits.index_information())
        for document in self.db.rate_limits.find({}):
            self.assertNotIn('integration-user', str(document))
            self.assertNotIn('127.0.0.1', str(document))
        # Expired attempts stop blocking before MongoDB's TTL sweep runs.
        self.db.rate_limits.update_many({}, {'$set': {
            'attempts': [datetime.utcnow() - timedelta(minutes=6)],
            'reservations': [],
        }})
        self.login()

    def test_help_content_is_public_but_updates_require_admin_and_current_revision(self):
        document = self.client.get('/api/content/faqs').json['content']
        self.assertEqual(document['revision'], 1)
        self.assertNotIn('_notificationOutbox', document)
        self.assertEqual(self.client.put('/api/admin/maintenance/content/faqs', json={'data': [], 'revision': 1}).status_code, 401)
        self.login()
        payload = {'data': [{'id': 'test', 'question': 'A new question?', 'answer': 'A new answer.'}], 'revision': document['revision']}
        self.assertEqual(self.mutate('put', '/api/admin/maintenance/content/faqs', payload).status_code, 403)
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.admin_role}})
        self.assertEqual(self.mutate('put', '/api/admin/maintenance/content/faqs', {**payload, 'data': []}).status_code, 400)
        response = self.mutate('put', '/api/admin/maintenance/content/faqs', payload)
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json['content']['revision'], 2)
        self.assertEqual(self.mutate('put', '/api/admin/maintenance/content/faqs', payload).status_code, 409)
        self.assertEqual(self.client.get('/api/content/faqs').json['content']['data'], payload['data'])
        support = self.client.get('/api/content/support').json['content']
        updated = {**support['data'], 'hours': 'Weekdays, 10 AM–5 PM'}
        response = self.mutate('put', '/api/admin/maintenance/content/support', {'data': updated, 'revision': support['revision']})
        self.assertEqual(response.status_code, 200, response.json)
        ensure_indexes(self.db)
        self.assertEqual(self.client.get('/api/content/faqs').json['content']['data'], payload['data'])
        self.assertEqual(self.client.get('/api/content/support').json['content']['data'], updated)

    def test_policy_publication_preserves_history_and_rejects_stale_acceptance(self):
        self.login()
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.admin_role}})
        for kind in ('account', 'order', 'privacy', 'shipping', 'returns'):
            old = self.client.get('/api/policies/' + kind).json['policy']
            payload = {'title': old['title'], 'body': old['body'] + '\n\nUpdated store information.', 'version': old['_id']}
            response = self.mutate('put', '/api/admin/maintenance/policies/' + kind, payload)
            self.assertEqual(response.status_code, 200, response.json)
            self.assertNotEqual(response.json['policy']['_id'], old['_id'])
            self.assertEqual(self.mutate('put', '/api/admin/maintenance/policies/' + kind, payload).status_code, 409)
            self.assertEqual(self.db.policy_versions.find_one({'_id': ObjectId(old['_id'])})['body'], old['body'])
            if kind == 'order':
                from app.policies import acceptance
                from app.admin_validation import FieldValidationError
                with self.app.app_context():
                    with self.assertRaises(FieldValidationError):
                        acceptance({'termsAccepted': True, 'termsVersion': old['_id']}, 'order')
                    consent = acceptance({'termsAccepted': True, 'termsVersion': response.json['policy']['_id']}, 'order')
                    self.assertEqual(str(consent['version']), response.json['policy']['_id'])
        ensure_indexes(self.db)
        self.assertEqual(self.client.get('/api/policies/returns').json['policy']['body'], payload['body'])

    def test_distributed_login_attempts_also_have_an_account_budget(self):
        from concurrent.futures import ThreadPoolExecutor
        def attempt(index):
            return self.app.test_client().post('/api/auth/login', json={'username': 'integration-user', 'password': ''},
                environ_overrides={'REMOTE_ADDR': f'192.0.2.{index + 1}'}).status_code
        with ThreadPoolExecutor(max_workers=12) as pool:
            self.assertEqual(list(pool.map(attempt, range(60))), [400] * 60)
        response = self.client.post('/api/auth/login', json={'username': 'integration-user', 'password': 'Example-123!'},
            environ_overrides={'REMOTE_ADDR': '192.0.2.100'})
        self.assertEqual(response.status_code, 429)

    def test_concurrent_workers_share_an_atomic_sliding_window(self):
        from concurrent.futures import ThreadPoolExecutor
        from flask import Flask
        from app.rate_limits import consume
        second_worker = Flask('second-worker')
        second_worker.db = self.db
        def attempt(index):
            worker = self.app if index % 2 else second_worker
            with worker.app_context():
                response = consume('concurrency-test', 'same-account', 7, 60)
                return 200 if response is None else response.status_code
        with ThreadPoolExecutor(max_workers=12) as pool:
            statuses = list(pool.map(attempt, range(30)))
        self.assertEqual(statuses.count(200), 7)
        self.assertEqual(statuses.count(429), 23)
        record = self.db.rate_limits.find_one({})
        self.assertEqual(len(record['reservations']), 7)
        self.assertTrue(all(
            isinstance(value['at'], datetime) and value['id']
            for value in record['reservations']
        ))

    def test_error_preflight_head_and_missing_routes_share_ip_budget(self):
        with patch('app.rate_limits.IP_POLICIES', (('ip:test', 4, 60),)):
            self.assertEqual(self.client.get('/api/health').status_code, 200)
            self.assertEqual(self.client.head('/api/health').status_code, 200)
            self.assertEqual(self.client.options('/api/auth/login').status_code, 200)
            self.assertEqual(self.client.post('/api/auth/login/', data='[]', content_type='application/json').status_code, 400)
            self.assertEqual(self.client.get('/api/not-a-route', headers={'X-Forwarded-For': '192.0.2.1'}).status_code, 429)
            self.assertEqual(self.client.get('/static/uploads/missing.png').status_code, 429)

    def test_private_attachments_enforce_ownership_on_every_url_alias(self):
        from app.uploads import save_image
        with self.app.app_context():
            proof = save_image(VALID_PNG, 'payment_proofs')
            receipt = save_image(VALID_PNG, 'receipts')
            public = save_image(VALID_PNG, 'products')
        self.db.orders.insert_one({'userId': self.uid, 'items': [], 'paymentProof': proof, 'receiptProof': receipt})
        anonymous = self.app.test_client()
        self.login()
        for path in (proof, receipt):
            filename = path.removeprefix('/static/uploads/')
            for prefix in ('/static/uploads/', '/uploads/', '/api/products/static/uploads/'):
                url = prefix + filename
                self.assertEqual(anonymous.get(url).status_code, 404, url)
                response = self.client.get(url)
                self.addCleanup(response.close)
                self.assertEqual(response.status_code, 200, url)
                self.assertEqual(response.headers['Cache-Control'], 'private, no-store')
                response.close()
                self.db.users.update_one({'_id': self.uid}, {'$set': {'username': 'other-customer'}})
                self.db.orders.update_many({}, {'$set': {'userId': ObjectId()}})
                self.assertEqual(self.client.get(url).status_code, 404)
                self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.admin_role}})
                response = self.client.get(url)
                self.addCleanup(response.close)
                self.assertEqual(response.status_code, 200)
                response.close()
                self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.customer_role}})
                self.db.orders.update_many({}, {'$set': {'userId': self.uid}})
        response = anonymous.get(public)
        self.addCleanup(response.close)
        self.assertEqual(response.status_code, 200)
        response.close()
        self.db.users.update_one({'_id': self.uid}, {'$set': {'isActive': False}})
        self.assertEqual(self.client.get(proof).status_code, 404)
        self.assertEqual(self.client.get('/static/uploads/receipts/orphan.png').status_code, 404)

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
        self.assertNotIn('Clear-Site-Data', restored_response.headers)
        self.assertEqual(restored_response.headers['Cache-Control'], 'no-store')
        self.assertEqual(self.client.post('/api/auth/logout').status_code, 403)
        self.assertEqual(self.mutate('post', '/api/auth/logout').status_code, 200)
        self.assertEqual(restored.get('/api/auth/session').json, {'authenticated': False, 'user': None})
        self.assertEqual(restored.get(f'/api/cart/{self.uid}').status_code, 401)
        self.login()
        self.db.sessions.update_many({}, {'$set': {'expiresAt': datetime.utcnow() - timedelta(seconds=1)}})
        self.assertEqual(self.client.get('/api/auth/session').json, {'authenticated': False, 'user': None})
        self.login()
        self.db.users.update_one({'_id': self.uid}, {'$set': {'password': hash_password('Changed-123!')}})
        self.assertEqual(self.client.get('/api/auth/session').json, {'authenticated': False, 'user': None})

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
                   'shippingAddress': self.address, 'paymentMethod': 'gcash', 'total': .01, **consent_payload(self.client, 'order')}
        first = self.mutate('post', '/api/orders', payload)
        self.assertEqual(first.status_code, 201, first.json)
        stamp = datetime.fromisoformat(first.json['order']['createdAt'])
        self.assertLess(abs((stamp.replace(tzinfo=None) - datetime.utcnow()).total_seconds()), 10)
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
                'paymentProof': (io.BytesIO(VALID_PNG), 'proof.png')}, headers={'X-CSRF-Token': self.csrf})
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
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.admin_role}})
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

    def begin_checkout(self):
        response = self.mutate('put', '/api/checkout', {'items': [{'id': str(self.pid), 'qty': 2}]})
        self.assertEqual(response.status_code, 200, response.json)
        return response.json['checkout']['checkoutId']

    def order_payload(self, checkout_id):
        return {'userId': str(self.uid), 'checkoutId': checkout_id, 'items': [{'id': str(self.pid), 'qty': 2}],
                'shippingAddress': self.address, 'paymentMethod': 'gcash', 'total': .01, **consent_payload(self.client, 'order')}

    def test_fulfillment_delivery_photo_and_duplicate_confirmation(self):
        self.login()
        created = self.mutate('post', '/api/orders', self.order_payload(self.begin_checkout()))
        self.assertEqual(created.status_code, 201, created.json)
        oid = created.json['orderId']
        self.assertEqual(self.mutate('put', f'/api/admin/orders/{oid}', {'status': 'confirmed'}).status_code, 403)
        proof = self.client.post('/api/orders/upload-payment-proof', data={'orderId': oid, 'userId': str(self.uid),
            'paymentProof': (io.BytesIO(VALID_PNG), 'proof.png')}, headers={'X-CSRF-Token': self.csrf})
        self.assertEqual(proof.status_code, 200, proof.json)
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.admin_role}})
        self.assertEqual(self.mutate('put', f'/api/admin/orders/{oid}', {'status': 'shipped', 'trackingNumber': '123456789012'}).status_code, 400)
        for status in ('confirmed', 'processing'):
            response = self.mutate('put', f'/api/admin/orders/{oid}', {'status': status})
            self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(self.mutate('put', f'/api/admin/orders/{oid}', {'status': 'shipped', 'trackingNumber': 'bad'}).status_code, 400)
        self.assertEqual(self.mutate('put', f'/api/admin/orders/{oid}', {'status': 'shipped', 'trackingNumber': '123456789012'}).status_code, 200)
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.customer_role}})
        self.assertEqual(self.mutate('put', f'/api/orders/{oid}/confirm-receipt', {'userId': str(self.uid), 'proofImage': 'bad data'}).status_code, 400)
        data = {'userId': str(self.uid), 'proofImage': 'data:image/png;base64,' + base64.b64encode(VALID_PNG).decode()}
        for _ in range(2):
            response = self.mutate('put', f'/api/orders/{oid}/confirm-receipt', data)
            self.assertEqual(response.status_code, 200, response.json)
        order = self.db.orders.find_one({'_id': ObjectId(oid)})
        self.assertEqual(order['status'], 'completed')
        self.assertTrue(order['receiptProof'].endswith('.png'))
        self.assertEqual(len(list((Path(self.tmp.name) / 'receipts').iterdir())), 1)
        self.assertEqual(self.db.products.find_one({'_id': self.pid})['stock'], 3)
        notices = list(self.db.notifications.find({'userId': self.uid, 'audience': 'personal', 'eventKey': {'$regex': f'^order:{oid}:'}}))
        self.assertEqual({notice['eventKey'].rsplit(':', 1)[-1] for notice in notices}, {'created', 'payment', 'confirmed', 'processing', 'shipped', 'completed'})
        self.assertEqual(len(notices), 6)
        self.assertTrue(all(notice['href'] == f'/order-history?order={oid}' for notice in notices))

    def test_stale_checkout_tabs_and_out_of_order_autosaves(self):
        self.login()
        first, second = self.begin_checkout(), self.begin_checkout()
        self.assertNotEqual(first, second)
        self.assertEqual(self.mutate('patch', '/api/checkout', {'checkoutId': first, 'shippingAddress': self.address}).status_code, 409)
        self.assertEqual(self.mutate('post', '/api/orders', self.order_payload(first)).status_code, 409)
        editor = str(uuid4())
        for version, street in ((2, 'Latest street'), (1, 'Stale street'), (2, 'Duplicate stale street')):
            response = self.mutate('patch', '/api/checkout', {'checkoutId': second, 'editorId': editor, 'editVersion': version,
                'shippingAddress': {**self.address, 'street': street}})
            self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(self.client.get('/api/checkout').json['checkout']['shippingAddress']['street'], 'Latest street')

    def test_discount_quote_scope_expiry_and_idempotent_order_snapshot(self):
        self.login()
        self.db.products.update_one({'_id': self.pid}, {'$set': {'category': 'Shirts'}})
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.admin_role}})
        response = self.mutate('post', '/api/admin/discounts', {'code': 'save10', 'discountType': 'percentage', 'value': 10, 'minPurchase': 200, 'applyTo': 'category', 'category': 'Shirts'})
        self.assertEqual(response.status_code, 201, response.json)
        self.db.discounts.insert_many([
            {'code': 'EXPIRED', 'discountType': 'fixed', 'value': 20, 'validUntil': '2020-01-01'},
            {'code': 'MINIMUM', 'discountType': 'fixed', 'value': 20, 'minPurchase': 500},
            {'code': 'OTHER', 'discountType': 'fixed', 'value': 20, 'applyTo': 'category', 'category': 'Dresses'},
            {'code': 'BIG', 'discountType': 'fixed', 'value': 999},
        ])
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.customer_role}})
        cid = self.begin_checkout()
        for code in ('EXPIRED', 'MINIMUM', 'OTHER', 'MISSING'):
            self.assertEqual(self.mutate('post', '/api/checkout/quote', {'checkoutId': cid, 'province': 'Cebu', 'discountCode': code}).status_code, 400)
        response = self.mutate('post', '/api/checkout/quote', {'checkoutId': cid, 'province': 'Cebu', 'discountCode': 'save10'})
        self.assertEqual(response.status_code, 200, response.json)
        quote = response.json['quote']
        self.assertEqual((quote['discountCode'], quote['discountAmount'], quote['total']), ('SAVE10', 25.1, 345.9))
        capped = self.mutate('post', '/api/checkout/quote', {'checkoutId': cid, 'province': 'Cebu', 'discountCode': 'BIG'}).json['quote']
        self.assertEqual((capped['discountAmount'], capped['total']), (251, 120))
        self.assertEqual(self.mutate('patch', '/api/checkout', {'checkoutId': cid, 'discountCode': 'SAVE10'}).status_code, 200)
        self.assertEqual(self.client.get('/api/checkout').json['checkout']['discountCode'], 'SAVE10')
        payload = {**self.order_payload(cid), 'discountCode': 'SAVE10', 'discountAmount': 999}
        response = self.mutate('post', '/api/orders', payload)
        self.assertEqual(response.status_code, 201, response.json)
        self.assertEqual(response.json['order']['discountAmount'], 25.1)
        self.db.products.update_one({'_id': self.pid}, {'$set': {'stock': 0, 'price': 999}})
        self.db.discounts.update_one({'code': 'SAVE10'}, {'$set': {'isActive': False}})
        restored = self.mutate('post', '/api/orders', {**payload, 'shippingAddress': {**self.address, 'street': 'Changed'}})
        self.assertEqual(restored.status_code, 200, restored.json)
        self.assertEqual(restored.json['order']['total'], 345.9)
        self.assertEqual(restored.json['order']['shippingAddress']['street'], self.address['street'])
        self.assertEqual(self.db.orders.count_documents({}), 1)

    def test_payment_settings_upload_enable_disable_and_authorization(self):
        public = self.client.get('/api/payments')
        self.assertEqual(public.status_code, 200)
        self.assertFalse(public.json['methods']['gcash']['enabled'])
        self.login()
        self.assertEqual(self.mutate('put', '/api/admin/settings/payments/gcash', {}).status_code, 403)
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.admin_role}})
        headers = {'X-CSRF-Token': self.csrf}
        response = self.client.put('/api/admin/settings/payments/gcash', data={'merchantName': 'Test merchant', 'enabled': 'true'}, headers=headers)
        self.assertEqual(response.status_code, 400)
        response = self.client.put('/api/admin/settings/payments/gcash', data={'merchantName': 'Test merchant', 'enabled': 'true',
            'image': (io.BytesIO(b'not an image'), 'fake.png')}, headers=headers)
        self.assertEqual(response.status_code, 400)
        response = self.client.put('/api/admin/settings/payments/gcash', data={'merchantName': 'Test merchant', 'enabled': 'true',
            'image': (io.BytesIO(VALID_PNG), 'qr.png')}, headers=headers)
        self.assertEqual(response.status_code, 200, response.json)
        method = self.client.get('/api/payments').json['methods']['gcash']
        self.assertTrue(method['enabled'])
        self.assertEqual(method['merchantName'], 'Test merchant')
        self.assertTrue((Path(self.tmp.name) / method['qrUrl'].removeprefix('/static/uploads/')).is_file())
        self.assertEqual(self.client.put('/api/admin/settings/payments/gcash', data={'merchantName': 'Test merchant', 'enabled': 'false'}, headers=headers).status_code, 200)
        self.assertFalse(self.client.get('/api/payments').json['methods']['gcash']['enabled'])

    def test_profile_validation_address_defaults_and_avatar_storage(self):
        self.login()
        path = f'/api/users/profile/{self.uid}'
        for value in ({'phone': {'$ne': None}}, {'gender': 'invalid'}, {'dob': '2999-01-01'}, {'addresses': {}}):
            self.assertEqual(self.mutate('put', path, value).status_code, 400)
        picture = 'data:image/png;base64,' + base64.b64encode(VALID_PNG).decode()
        response = self.mutate('put', path, {'firstName': ' Alex ', 'profilePic': picture, 'isAdmin': True})
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json['user']['firstName'], 'Alex')
        self.assertFalse(response.json['user']['isAdmin'])
        self.assertTrue(response.json['user']['profilePic'].startswith('/static/uploads/avatars/'))
        values = [{**self.address, 'id': 'one', 'isDefault': True}, {**self.address, 'id': 'two', 'isDefault': True}]
        response = self.mutate('put', path + '/address', {'addresses': values})
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(sum(address['isDefault'] for address in response.json['addresses']), 1)
        self.assertEqual(self.mutate('put', path + '/address', {'addresses': response.json['addresses']}).status_code, 200)

    def test_roles_are_database_owned_and_access_changes_apply_to_existing_sessions(self):
        self.login()
        self.assertEqual(self.client.get('/api/admin/roles').status_code, 403)
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.admin_role}})
        values = {'code': 'store_staff', 'label': 'Store staff', 'active': True, 'permissions': ['admin.access']}
        response = self.mutate('post', '/api/admin/roles', values)
        self.assertEqual(response.status_code, 201, response.json)
        role = self.db.roles.find_one({'code': 'store_staff'})
        self.assertEqual(self.mutate('post', '/api/admin/roles', values).status_code, 409)
        self.assertEqual(self.mutate('post', '/api/admin/roles', {**values, 'code': 'bad_permission', 'permissions': ['superuser']}).status_code, 400)
        account = {'username': 'role_staff', 'email': 'staff@example.invalid', 'password': 'Example-123!', 'roleId': str(role['_id'])}
        self.assertEqual(self.mutate('post', '/api/admin/users', account).status_code, 201)
        staff = self.db.users.find_one({'username': 'role_staff'})
        self.assertEqual(staff['roleId'], role['_id'])
        self.assertNotIn('isAdmin', staff)
        other = self.app.test_client()
        login = other.post('/api/auth/login', json={'username': account['username'], 'password': account['password'], 'captcha': captcha_payload(other)})
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json['user']['roleLabel'], 'Store staff')
        self.assertEqual(other.get('/api/admin/stats').status_code, 200)
        staff_headers = {'X-CSRF-Token': login.json['csrfToken']}
        self.assertEqual(other.put(f"/api/admin/roles/{role['_id']}", json={**values, 'permissions': []}, headers=staff_headers).status_code, 400)
        self.assertEqual(self.mutate('delete', f"/api/admin/roles/{role['_id']}").status_code, 409)
        self.assertEqual(self.mutate('delete', f'/api/admin/roles/{self.admin_role}').status_code, 409)
        self.assertEqual(self.mutate('put', f"/api/admin/roles/{role['_id']}", {**values, 'permissions': []}).status_code, 200)
        # A stale browser session and historical boolean cannot override its DB role.
        self.db.users.update_one({'_id': staff['_id']}, {'$set': {'isAdmin': True}})
        self.assertEqual(other.get('/api/admin/stats').status_code, 403)
        self.assertFalse(other.get('/api/auth/session').json['user']['isAdmin'])
        self.assertEqual(self.mutate('put', f'/api/admin/users/{self.uid}', {'roleId': str(role['_id'])}).status_code, 400)
        self.assertEqual(self.mutate('put', f"/api/admin/roles/{role['_id']}", {**values, 'active': False}).status_code, 200)
        self.assertEqual(self.mutate('post', '/api/admin/users', {**account, 'username': 'another_user', 'email': 'another@example.invalid'}).status_code, 400)
        self.assertEqual(self.mutate('put', f"/api/admin/users/{staff['_id']}", {'roleId': str(self.customer_role)}).status_code, 200)
        self.assertEqual(self.mutate('delete', f"/api/admin/roles/{role['_id']}").status_code, 200)

    def test_role_migration_is_idempotent_and_preserves_explicit_assignments(self):
        from app.access import ensure_access_data, access_fields
        admin_id = self.db.users.insert_one({'username': 'legacy_admin', 'isAdmin': True}).inserted_id
        customer_id = self.db.users.insert_one({'username': 'legacy_customer'}).inserted_id
        self.db.users.update_one({'_id': self.uid}, {'$set': {'isAdmin': True}})
        self.db.roles.update_one({'_id': self.admin_role}, {'$set': {'label': 'Store owner'}})
        ensure_access_data(self.db)
        ensure_access_data(self.db)
        self.assertEqual(self.db.users.find_one({'_id': admin_id})['roleId'], self.admin_role)
        self.assertEqual(self.db.users.find_one({'_id': customer_id})['roleId'], self.customer_role)
        self.assertEqual(self.db.users.find_one({'_id': self.uid})['roleId'], self.customer_role)
        self.assertNotIn('isAdmin', self.db.users.find_one({'_id': admin_id}))
        self.assertEqual(self.db.roles.find_one({'_id': self.admin_role})['label'], 'Store owner')
        with self.app.app_context():
            self.assertFalse(access_fields({'roleId': ObjectId(), 'isAdmin': True})['isAdmin'])

    def test_account_options_and_profile_field_errors_are_database_driven(self):
        self.login()
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.admin_role}})
        path = '/api/admin/account-options'
        for values in ([], ['Repeated', 'repeated'], ['x' * 31], {'$ne': None}):
            self.assertEqual(self.mutate('put', path, {'genders': values}).status_code, 400)
        self.assertEqual(self.mutate('put', path, {'genders': ['Custom choice']}).status_code, 200)
        profile_path = f'/api/users/profile/{self.uid}'
        self.assertEqual(self.client.get(profile_path).json['options']['genders'], ['Custom choice'])
        self.assertEqual(self.mutate('put', profile_path, {'gender': 'Custom choice'}).status_code, 200)
        self.assertEqual(self.mutate('put', path, {'genders': ['Different choice']}).status_code, 200)
        self.assertEqual(self.mutate('put', profile_path, {'gender': 'Custom choice'}).status_code, 200)
        response = self.mutate('put', profile_path, {'phone': '123', 'dob': '2099-01-01', 'gender': 'Invalid', 'firstName': 'x' * 81})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.json['fields']), {'phone', 'dob', 'gender', 'firstName'})
        self.assertNotIn('phone', self.db.users.find_one({'_id': self.uid}))
        self.assertEqual(self.mutate('put', profile_path, {'gender': ''}).status_code, 200)

    def test_registration_admin_product_crud_and_input_validation(self):
        for path, payload in [('/api/auth/login', {'username': {'$ne': None}, 'password': 'Example-123!'}),
                              ('/api/auth/check-email', {'email': {}}), ('/api/auth/register', {'username': 'x', 'email': 'bad', 'password': 'short'})]:
            self.assertEqual(self.client.post(path, json=payload).status_code, 400)
        response = self.client.post('/api/auth/register', json=registration_payload(self.client, {'username': 'new_user', 'email': ' NEW@example.invalid ', 'password': 'Example-123!'}))
        self.assertEqual(response.status_code, 201, response.json)
        self.assertEqual(self.db.users.find_one({'username': 'new_user'})['email'], 'new@example.invalid')
        self.login()
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.admin_role}})
        self.assertEqual(self.mutate('put', f'/api/admin/users/{self.uid}', {'isAdmin': False}).status_code, 400)
        self.assertEqual(self.mutate('put', f'/api/admin/users/{self.uid}', {'isActive': 'false'}).status_code, 400)
        headers = {'X-CSRF-Token': self.csrf}
        response = self.client.post('/api/products', data={'name': ' Jacket ', 'category': 'Outerwear', 'price': '300.50', 'stock': '2',
            'image': (io.BytesIO(VALID_PNG), 'jacket.png')}, headers=headers)
        self.assertEqual(response.status_code, 201, response.json)
        product = response.json['product']
        self.assertEqual(product['name'], 'Jacket')
        self.assertEqual(self.client.put('/api/products/' + product['_id'], data={'stock': '3', 'price': '320.25'}, headers=headers).status_code, 200)
        self.assertEqual(self.client.get('/api/products/' + product['_id']).json['product']['price'], 320.25)
        self.assertEqual(self.mutate('delete', '/api/products/' + product['_id']).status_code, 200)
        self.assertEqual(self.client.get('/api/products/' + product['_id']).status_code, 404)

    def test_discount_codes_are_unique_in_the_database(self):
        self.db.discounts.insert_one({'code': 'UNIQUE'})
        with self.assertRaises(DuplicateKeyError):
            self.db.discounts.insert_one({'code': 'UNIQUE'})
        self.assertTrue(self.db.discounts.index_information()['code_1']['unique'])

    def test_email_recovery_code_is_single_use_and_revokes_old_sessions(self):
        self.login()
        details = {'username': 'integration-user', 'email': 'test@example.invalid'}
        with patch.dict('os.environ', {'SMTP_HOST': 'smtp.example.invalid', 'SMTP_FROM': 'store@example.invalid'}), patch('app.routes.auth.smtplib.SMTP') as smtp:
            response = self.client.post('/api/auth/request-password-reset', json=details)
            self.assertEqual(response.status_code, 200, response.json)
            mail = smtp.return_value.__enter__.return_value.send_message.call_args.args[0]
            token = mail.get_content().split('Your password reset code is: ', 1)[1].split()[0]
        reset = {**details, 'new_password': 'Changed-password-123!', 'token': 'wrong'}
        self.assertEqual(self.client.post('/api/auth/forgot-password', json=reset).status_code, 400)
        reset['token'] = token
        self.assertEqual(self.client.post('/api/auth/forgot-password', json=reset).status_code, 200)
        self.assertEqual(self.db.notifications.count_documents({'userId': self.uid, 'title': 'Password changed'}), 1)
        self.assertEqual(self.client.get('/api/auth/session').json, {'authenticated': False, 'user': None})
        self.assertEqual(self.client.post('/api/auth/forgot-password', json=reset).status_code, 400)
        self.assertEqual(self.client.post('/api/auth/login', json={**details, 'password': 'Changed-password-123!', 'captcha': captcha_payload(self.client)}).status_code, 200)

    def test_stock_changes_use_displayed_cart_quantities_and_skip_unavailable_selections(self):
        self.login()
        unavailable, archived = ObjectId(), ObjectId()
        self.db.products.update_one({'_id': self.pid}, {'$set': {'stock': 2}})
        self.db.products.insert_many([
            {'_id': unavailable, 'name': 'Sold shirt', 'price': 100, 'stock': 0, 'is_active': True},
            {'_id': archived, 'name': 'Archived shirt', 'price': 100, 'stock': 5, 'is_active': False},
        ])
        self.db.carts.insert_one({'user_id': self.uid, 'items': [
            {'product_id': self.pid, 'qty': 5, 'selected': True},
            {'product_id': unavailable, 'qty': 1, 'selected': True},
            {'product_id': archived, 'qty': 1, 'selected': True},
        ]})
        cart = self.client.get(f'/api/cart/{self.uid}').json['cart']
        adjusted = next(item for item in cart if item['id'] == str(self.pid))
        self.assertEqual((adjusted['qty'], adjusted['requestedQty'], adjusted['quantityAdjusted']), (2, 5, True))
        response = self.mutate('put', '/api/checkout', {'fromCart': True})
        self.assertEqual(response.status_code, 200, response.json)
        draft = response.json['checkout']
        self.assertEqual([(item['id'], item['qty']) for item in draft['items']], [(str(self.pid), 2)])
        payload = {'userId': str(self.uid), 'checkoutId': draft['checkoutId'], 'items': [{'id': str(self.pid), 'qty': 2}],
                   'shippingAddress': self.address, 'paymentMethod': 'gcash', 'total': 1, **consent_payload(self.client, 'order')}
        order = self.mutate('post', '/api/orders', payload)
        self.assertEqual(order.status_code, 201, order.json)
        self.assertEqual(order.json['subtotal'], 251)

    def test_new_checkout_discards_old_editor_versions_and_rejects_old_tabs(self):
        self.login()
        body = {'items': [{'id': str(self.pid), 'qty': 1}]}
        first = self.mutate('put', '/api/checkout', body).json['checkout']['checkoutId']
        self.db.checkouts.update_one({'userId': self.uid}, {'$set': {'editorVersions': {'old': 50}}})
        second = self.mutate('put', '/api/checkout', body).json['checkout']['checkoutId']
        self.assertNotEqual(first, second)
        self.assertNotIn('editorVersions', self.db.checkouts.find_one({'userId': self.uid}))
        self.assertEqual(self.mutate('patch', '/api/checkout', {'checkoutId': first, 'shippingAddress': self.address}).status_code, 409)

    def test_delivery_auto_completion_records_completion_time_and_respects_manual_receipts(self):
        self.login()
        old, fresh, received = ObjectId(), ObjectId(), ObjectId()
        base = {'userId': self.uid, 'items': [], 'status': 'shipped', 'createdAt': datetime.utcnow()}
        self.db.orders.insert_many([
            {**base, '_id': old, 'shippedAt': datetime.utcnow() - timedelta(days=11)},
            {**base, '_id': fresh, 'shippedAt': datetime.utcnow()},
            {**base, '_id': received, 'shippedAt': datetime.utcnow() - timedelta(days=11), 'receiptConfirmedAt': datetime.utcnow()},
        ])
        response = self.client.get(f'/api/orders/user/{self.uid}')
        self.assertEqual(response.status_code, 200, response.json)
        complete = self.db.orders.find_one({'_id': old})
        self.assertEqual(complete['status'], 'completed')
        self.assertIsInstance(complete['completedAt'], datetime)
        self.assertIn('autoCompletedAt', complete)
        self.assertEqual(self.db.orders.find_one({'_id': fresh})['status'], 'shipped')
        self.assertNotIn('autoCompletedAt', self.db.orders.find_one({'_id': received}))
        self.assertEqual(self.db.notifications.count_documents({'userId': self.uid, 'eventKey': f'order:{old}:completed'}), 1)
        self.assertIn('completed automatically', self.db.notifications.find_one({'userId': self.uid, 'eventKey': f'order:{old}:completed'})['message'])

    def test_notification_delivery_retries_and_never_turns_a_committed_order_into_failure(self):
        from app.notifications import OUTBOX, order_event
        from pymongo.errors import ConnectionFailure
        self.login()
        checkout = self.begin_checkout()
        with patch('app.notifications.deliver_source', side_effect=ConnectionFailure('simulated notification outage')):
            response = self.mutate('post', '/api/orders', self.order_payload(checkout))
        self.assertEqual(response.status_code, 201, response.json)
        self.assertNotIn(OUTBOX, response.get_data(as_text=True))
        order_id = ObjectId(response.json['orderId'])
        order = self.db.orders.find_one({'_id': order_id})
        self.assertEqual(len(order[OUTBOX]), 1)
        inbox = self.client.get('/api/notifications')
        self.assertEqual(inbox.status_code, 200, inbox.json)
        self.assertEqual(inbox.json['unreadCount'], 1)
        self.assertEqual(self.db.orders.find_one({'_id': order_id})[OUTBOX], [])
        # Replay after a worker crash between recipient insertion and acknowledgement.
        self.db.orders.update_one({'_id': order_id}, {'$push': {OUTBOX: order_event(order, 'created')}})
        self.assertEqual(self.client.get('/api/notifications').json['unreadCount'], 1)
        self.assertEqual(self.db.notifications.count_documents({'userId': self.uid}), 1)
        self.assertEqual(self.mutate('post', '/api/orders', self.order_payload(checkout)).status_code, 200)
        self.assertEqual(self.db.notifications.count_documents({'userId': self.uid}), 1)

    def test_notification_inbox_ownership_pagination_read_state_and_revoked_admin_scope(self):
        self.login()
        now = datetime.utcnow()
        documents = [{'userId': self.uid, 'eventKey': f'test:{index}', 'audience': 'personal', 'category': 'orders',
                      'title': f'Update {index}', 'message': 'Test update', 'href': '/order-history?order=' + str(ObjectId()),
                      'createdAt': now, 'eventAt': now, 'readAt': None} for index in range(25)]
        self.db.notifications.insert_many(documents)
        other_id = ObjectId()
        foreign = self.db.notifications.insert_one({**documents[0], '_id': ObjectId(), 'userId': other_id}).inserted_id
        admin_notice = self.db.notifications.insert_one({**documents[0], '_id': ObjectId(), 'eventKey': 'admin:test', 'audience': 'admin'}).inserted_id
        first = self.client.get('/api/notifications?limit=10').json
        self.assertEqual(first['unreadCount'], 25)
        self.assertEqual(len(first['notifications']), 10)
        self.assertTrue(first['hasMore'])
        second = self.client.get('/api/notifications?limit=10&cursor=' + first['nextCursor']).json
        self.assertFalse({item['_id'] for item in first['notifications']} & {item['_id'] for item in second['notifications']})
        own = first['notifications'][0]['_id']
        self.assertEqual(self.client.patch(f'/api/notifications/{own}/read', json={'read': True}).status_code, 403)
        for target in (foreign, admin_notice):
            self.assertEqual(self.mutate('patch', f'/api/notifications/{target}/read', {'read': True}).status_code, 404)
        self.assertEqual(self.mutate('patch', f'/api/notifications/{own}/read', {'read': 'true'}).status_code, 400)
        self.assertEqual(self.mutate('patch', f'/api/notifications/{own}/read', {'read': True}).status_code, 200)
        self.assertEqual(self.client.get('/api/notifications?unread=true').json['unreadCount'], 24)
        self.assertEqual(self.mutate('patch', f'/api/notifications/{own}/read', {'read': False}).status_code, 200)
        self.assertEqual(self.client.get('/api/notifications').json['unreadCount'], 25)
        self.assertEqual(self.mutate('post', '/api/notifications/read-all', {'before': first['asOf']}).status_code, 200)
        self.assertEqual(self.client.get('/api/notifications').json['unreadCount'], 0)
        self.assertIsNone(self.db.notifications.find_one({'_id': admin_notice})['readAt'])
        late_id = self.db.notifications.insert_one({**documents[0], '_id': ObjectId(), 'eventKey': 'later:arrival', 'createdAt': datetime.utcnow() + timedelta(seconds=1)}).inserted_id
        self.assertEqual(self.mutate('post', '/api/notifications/read-all', {'before': first['asOf']}).status_code, 200)
        self.assertEqual(self.client.get('/api/notifications').json['unreadCount'], 1)
        self.assertEqual(self.mutate('patch', f'/api/notifications/{late_id}/read', {'read': True}).status_code, 200)
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.admin_role}})
        self.assertEqual(self.client.get('/api/notifications').json['unreadCount'], 1)
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.customer_role}})
        self.assertEqual(self.client.get('/api/notifications').json['unreadCount'], 0)
        for query in ('limit=0', 'limit=51', 'limit=abc', 'unread=bad', 'category=private', 'cursor=bad'):
            self.assertEqual(self.client.get('/api/notifications?' + query).status_code, 400)
        self.assertEqual(self.mutate('post', '/api/notifications/read-all', {'before': 'bad'}).status_code, 400)
        self.assertEqual(self.client.post('/api/notifications', json={}).status_code, 405)

    def test_notifications_reach_admins_for_payment_and_stock_and_deduplicate_inventory_cycle(self):
        self.login()
        admin_id = self.db.users.insert_one({'username': 'notification_admin', 'roleId': self.admin_role, 'password': hash_password('Example-123!')}).inserted_id
        created = self.mutate('post', '/api/orders', self.order_payload(self.begin_checkout()))
        self.assertEqual(created.status_code, 201, created.json)
        order_id = created.json['orderId']
        self.assertEqual(self.db.notifications.count_documents({'userId': admin_id, 'title': 'New order placed'}), 1)
        def proof():
            return self.client.post('/api/orders/upload-payment-proof', data={'orderId': order_id, 'userId': str(self.uid),
                'paymentProof': (io.BytesIO(VALID_PNG), 'proof.png')}, headers={'X-CSRF-Token': self.csrf})
        self.assertEqual(proof().status_code, 200)
        self.assertEqual(proof().status_code, 200)
        self.assertEqual(self.db.notifications.count_documents({'userId': admin_id, 'title': 'Payment needs review'}), 1)
        self.assertEqual(self.db.notifications.count_documents({'userId': admin_id, 'title': 'Low stock'}), 1)
        notice = self.db.notifications.find_one({'userId': admin_id, 'title': 'Payment needs review'})
        self.assertEqual(notice['href'], '/admin/view-orders/' + order_id)
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.admin_role}})
        path = '/api/products/update-stock/' + str(self.pid)
        self.assertEqual(self.mutate('put', path, {'stock': 0}).status_code, 200)
        self.assertEqual(self.mutate('put', path, {'stock': 0}).status_code, 200)
        self.assertEqual(self.db.notifications.count_documents({'userId': admin_id, 'title': 'Product sold out'}), 1)
        self.assertEqual(self.mutate('put', path, {'stock': 10}).status_code, 200)
        self.assertEqual(self.mutate('put', path, {'stock': 4}).status_code, 200)
        self.assertEqual(self.db.notifications.count_documents({'userId': admin_id, 'title': 'Low stock'}), 2)

    def test_notifications_for_registration_contact_changes_and_admin_account_changes(self):
        registered = self.client.post('/api/auth/register', json=registration_payload(self.client, {'username': 'notice_user', 'email': 'notice@example.invalid', 'password': 'Example-123!'}))
        self.assertEqual(registered.status_code, 201, registered.json)
        created_id = ObjectId(registered.json['user_id'])
        self.assertEqual(self.db.notifications.count_documents({'userId': created_id, 'title': 'Welcome to Old Goods'}), 1)
        self.login()
        profile_path = f'/api/users/profile/{self.uid}'
        for _ in range(2):
            self.assertEqual(self.mutate('put', profile_path, {'phone': '09123456789'}).status_code, 200)
        self.assertEqual(self.db.notifications.count_documents({'userId': self.uid, 'title': 'Contact number changed'}), 1)
        self.db.users.update_one({'_id': self.uid}, {'$set': {'roleId': self.admin_role}})
        self.assertEqual(self.mutate('put', f'/api/admin/users/{created_id}', {'isActive': False}).status_code, 200)
        self.assertEqual(self.db.notifications.count_documents({'userId': created_id, 'title': 'Account settings changed'}), 1)
        role_values = {'code': 'notice_staff', 'label': 'Notice staff', 'active': True, 'permissions': []}
        self.assertEqual(self.mutate('post', '/api/admin/roles', role_values).status_code, 201)
        role_id = self.db.roles.find_one({'code': 'notice_staff'})['_id']
        self.assertEqual(self.mutate('put', f'/api/admin/users/{created_id}', {'roleId': str(role_id)}).status_code, 200)
        self.assertEqual(self.mutate('put', f'/api/admin/roles/{role_id}', {**role_values, 'permissions': ['admin.access']}).status_code, 200)
        self.assertEqual(self.db.notifications.count_documents({'userId': created_id, 'title': 'Account access updated'}), 1)
        payment = self.client.put('/api/admin/settings/payments/gcash', data={'merchantName': 'Notification merchant', 'enabled': 'true',
            'image': (io.BytesIO(VALID_PNG), 'qr.png')}, headers={'X-CSRF-Token': self.csrf})
        self.assertEqual(payment.status_code, 200, payment.json)
        self.assertEqual(self.db.notifications.count_documents({'userId': self.uid, 'title': 'Payment settings changed'}), 1)

    def test_liked_items_are_private_persistent_idempotent_and_csrf_protected(self):
        path = f'/api/favorites/{self.pid}'
        self.assertEqual(self.client.get('/api/favorites').status_code, 401)
        self.assertEqual(self.client.put(path).status_code, 401)
        self.login()
        self.assertEqual(self.client.put(path).status_code, 403)
        headers = {'X-CSRF-Token': self.csrf}
        for _ in range(2):
            self.assertEqual(self.client.put(path, headers=headers).status_code, 200)
        self.assertEqual(self.client.get('/api/favorites').json['productIds'], [str(self.pid)])
        self.assertEqual(self.db.favorites.count_documents({}), 1)
        relation = self.db.favorites.find_one({})
        self.assertEqual(relation['userId'], self.uid)
        self.assertEqual(relation['productId'], self.pid)
        self.assertNotIn('name', relation)
        with self.assertRaises(DuplicateKeyError):
            self.db.favorites.insert_one({'userId': self.uid, 'productId': self.pid, 'createdAt': datetime.utcnow()})
        second_session = self.app.test_client()
        self.login(second_session)
        self.assertEqual(second_session.get('/api/favorites').json['productIds'], [str(self.pid)])
        other_id = ObjectId()
        self.db.users.insert_one({'_id': other_id, 'username': 'another-user', 'password': hash_password('Example-123!'), 'roleId': self.customer_role})
        other = self.app.test_client()
        response = other.post('/api/auth/login', json={'username': 'another-user', 'password': 'Example-123!', 'captcha': captcha_payload(other)})
        self.assertEqual(response.status_code, 200, response.json)
        other_headers = {'X-CSRF-Token': response.json['csrfToken']}
        self.assertEqual(other.get('/api/favorites').json['productIds'], [])
        self.assertEqual(other.put(path, json={'userId': str(self.uid)}, headers=other_headers).status_code, 400)
        self.assertEqual(other.get('/api/favorites?userId=' + str(self.uid)).status_code, 400)
        self.assertEqual(other.delete(path, headers=other_headers).status_code, 200)
        self.assertEqual(self.db.favorites.count_documents({'userId': self.uid}), 1)
        for _ in range(2):
            self.assertEqual(second_session.delete(path, headers={'X-CSRF-Token': self.csrf}).status_code, 200)
        self.assertEqual(self.db.favorites.count_documents({}), 0)

    def test_liked_item_validation_concurrent_saves_and_product_cleanup(self):
        from concurrent.futures import ThreadPoolExecutor
        from app.models.product import ProductModel
        from app.schema import ensure_validators
        ensure_validators(self.db)
        self.login()
        headers = {'X-CSRF-Token': self.csrf}
        self.assertEqual(self.client.put('/api/favorites/not-an-id', headers=headers).status_code, 400)
        self.assertEqual(self.client.put('/api/favorites/' + str(ObjectId()), headers=headers).status_code, 404)
        self.db.products.update_one({'_id': self.pid}, {'$set': {'is_active': False}})
        path = '/api/favorites/' + str(self.pid)
        self.assertEqual(self.client.put(path, headers=headers).status_code, 404)
        self.db.products.update_one({'_id': self.pid}, {'$set': {'is_active': True, 'stock': 0}})
        cookie = self.client.get_cookie('oms_session').value
        def like(_):
            client = self.app.test_client()
            client.set_cookie('oms_session', cookie)
            return client.put(path, headers=headers).status_code
        with ThreadPoolExecutor(max_workers=8) as pool:
            self.assertEqual(list(pool.map(like, range(8))), [200] * 8)
        self.assertEqual(self.db.favorites.count_documents({}), 1)
        self.assertTrue(ProductModel(self.db).delete(self.pid))
        self.assertEqual(self.client.get('/api/favorites').json['productIds'], [])
        self.assertEqual(self.db.favorites.count_documents({}), 0)
