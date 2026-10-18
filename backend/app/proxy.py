"""Accept forwarding metadata only from an authenticated, known proxy peer."""
import hmac
import ipaddress
import re
from werkzeug.middleware.proxy_fix import ProxyFix

FORWARDED_HEADERS = ('HTTP_FORWARDED', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_FORWARDED_PROTO',
                     'HTTP_X_FORWARDED_HOST', 'HTTP_X_FORWARDED_PORT', 'HTTP_X_FORWARDED_PREFIX', 'HTTP_X_REAL_IP')


class ProxyBoundary:
    def __init__(self, app, token='', peers='127.0.0.1/32,::1/128'):
        if token and not re.fullmatch(r'[A-Za-z0-9_-]{32,128}', token):
            raise ValueError('OMS_PROXY_TOKEN must contain 32–128 URL-safe letters, numbers, underscores or hyphens')
        self.token = token
        self.peers = tuple(ipaddress.ip_network(value.strip()) for value in peers.split(',') if value.strip())
        self.application = ProxyFix(app, x_for=1, x_proto=1, x_host=0, x_port=0, x_prefix=0) if token else app

    def __call__(self, environ, start_response):
        supplied = environ.pop('HTTP_X_OMS_PROXY_TOKEN', '')
        probe = environ.pop('HTTP_X_OMS_HEALTH_CHECK', '')
        if self.token:
            try:
                peer = ipaddress.ip_address(environ.get('REMOTE_ADDR', ''))
                trusted = any(peer in network for network in self.peers)
                forwarded = environ.get('HTTP_X_FORWARDED_FOR', str(peer))
                ipaddress.ip_address(forwarded)  # Reject lists and invalid addresses.
                valid = trusted and hmac.compare_digest(supplied.encode(), self.token.encode())
                valid = valid and environ.get('HTTP_X_FORWARDED_PROTO', 'http') in ('http', 'https')
            except ValueError:
                valid = False
            if not valid:
                body = b'{"success":false,"error":"Direct backend access is not allowed."}'
                start_response('403 Forbidden', [('Content-Type', 'application/json'), ('Content-Length', str(len(body))),
                    ('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff')])
                return [body]
            # Only Caddy's private probe uses this flag. Public proxy requests
            # have this header removed before reaching a worker.
            environ['oms.health_probe'] = (hmac.compare_digest(probe.encode(), self.token.encode()) and environ.get('REQUEST_METHOD') in ('GET', 'HEAD')
                                           and environ.get('PATH_INFO') == '/api/health')
            # Host, prefix and arbitrary Forwarded headers are never authoritative.
            keep = {'HTTP_X_FORWARDED_FOR', 'HTTP_X_FORWARDED_PROTO'}
        else:
            keep = set()
        for name in FORWARDED_HEADERS:
            if name not in keep:
                environ.pop(name, None)
        return self.application(environ, start_response)
