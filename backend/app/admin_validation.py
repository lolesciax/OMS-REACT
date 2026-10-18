"""Writable admin fields and their business rules, shared by API routes."""
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal, InvalidOperation
import re
from flask import jsonify
from . import validation
from .rules import RULES

MAX_AMOUNT = RULES['maxAmount']
MAX_STOCK = RULES['maxStock']
PRODUCT_CONDITIONS = RULES['conditions']
PRODUCT_TEXT = RULES['productText']


class FieldValidationError(ValueError):
    def __init__(self, fields):
        self.fields = fields
        super().__init__(next(iter(fields.values())))

    def response(self):
        return jsonify(success=False, error=str(self), fields=self.fields), 400


def collect(checks):
    values, errors = {}, {}
    for key, check in checks.items():
        try:
            values[key] = check()
        except (ValueError, TypeError) as error:
            errors[key] = str(error) if isinstance(error, ValueError) else 'Enter a valid value.'
    if errors:
        raise FieldValidationError(errors)
    return values


def clean_text(value, label, limit, required=False, multiline=False):
    result = validation.text(value, label, required, limit)
    pattern = r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]' if multiline else r'[\x00-\x1f\x7f]'
    if re.search(pattern, result):
        raise ValueError(f'Remove control characters from {label}.')
    return result


def amount(value, label, minimum=0, maximum=MAX_AMOUNT):
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise ValueError(f'Enter a valid {label}.')
    raw = str(value).strip()
    if not re.fullmatch(r'[0-9]+(?:\.[0-9]{1,2})?', raw):
        raise ValueError(f'{label.capitalize()} must use ordinary digits and at most two decimal places.')
    try:
        number = Decimal(raw)
        if not number.is_finite() or not Decimal(str(minimum)) <= number <= Decimal(str(maximum)):
            raise ValueError()
    except (ValueError, InvalidOperation):
        raise ValueError(f'{label.capitalize()} must be between {minimum:,} and {maximum:,}.')
    return float(number)


def stock(value):
    if isinstance(value, bool) or not isinstance(value, (str, int)) or not re.fullmatch(r'[0-9]+', str(value).strip()):
        raise ValueError('Stock must be a whole number of zero or more.')
    if len(str(value).strip()) > 7:
        raise ValueError(f'Stock cannot exceed {MAX_STOCK:,}.')
    result = int(value)
    if result > MAX_STOCK:
        raise ValueError(f'Stock cannot exceed {MAX_STOCK:,}.')
    return result


def choice(value, label, choices):
    if not isinstance(value, str) or value not in choices:
        raise ValueError(f'Choose a valid {label}.')
    return value


def boolean(value, label):
    if type(value) is not bool:
        raise ValueError(f'{label} must be true or false.')
    return value


def product(data, existing=None, options=None):
    partial = existing is not None
    checks = {}
    for key, limit in PRODUCT_TEXT.items():
        if not partial or key in data:
            checks[key] = lambda key=key, limit=limit: clean_text(data.get(key, ''), key, limit, key in ('name', 'category'), key == 'description')
    if not partial or 'price' in data:
        checks['price'] = lambda: amount(data.get('price'), 'price')
    if not partial or 'stock' in data:
        checks['stock'] = lambda: stock(data.get('stock'))
    if not partial or 'condition' in data:
        value = data.get('condition', 'Good')
        checks['condition'] = lambda: clean_text(value, 'condition', 40, True) if partial and value == existing.get('condition') else choice(value, 'condition', PRODUCT_CONDITIONS)
    values = collect(checks)
    if options:
        errors = {}
        for field, option_key in (
            ('category', 'categories'),
            ('size', 'sizes'),
            ('material', 'materials'),
        ):
            if field not in values or not values[field]:
                continue
            previous = existing.get(field, '') if existing else ''
            if values[field] not in options[option_key] and values[field] != previous:
                errors[field] = f'Choose a configured {field} or add it in catalog maintenance.'
        if errors:
            raise FieldValidationError(errors)
    return values


def account(data, existing=None):
    checks = {}
    for key in ('username', 'email', 'password'):
        if existing is None or key in data:
            if key == 'username' and existing and data[key] == existing.get(key):
                # Preserve unchanged historical usernames outside today's format.
                checks[key] = lambda: validation.text(data['username'], 'username', True, 80)
            elif key == 'password' and existing and data.get(key) == '':
                continue
            else:
                checks[key] = lambda key=key: getattr(validation, key)(data.get(key))
    for key in ('firstName', 'lastName'):
        if existing is None or key in data:
            checks[key] = lambda key=key: clean_text(data.get(key, ''), 'first name' if key == 'firstName' else 'last name', RULES['profileNameMaxLength'])
    if existing is None or 'phone' in data:
        checks['phone'] = lambda: validation.phone(data.get('phone', ''))
    for key in ('isAdmin', 'isActive'):
        if key in data:
            checks[key] = lambda key=key: boolean(data[key], key)
    values = collect(checks)
    if 'roleId' in data:
        from bson import ObjectId
        value = data['roleId']
        if not isinstance(value, str) or not ObjectId.is_valid(value):
            raise FieldValidationError({'roleId': 'Choose a valid account role.'})
        values['roleId'] = value
    return values


def discount_code(value):
    value = clean_text(value, 'discount code', 40, True).upper()
    if not re.fullmatch(r'[A-Z0-9_-]{1,40}', value):
        raise ValueError('Use 1–40 letters, numbers, underscores or hyphens for the code.')
    return value


def expiration(value):
    value = validation.text(value, 'expiration date', limit=10)
    if not value:
        return ''
    try:
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value) or date.fromisoformat(value) < datetime.now(timezone(timedelta(hours=8))).date():
            raise ValueError()
    except ValueError:
        raise ValueError('Choose today or a future expiration date.')
    return value


def discount(data):
    return collect({
        'code': lambda: discount_code(data.get('code')),
        'discountType': lambda: choice(data.get('discountType'), 'discount type', ('fixed', 'percentage')),
        'value': lambda: amount(data.get('value'), 'discount amount', .01, 100 if data.get('discountType') == 'percentage' else MAX_AMOUNT),
        'minPurchase': lambda: amount(data.get('minPurchase') if data.get('minPurchase') not in ('', None) else 0, 'minimum purchase'),
        'applyTo': lambda: choice(data.get('applyTo', 'all'), 'discount scope', ('all', 'category')),
        'category': lambda: clean_text(data.get('category'), 'category', 80, True) if data.get('applyTo') == 'category' else '',
        'validUntil': lambda: expiration(data.get('validUntil')),
    })
