"""Cache behavior checks without a network connection or production data."""
import unittest
from flask import Flask, g, jsonify, request
from pymongo.errors import ConnectionFailure
from app.public_cache import PublicResponseCache, configure_public_cache, REVISION_ID


class Settings:
    def __init__(self):
        self.version = 0
        self.failed = False

    def find_one(self, query, projection):
        assert query == {'_id': REVISION_ID}
        if self.failed:
            raise ConnectionFailure('Offline')
        return {'revision': self.version}

    def update_one(self, query, update, upsert):
        self.version += update['$inc']['revision']


class Database:
    name = 'test-cache'

    def __init__(self):
        self.settings = Settings()
        self.price = 125


def application(db):
    app = Flask(__name__)
    app.db = db
    app.calls = 0
    app.failure = False

    @app.before_request
    def access_gate():
        if request.headers.get('X-Reject'):
            return jsonify(error='Access denied'), 403

    @app.after_request
    def private_default(response):
        if not getattr(g, 'public_cache_response', False):
            response.headers['Cache-Control'] = 'no-store'
        return response

    @app.get('/api/products', endpoint='products.get_products')
    def products():
        app.calls += 1
        if app.failure == 'payload':
            return jsonify(success=False, error='Invalid result')
        if app.failure:
            return jsonify(error='Offline'), 503
        return jsonify(products=[{'name': 'Shirt', 'price': app.db.price}])

    @app.get('/api/auth/session')
    def session():
        app.calls += 1
        return jsonify(user={'private': app.calls})

    @app.put('/api/admin/products/1')
    def update_product():
        app.db.price = 150
        return jsonify(success=True)

    @app.put('/api/orders/1')
    def update_stock():
        app.db.price = 200
        return jsonify(success=True)

    @app.post('/api/products/check-stock/1', endpoint='products.check_product_stock')
    def check_stock():
        return jsonify(success=True)

    configure_public_cache(app)
    return app


class PublicCacheTests(unittest.TestCase):
    def setUp(self):
        self.db = Database()
        self.app = application(self.db)
        self.client = self.app.test_client()

    def test_hits_conditional_get_and_head_keep_security_gate(self):
        first = self.client.get('/api/products')
        self.assertEqual(first.headers['X-Store-Cache'], 'MISS')
        self.assertIn('private, no-cache', first.headers['Cache-Control'])
        second = self.client.get('/api/products')
        self.assertEqual(second.headers['X-Store-Cache'], 'HIT')
        self.assertEqual(self.app.calls, 1)
        unchanged = self.client.get('/api/products', headers={'If-None-Match': first.headers['ETag']})
        self.assertEqual(unchanged.status_code, 304)
        self.assertEqual(unchanged.data, b'')
        self.assertIn('private', unchanged.headers['Cache-Control'])
        self.assertEqual(self.client.head('/api/products').data, b'')
        precondition = self.client.get('/api/products', headers={'If-Match': '"wrong"'})
        self.assertEqual(precondition.status_code, 412)
        self.assertEqual(precondition.headers['Cache-Control'], 'no-store')
        blocked = self.client.get('/api/products', headers={'X-Reject': '1'})
        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(blocked.headers['Cache-Control'], 'no-store')

    def test_admin_and_order_writes_invalidate_other_workers(self):
        other = application(self.db).test_client()
        original = self.client.get('/api/products')
        other.put('/api/admin/products/1')
        changed = self.client.get('/api/products', headers={'If-None-Match': original.headers['ETag']})
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(changed.json['products'][0]['price'], 150)
        self.assertEqual(changed.headers['X-Store-Cache'], 'MISS')
        other.put('/api/orders/1')
        self.assertEqual(self.client.get('/api/products').json['products'][0]['price'], 200)

    def test_private_errors_and_database_failures_are_not_cached(self):
        for _ in range(2):
            response = self.client.get('/api/auth/session')
            self.assertEqual(response.headers['Cache-Control'], 'no-store')
            self.assertNotIn('ETag', response.headers)
        self.assertEqual(self.app.calls, 2)
        self.app.failure = True
        response = self.client.get('/api/products')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.app.failure = False
        self.client.get('/api/products')
        self.db.settings.failed = True
        self.db.price = 250
        response = self.client.get('/api/products')
        self.assertEqual(response.json['products'][0]['price'], 250)
        self.assertNotIn('X-Store-Cache', response.headers)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')

    def test_reload_bypass_and_disable_are_supported(self):
        self.client.get('/api/products')
        self.db.price = 160
        response = self.client.get('/api/products', headers={'Cache-Control': 'no-cache'})
        self.assertEqual(response.json['products'][0]['price'], 160)
        self.db.price = 170
        response = self.client.get('/api/products', headers={'Cache-Control': 'no-store'})
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.assertEqual(response.json['products'][0]['price'], 170)
        self.app.config['PUBLIC_CACHE_ENABLED'] = False
        self.assertEqual(self.client.get('/api/products').headers['Cache-Control'], 'no-store')

    def test_cache_keys_separate_hosts_queries_and_databases(self):
        self.client.get('/api/products')
        self.client.get('/api/products?test=1')
        self.client.get('/api/products', base_url='http://another.invalid')
        self.app.db = Database()
        self.app.db.name = 'other-test-database'
        self.client.get('/api/products')
        self.assertEqual(self.app.calls, 4)

    def test_error_payloads_are_not_stored_and_read_only_posts_do_not_invalidate(self):
        self.app.failure = 'payload'
        for _ in range(2):
            response = self.client.get('/api/products')
            self.assertEqual(response.headers['Cache-Control'], 'no-store')
            self.assertNotIn('ETag', response.headers)
        self.assertEqual(self.app.calls, 2)
        self.client.post('/api/products/check-stock/1')
        self.assertEqual(self.db.settings.version, 0)

    def test_expiry_memory_bounds_and_lru_eviction(self):
        clock = [0]
        cache = PublicResponseCache(max_entries=2, max_bytes=6, max_entry_bytes=4, clock=lambda: clock[0])
        cache.put('a', b'aaa', 'application/json', 'a', 10)
        cache.put('b', b'bbb', 'application/json', 'b', 10)
        cache.get('a')
        cache.put('c', b'ccc', 'application/json', 'c', 10)
        self.assertIsNone(cache.get('b'))
        self.assertEqual(cache.bytes, 6)
        cache.put('oversize', b'12345', 'application/json', 'x', 10)
        self.assertIsNone(cache.get('oversize'))
        clock[0] = 11
        self.assertIsNone(cache.get('a'))
        self.assertIsNone(cache.get('c'))
        self.assertEqual(cache.bytes, 0)


if __name__ == '__main__':
    unittest.main()
