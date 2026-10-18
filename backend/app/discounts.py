"""Discount eligibility and amounts are computed from current catalog prices."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
import math


def discount_for(db, code, items):
    if not isinstance(code, str):
        raise ValueError('Enter a valid discount code.')
    code = code.strip().upper()
    if not code:
        return {'code': '', 'amount': 0}
    discount = db.discounts.find_one({'code': code, 'isActive': {'$ne': False}})
    if not discount:
        raise ValueError('This discount code is unavailable.')
    expiry = discount.get('validUntil') or discount.get('endDate')
    if expiry:
        try:
            expires = datetime.fromisoformat(str(expiry).replace('Z', '+00:00')).date()
        except ValueError:
            raise ValueError('This discount code is unavailable.')
        if expires < datetime.now(timezone(timedelta(hours=8))).date():
            raise ValueError('This discount code has expired.')
    subtotal = sum(Decimal(str(item['price'])) * item['qty'] for item in items)
    try:
        minimum = Decimal(str(discount.get('minPurchase', discount.get('minOrder', 0)) or 0))
        if not minimum.is_finite() or minimum < 0:
            raise ValueError()
    except (InvalidOperation, ValueError):
        raise ValueError('This discount code is unavailable.')
    if subtotal < minimum:
        raise ValueError(f'This code requires an item subtotal of at least ₱{minimum:,.2f}.')
    eligible = sum(Decimal(str(item['price'])) * item['qty'] for item in items
                   if discount.get('applyTo', 'all') != 'category' or item.get('category') == discount.get('category'))
    if not eligible:
        raise ValueError('This code does not apply to the pieces in your checkout.')
    value = float(discount.get('value', 0))
    kind = discount.get('discountType', discount.get('type'))
    if not math.isfinite(value) or value <= 0 or kind not in ('percentage', 'fixed') or (kind == 'percentage' and value > 100):
        raise ValueError('This discount code is unavailable.')
    amount = eligible * Decimal(str(value)) / 100 if kind == 'percentage' else Decimal(str(value))
    amount = min(amount, eligible).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)
    return {'code': code, 'amount': float(amount)}
