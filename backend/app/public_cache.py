"""Bounded public JSON cache; private data never enters this cache."""
from collections import OrderedDict
from datetime import datetime, timezone
from threading import RLock
from time import monotonic
import os

from flask import g, request
from pymongo.errors import PyMongoError


PUBLIC_ENDPOINTS = {
    'products.get_products': 15,
    'products.get_product': 15,
    'content.published': 60,
    'policies.published': 60,
}
REVISION_ID = 'public_cache_revision'
WRITE_PREFIXES = ('/api/products', '/api/orders', '/api/checkout', '/api/admin')
READ_ONLY_ACTIONS = {'products.check_product_stock', 'orders.calculate_shipping'}


class PublicResponseCache:
    def __init__(self, max_entries=64, max_bytes=4 * 1024 * 1024, max_entry_bytes=1024 * 1024, clock=monotonic):
        self.entries = OrderedDict()
        self.bytes = 0
        self.max_entries = max_entries
        self.max_bytes = max_bytes
        self.max_entry_bytes = max_entry_bytes
        self.clock = clock
        self.lock = RLock()

    def _remove(self, key):
        entry = self.entries.pop(key, None)
        if entry:
            self.bytes -= len(entry[1])

    def get(self, key):
        with self.lock:
            entry = self.entries.get(key)
            if not entry:
                return None
            if entry[0] <= self.clock():
                self._remove(key)
                return None
            self.entries.move_to_end(key)
            return entry[1:]

    def put(self, key, body, content_type, etag, ttl):
        with self.lock:
            self._remove(key)
            if ttl <= 0 or self.max_entries <= 0 or len(body) > min(self.max_bytes, self.max_entry_bytes):
                return
            for expired in [k for k, value in self.entries.items() if value[0] <= self.clock()]:
                self._remove(expired)
            while self.entries and (len(self.entries) >= self.max_entries or self.bytes + len(body) > self.max_bytes):
                self._remove(next(iter(self.entries)))
            self.entries[key] = (self.clock() + ttl, body, content_type, etag)
            self.bytes += len(body)

    def clear(self):
        with self.lock:
            self.entries.clear()
            self.bytes = 0


def configure_public_cache(app):
    cache = PublicResponseCache()
    app.extensions['public_response_cache'] = cache
    app.config.setdefault('PUBLIC_CACHE_ENABLED', os.getenv('PUBLIC_CACHE_ENABLED', '1') != '0')

    def revision():
        try:
            document = app.db.settings.find_one({'_id': REVISION_ID}, {'revision': 1})
            if document is None:
                return 0
            value = document.get('revision')
            return int(value) if isinstance(value, int) and not isinstance(value, bool) else None
        except PyMongoError:
            # An unavailable database must never turn an old response into truth.
            return None

    @app.before_request
    def read_public_cache():
        # Registered after authentication and rate limiting, never before them.
        if not app.config['PUBLIC_CACHE_ENABLED'] or request.method not in ('GET', 'HEAD'):
            return None
        ttl = PUBLIC_ENDPOINTS.get(request.endpoint)
        if ttl is None or request.cache_control.no_store:
            return None
        version = revision()
        if version is None:
            return None
        key = (app.db.name, request.host_url, request.path.rstrip('/'), request.query_string, version)
        g.public_cache_key = key
        g.public_cache_ttl = ttl
        fresh = request.cache_control.no_cache or request.cache_control.max_age == 0
        stored = None if fresh else cache.get(key)
        if stored is None:
            return None
        body, content_type, etag = stored
        response = app.response_class(body, content_type=content_type)
        response.set_etag(etag)
        g.public_cache_hit = True
        return response

    @app.after_request
    def finish_public_cache(response):
        if not app.config['PUBLIC_CACHE_ENABLED']:
            return response
        if request.method in ('POST', 'PUT', 'PATCH', 'DELETE') and request.endpoint not in READ_ONLY_ACTIONS and 200 <= response.status_code < 300 and request.path.startswith(WRITE_PREFIXES):
            cache.clear()
            try:
                # All workers consult the same small revision document on reads.
                app.db.settings.update_one({'_id': REVISION_ID}, {'$inc': {'revision': 1}, '$set': {'updatedAt': datetime.now(timezone.utc)}}, upsert=True)
            except PyMongoError:
                # The mutation already committed: don't report a false failure.
                # Other workers retain at most the endpoint's short TTL.
                app.logger.exception('Public cache invalidation failed; cached entries will expire by TTL')
        key = getattr(g, 'public_cache_key', None)
        if key is None or response.status_code != 200 or response.mimetype != 'application/json' or response.headers.get('Set-Cookie'):
            return response
        if response.cache_control.no_store:
            return response
        if not getattr(g, 'public_cache_hit', False):
            payload = response.get_json(silent=True)
            if not isinstance(payload, dict) or payload.get('success') is False or 'error' in payload:
                return response
        response.add_etag()
        if not getattr(g, 'public_cache_hit', False) and request.method == 'GET':
            cache.put(key, response.get_data(), response.content_type, response.get_etag()[0], g.public_cache_ttl)
        # Browsers may keep a copy, but must revalidate before reusing it.
        # Shared/CDN caches must not retain credentialed API responses.
        response.headers['Cache-Control'] = 'private, no-cache, max-age=0, must-revalidate'
        response.headers['X-Store-Cache'] = 'HIT' if getattr(g, 'public_cache_hit', False) else 'MISS'
        g.public_cache_response = True
        response.make_conditional(request)
        if response.status_code not in (200, 304):
            g.public_cache_response = False
            response.headers['Cache-Control'] = 'no-store'
            response.headers.pop('ETag', None)
            response.headers.pop('X-Store-Cache', None)
        return response
