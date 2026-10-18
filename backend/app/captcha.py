"""Self-hosted ALTCHA, bound to a browser, purpose, expiry and single use."""
import base64
import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from altcha import create_challenge, verify_solution
from flask import current_app, request, jsonify
from .admin_validation import FieldValidationError

COOKIE = 'oms_captcha'


def challenge_response(purpose):
    if purpose not in ('login', 'signup'):
        return jsonify(error='Choose a valid verification purpose.'), 400
    binding = request.cookies.get(COOKIE, '')
    if len(binding) != 64:
        binding = secrets.token_hex(32)
    challenge_id, secret = secrets.token_hex(24), secrets.token_hex(32)
    expires = datetime.now(timezone.utc) + timedelta(minutes=5)
    challenge = create_challenge(algorithm='PBKDF2/SHA-256', cost=1000, key_prefix_length=1,
        hmac_secret=secret, expires_at=expires, data={'id': challenge_id, 'purpose': purpose})
    current_app.db.captcha_challenges.insert_one({'_id': challenge_id, 'secret': secret,
        'binding': hashlib.sha256(binding.encode()).hexdigest(), 'purpose': purpose,
        'challenge': challenge.to_dict(), 'expiresAt': expires})
    response = jsonify(challenge.to_dict())
    response.set_cookie(COOKIE, binding, max_age=600, httponly=True, samesite='Lax',
                        secure=current_app.config.get('SESSION_COOKIE_SECURE', False), path='/')
    return response


def require_captcha(value, purpose):
    failure = FieldValidationError({'captcha': 'Complete a fresh security verification and try again.'})
    try:
        if not isinstance(value, str) or not 1 <= len(value) <= 8192:
            raise failure
        payload = json.loads(base64.b64decode(value, validate=True))
        supplied = payload['challenge']
        challenge_id = supplied['parameters']['data']['id']
        if not isinstance(challenge_id, str) or len(challenge_id) != 48:
            raise failure
        query = {'_id': challenge_id, 'purpose': purpose, 'expiresAt': {'$gt': datetime.utcnow()},
                 'binding': hashlib.sha256(request.cookies.get(COOKIE, '').encode()).hexdigest()}
        record = current_app.db.captcha_challenges.find_one(query)
        # Compare the entire issued challenge before letting the verifier perform
        # cryptographic work; client-supplied algorithm/cost values are untrusted.
        if not isinstance(record, dict) or supplied != record['challenge'] or not verify_solution(value, record['secret']).verified:
            raise failure
        if not current_app.db.captcha_challenges.find_one_and_delete(query):
            raise failure
    except (ValueError, TypeError, KeyError, AttributeError):
        raise failure from None
