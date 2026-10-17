import os
from datetime import datetime
from flask import Blueprint, current_app, jsonify, request
from ..uploads import MAX_IMAGE_BYTES, save_image

bp = Blueprint('settings', __name__, url_prefix='/api')
METHODS = {'gcash': ('GCash', 'VITE_GCASH_QR_URL'), 'paymaya': ('Maya', 'VITE_PAYMAYA_QR_URL')}


def payment_methods():
    saved = current_app.db.settings.find_one({'_id': 'payments'}) or {}
    result = {}
    for key, (label, _) in METHODS.items():
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
def settings():
    return jsonify(success=True, methods=payment_methods(), passwordRecoveryConfigured=bool(os.getenv('SMTP_HOST') and os.getenv('SMTP_FROM')))


@bp.route('/admin/settings/payments/<method>', methods=['PUT'])
def update_payment(method):
    if method not in METHODS:
        return jsonify(success=False, error='Unknown payment method.'), 404
    data = request.form
    merchant = data.get('merchantName', '').strip()
    if not merchant or len(merchant) > 100:
        return jsonify(success=False, error='Enter the merchant name shown in your wallet app.'), 400
    if data.get('enabled') not in ('true', 'false'):
        return jsonify(success=False, error='Choose whether this payment method is enabled.'), 400
    current = payment_methods()[method]
    qr = request.files.get('image')
    url = current['qrUrl']
    if qr and qr.filename:
        try:
            url = save_image(qr.read(MAX_IMAGE_BYTES + 1), 'payments', qr.filename)
        except ValueError as error:
            return jsonify(success=False, error=str(error)), 400
    if data['enabled'] == 'true' and not url:
        return jsonify(success=False, error='Upload the real merchant QR image before enabling this method.'), 400
    value = {'merchantName': merchant, 'enabled': data['enabled'] == 'true', 'qrUrl': url}
    current_app.db.settings.update_one({'_id': 'payments'}, {'$set': {method: value, 'updatedAt': datetime.utcnow()}}, upsert=True)
    return jsonify(success=True, methods=payment_methods())
