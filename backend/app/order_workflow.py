from datetime import datetime
from .admin_validation import FieldValidationError


def transition_order(order, data):
    """Enforce the same fulfillment sequence for both order APIs."""
    status = order.get('status', 'pending')
    target = data.get('status')
    if not isinstance(target, str) or target not in allowed_statuses():
        raise FieldValidationError({'status': 'Choose a valid order status.'})
    allowed = {
        'pending_payment': {'pending'},
        'pending': {'confirmed'},
        'confirmed': {'processing'},
        'processing': {'shipped'},
        'shipped': {'completed'},
        'completed': set(),
    }
    if target == status:
        return {'updatedAt': datetime.utcnow()}
    if target not in allowed.get(status, set()):
        raise FieldValidationError({'status': f'Cannot change an order from {status} to {target}. Complete the current step first.'})
    if target in ('pending', 'confirmed') and not order.get('paymentProof'):
        raise FieldValidationError({'status': 'Payment proof is required before confirming an order.'})
    result = {'status': target, 'updatedAt': datetime.utcnow()}
    milestone = {'confirmed': 'confirmedAt', 'processing': 'processingAt', 'completed': 'completedAt'}.get(target)
    if milestone:
        result[milestone] = datetime.utcnow()
    if target == 'shipped':
        supplied_tracking = data.get('trackingNumber')
        if not isinstance(supplied_tracking, str):
            raise FieldValidationError({'trackingNumber': 'Tracking number must be exactly 12 digits.'})
        tracking = supplied_tracking.strip()
        if len(tracking) != 12 or not tracking.isascii() or not tracking.isdigit():
            raise FieldValidationError({'trackingNumber': 'Tracking number must be exactly 12 digits.'})
        result.update(trackingNumber=tracking, shippedAt=datetime.utcnow())
    return result


def allowed_statuses():
    return ('pending_payment', 'pending', 'confirmed', 'processing', 'shipped', 'completed')
