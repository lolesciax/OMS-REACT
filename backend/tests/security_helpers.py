"""Solve real issued challenges in tests; no application bypass flags."""
from altcha import Challenge, Payload, solve_challenge


def captcha_payload(client, purpose='login'):
    response = client.get('/api/auth/captcha?purpose=' + purpose)
    if response.status_code != 200:
        raise AssertionError(response.json)
    challenge = Challenge.from_dict(response.json)
    return Payload(challenge, solve_challenge(challenge)).to_base64()


def consent_payload(client, kind):
    response = client.get('/api/policies/' + kind)
    if response.status_code != 200:
        raise AssertionError(response.json)
    return {'termsAccepted': True, 'termsVersion': response.json['policy']['_id']}


def registration_payload(client, values):
    return {**values, 'confirmPassword': values['password'], 'captcha': captcha_payload(client, 'signup'), **consent_payload(client, 'account')}
