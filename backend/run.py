import os
from app import create_app

app = create_app()

if __name__ == '__main__':
    from waitress import serve
    # Forwarding metadata is verified by ProxyBoundary, not interpreted twice.
    serve(app, host=os.getenv('HOST', '127.0.0.1'), port=int(os.getenv('PORT', '5000')),
          threads=8, connection_limit=100, channel_timeout=60,
          max_request_header_size=32 * 1024, max_request_body_size=16 * 1024 * 1024,
          clear_untrusted_proxy_headers=False, expose_tracebacks=False)
