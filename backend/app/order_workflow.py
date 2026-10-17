from datetime import datetime


def transition_order(order, data):
    """Enforce the same fulfillment sequence for both order APIs."""
    status = order.get('status', 'pending')
    target = data.get('status')
    allowed = {
        'pending_payment': {'pending'},
        'pending': {'confirmed'},
        'confirmed': {'processing'},
        'processing': {'shipped'},
        'shipped': {'completed'},
        'completed': set(),
    }
    if target == status:
        return {'updatedAt': datetime.now()}
    if target not in allowed.get(status, set()):
        raise ValueError(f'Cannot change an order from {status} to {target}. Complete the current step first.')
    if target == 'confirmed' and not order.get('paymentProof'):
        raise ValueError('Payment proof is required before confirming an order.')
    result = {'status': target, 'updatedAt': datetime.now()}
    if target == 'shipped':
        tracking = str(data.get('trackingNumber', '')).strip()
        if len(tracking) != 12 or not tracking.isascii() or not tracking.isdigit():
            raise ValueError('Tracking number must be exactly 12 digits.')
        result.update(trackingNumber=tracking, shippedAt=datetime.now())
    return result
