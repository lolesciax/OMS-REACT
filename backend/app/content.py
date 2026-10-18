"""Admin-maintained customer help content; startup defaults never overwrite edits."""
import re
from datetime import datetime
from . import validation
from .admin_validation import clean_text, collect, FieldValidationError

DEFAULT_FAQS = [
    {'id': 'condition', 'question': 'Are the clothes new or pre-loved?', 'answer': 'Our collection is pre-loved. Check each item’s photos, size and condition before ordering. Contact the store if you need more details about a piece.'},
    {'id': 'payment', 'question': 'How do I pay for my order?', 'answer': 'Choose an available payment method at checkout. Check the store’s merchant name and QR image before transferring money, then upload a readable payment proof. The store reviews payment manually; uploading proof does not mean payment is already verified.'},
    {'id': 'stock', 'question': 'Does placing an order reserve my items?', 'answer': 'An unpaid order does not reserve stock. Availability is checked when you submit payment proof. If you have already paid and an item becomes unavailable, contact the store with your order and payment reference.'},
    {'id': 'shipping', 'question': 'How much is shipping?', 'answer': 'Enter your delivery address at checkout. The store calculates the shipping fee from your province and includes it in the final total before you place the order.'},
    {'id': 'tracking', 'question': 'Where can I track my order?', 'answer': 'Open Your orders after signing in. Follow payment review, preparation and shipment in the progress tracker. Your tracking number appears once the store ships the parcel.'},
    {'id': 'receipt', 'question': 'When should I confirm receipt?', 'answer': 'Confirm receipt only after your parcel arrives. Orders can complete automatically after 10 days in transit. If your parcel has not arrived, contact the store even if the order shows completed.'},
    {'id': 'issue', 'question': 'What if an item or payment has a problem?', 'answer': 'Contact the store with your order reference and clear photos or a payment reference. Describe the issue so the team can review it. Never share your password, one-time codes or payment account credentials.'},
    {'id': 'recovery', 'question': 'How can I recover my account?', 'answer': 'Use Forgot password on the sign-in page. Recovery codes require the store email service to be configured. If recovery is unavailable or you no longer have access to your email, contact the store for help.'},
]
DEFAULT_SUPPORT = {'email': 'oldgoodsthrift@gmail.com', 'phone': '09099409746',
    'hours': 'Monday–Saturday, 9 AM–6 PM', 'location': 'Marilao, Bulacan',
    'message': 'For order, payment, delivery or account questions, include your order reference when you contact us. Never send passwords or one-time codes.'}


def ensure_content(db):
    for kind, data in (('faqs', DEFAULT_FAQS), ('support', DEFAULT_SUPPORT)):
        db.settings.update_one({'_id': kind}, {'$setOnInsert': {
            'data': data, 'revision': 1, 'updatedAt': datetime.utcnow()}}, upsert=True)


def validate_faqs(items):
    if not isinstance(items, list) or not 1 <= len(items) <= 50:
        raise FieldValidationError({'items': 'Keep between 1 and 50 frequently asked questions.'})
    values, errors, identifiers = [], {}, set()
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            errors[f'item-{index}'] = 'Enter a question and answer.'
            continue
        try:
            value = collect({'id': lambda: clean_text(item.get('id'), 'question identifier', 40, True),
                             'question': lambda: clean_text(item.get('question'), 'question', 200, True),
                             'answer': lambda: clean_text(item.get('answer'), 'answer', 5000, True, multiline=True)})
            if not re.fullmatch(r'[A-Za-z0-9_-]+', value['id']) or value['id'] in identifiers:
                raise FieldValidationError({'id': 'Use a unique question identifier.'})
            identifiers.add(value['id'])
            values.append(value)
        except FieldValidationError as failure:
            errors.update({f'{key}-{index}': message for key, message in failure.fields.items()})
    if errors:
        raise FieldValidationError(errors)
    return values


def validate_support(data):
    if not isinstance(data, dict):
        raise FieldValidationError({'email': 'Enter valid store contact information.'})
    return collect({'email': lambda: validation.email(data.get('email')),
                    'phone': lambda: validation.phone(data.get('phone'), True),
                    'hours': lambda: clean_text(data.get('hours'), 'support hours', 150, True),
                    'location': lambda: clean_text(data.get('location'), 'store location', 200, True),
                    'message': lambda: clean_text(data.get('message'), 'support instructions', 2000, True, multiline=True)})
