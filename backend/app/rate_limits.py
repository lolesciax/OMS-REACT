"""Atomic, shared sliding-window budgets; no per-process bypass or boundary reset."""
import hashlib
import ipaddress
import math
import secrets
from flask import current_app, g, jsonify, request
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError

AUTH_POLICIES = {
    'auth.login': (20, 300), 'auth.register': (5, 900),
    'auth.request_password_reset': (3, 900), 'auth.forgot_password': (10, 900),
    'auth.check_email': (60, 60), 'auth.check_username': (60, 60),
}
IP_POLICIES = (('ip:burst', 120, 10), ('ip:all', 600, 60))
SUCCESS_ATTEMPT_ENDPOINTS = {
    'auth.login',
    'auth.register',
    'auth.request_password_reset',
    'auth.forgot_password',
}


def client_identity(value):
    try:
        address = ipaddress.ip_address(value)
        if isinstance(address, ipaddress.IPv6Address):
            if address.ipv4_mapped:
                return str(address.ipv4_mapped)
            # Rotating addresses inside one IPv6 network must share a budget.
            return str(ipaddress.ip_network(f'{address}/64', strict=False))
        return str(address)
    except ValueError:
        return 'unknown'


def consume(scope, identity, limit, seconds):
    digest = hashlib.sha256(f'{scope}:{identity}'.encode()).hexdigest()
    reservation_id = secrets.token_urlsafe(18)
    # $$NOW comes from MongoDB, so worker clock differences cannot reset limits.
    update = [
        {'$set': {'attempts': {'$filter': {
            'input': {'$ifNull': ['$attempts', []]}, 'as': 'attempt',
            'cond': {'$gt': ['$$attempt', {'$subtract': ['$$NOW', seconds * 1000]}]},
        }}, 'reservations': {'$filter': {
            'input': {'$ifNull': ['$reservations', []]}, 'as': 'reservation',
            'cond': {'$gt': ['$$reservation.at', {'$subtract': ['$$NOW', seconds * 1000]}]},
        }}}},
        {'$set': {'allowed': {'$lt': [
            {'$add': [{'$size': '$attempts'}, {'$size': '$reservations'}]},
            limit,
        ]}}},
        {'$set': {
            'reservations': {'$cond': [
                '$allowed',
                {'$concatArrays': ['$reservations', [{'id': reservation_id, 'at': '$$NOW'}]]},
                '$reservations',
            ]},
            'checkedAt': '$$NOW', 'expiresAt': {'$add': ['$$NOW', seconds * 1000]},
        }},
    ]
    try:
        collection = current_app.db.rate_limits
        try:
            record = collection.find_one_and_update({'_id': digest}, update, upsert=True, return_document=ReturnDocument.AFTER)
        except DuplicateKeyError:
            record = collection.find_one_and_update({'_id': digest}, update, return_document=ReturnDocument.AFTER)
        if not record['allowed']:
            timestamps = list(record.get('attempts', [])) + [
                item['at'] for item in record.get('reservations', [])
            ]
            oldest = min(timestamps)
            retry = max(1, math.ceil(seconds - (record['checkedAt'] - oldest).total_seconds()))
            response = jsonify(success=False, error='Too many requests. Please wait before trying again.')
            response.status_code = 429
            response.headers['Retry-After'] = str(retry)
            response.headers['RateLimit-Limit'] = str(limit)
            response.headers['RateLimit-Remaining'] = '0'
            response.headers['Cache-Control'] = 'no-store'
            return response
        reservations = getattr(g, 'rate_limit_reservations', None)
        if reservations is None:
            g.rate_limit_reservations = reservations = []
        reservations.append((scope, digest, reservation_id))
    except PyMongoError:
        return jsonify(success=False, error='Request verification is temporarily unavailable. Please try again shortly.'), 503
    return None


def release_successful_action(response):
    """Do not retain attempt-budget reservations for successful user actions."""
    if not 200 <= response.status_code < 300:
        return response

    endpoint = request.endpoint or ''
    releasable = []
    for reservation in getattr(g, 'rate_limit_reservations', []):
        scope, digest, reservation_id = reservation
        is_write_attempt = scope in ('ip:write', 'user:write')
        is_auth_attempt = (
            endpoint in SUCCESS_ATTEMPT_ENDPOINTS
            and scope.startswith(endpoint + ':')
        )
        if is_write_attempt or is_auth_attempt:
            releasable.append((digest, reservation_id))

    for digest, reservation_id in releasable:
        try:
            current_app.db.rate_limits.update_one(
                {'_id': digest},
                {'$pull': {'reservations': {'id': reservation_id}}},
            )
        except PyMongoError:
            current_app.logger.exception('Failed to release successful action rate-limit reservation')
    return response


def limit_requests():
    """Count every request before origin, JSON, authentication or routing errors."""
    if request.environ.get('oms.health_probe'):
        return None
    identity = client_identity(request.remote_addr or '')
    for scope, limit, seconds in IP_POLICIES:
        blocked = consume(scope, identity, limit, seconds)
        if blocked is not None:
            return blocked
    endpoint = request.endpoint
    if endpoint == 'auth.captcha' and request.method == 'GET':
        return consume('captcha:issue', identity, 30, 300)
    if endpoint in AUTH_POLICIES and request.method not in ('GET', 'HEAD', 'OPTIONS'):
        limit, seconds = AUTH_POLICIES[endpoint]
        blocked = consume(endpoint + ':ip', identity, limit, seconds)
        if blocked is not None:
            return blocked
    if endpoint in ('serve_uploaded_files', 'products.uploaded_file'):
        return consume('uploads:read', identity, 300, 60)
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        return consume('ip:write', identity, 120, 60)
    return None


def limit_auth_account():
    policy = AUTH_POLICIES.get(request.endpoint)
    if not policy or request.method in ('GET', 'HEAD', 'OPTIONS'):
        return None
    if request.endpoint not in ('auth.login', 'auth.request_password_reset', 'auth.forgot_password'):
        return None
    data = request.get_json(silent=True)
    account = data.get('username') if isinstance(data, dict) else None
    if isinstance(account, str) and account.strip():
        return consume(request.endpoint + ':account', account.strip().casefold()[:80], policy[0] * 3, policy[1])
    return None


def limit_user_requests():
    # A new cookie/session or IP cannot reset an authenticated account's budget.
    identity = str(g.user['_id'])
    blocked = consume('user:all', identity, 300, 60)
    if blocked is not None:
        return blocked
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        blocked = consume('user:write', identity, 90, 60)
        if blocked is not None:
            return blocked
    if request.endpoint in ('orders.upload_payment_proof', 'orders.confirm_order_receipt') or request.mimetype == 'multipart/form-data':
        return consume('user:uploads', identity, 30, 600)
    return None
