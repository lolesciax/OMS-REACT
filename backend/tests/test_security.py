"""Security checks that never contact the store database or send email."""
import io
import unittest
from unittest.mock import patch, MagicMock
from PIL import Image
from app import create_app
from app.uploads import sanitized_image
from image_fixtures import VALID_PNG


class SecurityTests(unittest.TestCase):
    def setUp(self):
        with patch('app.MongoClient', return_value=MagicMock()), patch.dict('os.environ', {
                'MONGODB_URI': 'mongodb://unused/test', 'CORS_ORIGINS': 'http://localhost:5173'}):
            self.app = create_app()
        self.client = self.app.test_client()

    def test_foreign_origins_cannot_login_register_or_mutate(self):
        for path in ('/api/auth/login', '/api/auth/register', '/api/auth/request-password-reset', '/api/products'):
            response = self.client.post(path, json={}, headers={'Origin': 'https://attacker.invalid'})
            self.assertEqual(response.status_code, 403, path)
        response = self.client.post('/api/auth/login', json={}, headers={'Sec-Fetch-Site': 'cross-site'})
        self.assertEqual(response.status_code, 403)
        # Rejected requests still consume the shared IP budget.
        self.assertTrue(self.app.db.rate_limits.find_one_and_update.called)

    def test_production_origin_validation_and_session_checks_do_not_clear_storage(self):
        with patch('app.MongoClient', return_value=MagicMock()), patch.dict('os.environ', {
                'MONGODB_URI': 'mongodb://unused/test', 'CORS_ORIGINS': 'https://thriftlyshop.vercel.app'}):
            app = create_app()
        client = app.test_client()
        response = client.post('/api/auth/check-email', json={'email': 'invalid'},
                               headers={'Origin': 'https://thriftlyshop.vercel.app'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.headers['Access-Control-Allow-Origin'], 'https://thriftlyshop.vercel.app')
        for origin in ('https://thriftlyshop.vercel.app.attacker.invalid', 'https://attacker.invalid'):
            self.assertEqual(client.post('/api/auth/login', json={}, headers={'Origin': origin}).status_code, 403)
        app.db.sessions.find_one.return_value = None
        response = client.get('/api/auth/session')
        self.assertEqual(response.status_code, 401)
        self.assertNotIn('Clear-Site-Data', response.headers)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')

    def test_security_headers_and_patch_preflight(self):
        response = self.client.get('/api/health')
        self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(response.headers['X-Frame-Options'], 'DENY')
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.assertIn("frame-ancestors 'none'", response.headers['Content-Security-Policy'])
        self.assertNotIn('Strict-Transport-Security', response.headers)
        response = self.client.get('/api/health', base_url='https://localhost')
        self.assertIn('Strict-Transport-Security', response.headers)
        response = self.client.options('/api/checkout', headers={'Origin': 'http://localhost:5173',
            'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'Content-Type,X-CSRF-Token'})
        self.assertIn('PATCH', response.headers['Access-Control-Allow-Methods'])
        self.assertNotIn('static', self.app.view_functions)

    def test_auth_budget_fails_closed_when_database_is_down(self):
        from pymongo.errors import ConnectionFailure
        self.app.db.rate_limits.find_one_and_update.side_effect = ConnectionFailure('private connection string')
        response = self.client.post('/api/auth/login', json={'username': 'someone', 'password': 'wrong'})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private connection', response.get_data(as_text=True))

    def test_session_and_logout_trailing_slashes_require_authentication(self):
        self.app.db.sessions.find_one.return_value = None
        for path, method in (('/api/auth/session/', 'get'), ('/api/auth/logout/', 'post')):
            self.assertEqual(getattr(self.client, method)(path).status_code, 401)

    def test_proxy_boundary_rejects_direct_spoofed_and_untrusted_peers(self):
        from flask import Flask, jsonify, request
        from app.proxy import ProxyBoundary
        token = 'test-proxy-secret-' * 3
        app = Flask('proxy-test')
        app.add_url_rule('/', view_func=lambda: jsonify(ip=request.remote_addr, host=request.host, scheme=request.scheme))
        app.wsgi_app = ProxyBoundary(app.wsgi_app, token)
        client = app.test_client()
        self.assertEqual(client.get('/').status_code, 403)
        self.assertEqual(client.get('/', headers={'X-OMS-Proxy-Token': 'wrong', 'X-Forwarded-For': '192.0.2.5'}).status_code, 403)
        headers = {'X-OMS-Proxy-Token': token, 'X-Forwarded-For': '192.0.2.5', 'X-Forwarded-Host': 'attacker.invalid', 'X-Forwarded-Proto': 'https'}
        self.assertEqual(client.get('/', headers=headers, environ_overrides={'REMOTE_ADDR': '198.51.100.1'}).status_code, 403)
        response = client.get('/', headers=headers)
        self.assertEqual(response.json, {'ip': '192.0.2.5', 'host': 'localhost', 'scheme': 'https'})
        headers['X-Forwarded-For'] = '192.0.2.5, 198.51.100.1'
        self.assertEqual(client.get('/', headers=headers).status_code, 403)

    def test_direct_mode_discards_all_forwarding_headers(self):
        from flask import Flask, jsonify, request
        from app.proxy import ProxyBoundary
        app = Flask('direct-test')
        app.add_url_rule('/', view_func=lambda: jsonify(ip=request.remote_addr, host=request.host, scheme=request.scheme))
        app.wsgi_app = ProxyBoundary(app.wsgi_app)
        response = app.test_client().get('/', headers={'Forwarded': 'for=192.0.2.5', 'X-Forwarded-For': '192.0.2.5',
            'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'attacker.invalid'})
        self.assertEqual(response.json, {'ip': '127.0.0.1', 'host': 'localhost', 'scheme': 'http'})

    def test_equivalent_ipv4_and_rotating_ipv6_addresses_share_identity(self):
        from app.rate_limits import client_identity
        self.assertEqual(client_identity('::ffff:192.0.2.5'), client_identity('192.0.2.5'))
        self.assertEqual(client_identity('2001:db8::1'), client_identity('2001:db8::ffff'))

    def test_unsafe_proxy_configuration_cannot_start(self):
        with patch.dict('os.environ', {'TRUST_PROXY': '1', 'OMS_PROXY_TOKEN': ''}), self.assertRaises(ValueError):
            create_app()

    def test_health_probe_flag_requires_authenticated_private_proxy(self):
        from flask import Flask, jsonify, request
        from app.proxy import ProxyBoundary
        token = 'health-probe-private-token-' * 2
        app = Flask('health-test')
        app.add_url_rule('/api/health', view_func=lambda: jsonify(probe=bool(request.environ.get('oms.health_probe'))))
        app.wsgi_app = ProxyBoundary(app.wsgi_app, token)
        client = app.test_client()
        self.assertEqual(client.get('/api/health', headers={'X-OMS-Health-Check': '1'}).status_code, 403)
        response = client.get('/api/health', headers={'X-OMS-Proxy-Token': token, 'X-OMS-Health-Check': token})
        self.assertTrue(response.json['probe'])
        response = client.get('/api/health', headers={'X-OMS-Proxy-Token': token, 'X-OMS-Health-Check': '1'})
        self.assertFalse(response.json['probe'])
        response = client.get('/api/health', headers={'X-OMS-Proxy-Token': token})
        self.assertFalse(response.json['probe'])

    def test_untrusted_host_is_rejected_even_with_forged_forwarding(self):
        response = self.client.get('/api/health', base_url='http://attacker.invalid', headers={'X-Forwarded-Host': 'localhost'})
        self.assertEqual(response.status_code, 400)

    def test_json_routes_reject_wrong_content_types_before_controllers(self):
        for method, path in [('post','/api/auth/login'),('post','/api/admin/users'),('post','/api/admin/discounts'),('put','/api/checkout')]:
            response = getattr(self.client, method)(path, data='not JSON', content_type='text/plain')
            self.assertEqual(response.status_code, 415, path)
            self.assertIn('JSON', response.json['error'])

    def test_corrupt_mismatched_and_large_pixel_images_are_rejected(self):
        for data, name in ((b'\x89PNG\r\n\x1a\nimage', 'proof.png'), (VALID_PNG, 'proof.jpg'), (b'<script>alert(1)</script>', 'proof.png')):
            with self.subTest(name=name), self.assertRaises(ValueError):
                sanitized_image(data, name)
        with patch('app.uploads.MAX_IMAGE_PIXELS', 8), self.assertRaises(ValueError):
            sanitized_image(VALID_PNG, 'proof.png')

    def test_sanitizing_removes_metadata_and_trailing_content(self):
        from PIL.PngImagePlugin import PngInfo
        metadata = PngInfo()
        metadata.add_text('private-location', 'private GPS data')
        data = io.BytesIO()
        Image.new('RGB', (2, 2), 'red').save(data, format='PNG', pnginfo=metadata)
        clean, extension = sanitized_image(data.getvalue() + b'<script>payload</script>', 'proof.png')
        self.assertEqual(extension, 'png')
        self.assertNotIn(b'private GPS', clean)
        self.assertNotIn(b'<script>', clean)
        with Image.open(io.BytesIO(clean)) as image:
            image.load()
            self.assertEqual(image.size, (2, 2))
