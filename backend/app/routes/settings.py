import os
from datetime import datetime
from flask import Blueprint, current_app, jsonify, request
from ..uploads import MAX_IMAGE_BYTES, save_image
from ..admin_validation import clean_text, collect, choice, FieldValidationError
from ..rules import RULES
from ..notifications import enqueue, event
from uuid import uuid4

bp = Blueprint('settings', __name__, url_prefix='/api')
METHODS = {'gcash': 'GCash', 'paymaya': 'Maya'}


def payment_methods():
    saved = current_app.db.settings.find_one({'_id': 'payments'}) or {}
    result = {}
    for key, label in METHODS.items():
        method = saved.get(key, {})
        # Merchant images belong to the store database; a missing image must
        # never be replaced with a demonstration payment code.
        url = method.get('qrUrl', '')
        result[key] = {'label': label, 'qrUrl': url, 'merchantName': method.get('merchantName', ''),
                       'enabled': bool(url) and method.get('enabled', False)}
    return result


@bp.route('/payments', methods=['GET'])
def public_payments():
    return jsonify(success=True, methods=payment_methods())


@bp.route('/admin/settings', methods=['GET'])
@bp.route('/admin/maintenance/payments', methods=['GET'])
def settings():
    return jsonify(success=True, methods=payment_methods(), passwordRecoveryConfigured=bool(os.getenv('SMTP_HOST') and os.getenv('SMTP_FROM')))


@bp.get('/admin/maintenance/security')
def security_status():
    return jsonify(passwordRecoveryConfigured=bool(os.getenv('SMTP_HOST') and os.getenv('SMTP_FROM')))


@bp.route('/admin/settings/payments/<method>', methods=['PUT'])
@bp.route('/admin/maintenance/payments/<method>', methods=['PUT'])
def update_payment(method):
    if method not in METHODS:
        return jsonify(success=False, error='Unknown payment method.'), 404
    data = request.form
    try:
        values = collect({'merchantName': lambda: clean_text(data.get('merchantName'), 'merchant name', RULES['merchantNameMaxLength'], True),
                          'enabled': lambda: choice(data.get('enabled'), 'payment availability', ('true', 'false'))})
    except FieldValidationError as error:
        return error.response()
    merchant = values['merchantName']
    current = payment_methods()[method]
    qr = request.files.get('image')
    url = current['qrUrl']
    if qr and qr.filename:
        try:
            url = save_image(qr.read(MAX_IMAGE_BYTES + 1), 'payments', qr.filename)
        except ValueError as error:
            return FieldValidationError({'image': str(error)}).response()
    if data['enabled'] == 'true' and not url:
        return FieldValidationError({'image': 'Upload the real merchant QR image before enabling this method.'}).response()
    value = {'merchantName': merchant, 'enabled': data['enabled'] == 'true', 'qrUrl': url}
    changed = any(value[key] != current.get(key) for key in value)
    notice = event(f'payment-settings:{uuid4().hex}', 'store', 'Payment settings changed',
                   f'{METHODS[method]} merchant details or checkout availability were updated. Review the current payment instructions.',
                   '/admin/maintenance/payments', admins=True) if changed else None
    current_app.db.settings.update_one({'_id': 'payments'}, enqueue({'$set': {method: value, 'updatedAt': datetime.utcnow()}}, 'settings', 'payments', notice), upsert=True)
    return jsonify(success=True, methods=payment_methods())
