"""Immutable policy versions and explicit, server-recorded acceptance."""
from datetime import datetime
from bson import ObjectId
from flask import current_app
from .admin_validation import FieldValidationError

DEFAULTS = {
    'account': ('000000000000000000000010', 'Account terms and conditions',
        'Keep your account details accurate and your password private. Use the store respectfully and do not submit fraudulent orders or payment proofs.\n\nWe use the account and delivery details you provide to manage purchases, deliver orders and support account recovery. Security and order updates appear in your notification inbox.\n\nReview product descriptions and condition before ordering. Contact the store if you need help correcting account information or resolving an order issue.'),
    'order': ('000000000000000000000011', 'Order terms and conditions',
        'Review the product photos, pre-loved condition, size, quantities, delivery address and final total before placing an order. The displayed total includes the quoted shipping fee and any accepted discount.\n\nPayments are reviewed manually by the store. Confirm the merchant details before transferring money and submit a readable payment proof. Stock is checked when payment proof is submitted; creating an unpaid order does not reserve inventory. If you have already paid and stock becomes unavailable, contact the store with your payment reference.\n\nTracking is provided after shipment. Confirm receipt only after receiving your order. Orders may be completed automatically after 10 days in transit; contact the store if delivery has not arrived.\n\nContact the store about incorrect, damaged or missing items, payment issues, or a requested cancellation. These terms do not remove rights provided by applicable law.'),
    'privacy': ('000000000000000000000012', 'Privacy policy',
        'We use the account information you provide to manage your profile, purchases, delivery and account recovery. Delivery details, order history, payment proofs and receipt photos support fulfillment and the resolution of order issues. Store administrators can access information needed to operate the store.\n\nThe website uses cookies for account sessions and security verification. Account, cart and checkout records are held in the store database. Payment proofs and delivery receipts require an owner or administrator session to view. Notifications appear inside your account.\n\nContact the store to ask about access, corrections, account information or privacy concerns. Do not send passwords, one-time codes or payment account credentials. Order and security records may need to be retained to resolve transactions or meet applicable obligations.'),
    'shipping': ('000000000000000000000013', 'Shipping & delivery',
        'Delivery is available across the Philippines. Enter a complete recipient name, mobile number and delivery address. The checkout calculates shipping from the delivery province and includes the fee in the final total before you order.\n\nAfter payment proof is verified, the store prepares the order. Your order page shows preparation and shipment progress. A tracking number is added when the order is shipped. Delivery timing depends on the destination and courier; contact the store for help with a delayed parcel.\n\nCheck the address before ordering and contact the store promptly if it needs to change. Confirm receipt only after your parcel arrives. Orders may complete automatically after 10 days in transit; contact the store if a parcel has not arrived even if the order shows completed.'),
    'returns': ('000000000000000000000014', 'Returns, cancellations & order issues',
        'Our pieces are pre-loved. Review each item’s photos, size, description and condition before paying. If an item is incorrect, damaged, missing or different from its description, contact the store with your order reference and clear photos so the issue can be reviewed.\n\nFor cancellation requests, payment mistakes or delivery issues, contact the store promptly. Available next steps depend on whether payment has been verified and whether the parcel has shipped. A request does not change the order automatically.\n\nIf you have paid and stock becomes unavailable when submitting proof, contact the store with the payment reference. The store will review the transaction and discuss the appropriate resolution. Do not send passwords, one-time codes or full payment account credentials. This policy does not remove rights provided by applicable law.'),
}

POLICY_SCHEMA = {'required': ['kind', 'title', 'body', 'publishedAt'], 'properties': {
    'kind': {'enum': list(DEFAULTS)}, 'title': {'bsonType': 'string', 'maxLength': 150},
    'body': {'bsonType': 'string', 'maxLength': 20000}, 'publishedAt': {'bsonType': 'date'}}}


def ensure_policies(db):
    # Upgrade the existing enum before inserting newly introduced policy kinds.
    validator = {'$jsonSchema': {'bsonType': 'object', **POLICY_SCHEMA}}
    if 'policy_versions' in db.list_collection_names():
        db.command({'collMod': 'policy_versions', 'validator': validator, 'validationLevel': 'strict', 'validationAction': 'error'})
    else:
        db.create_collection('policy_versions', validator=validator)
    versions = {}
    for kind, (identifier, title, body) in DEFAULTS.items():
        versions[kind] = ObjectId(identifier)
        db.policy_versions.update_one({'_id': versions[kind]}, {'$setOnInsert': {
            'kind': kind, 'title': title, 'body': body, 'publishedAt': datetime.utcnow(),
        }}, upsert=True)
    db.settings.update_one({'_id': 'terms'}, {'$setOnInsert': versions}, upsert=True)
    # Add new policy sections without overwriting an administrator's publication.
    for kind, identifier in versions.items():
        db.settings.update_one({'_id': 'terms', kind: {'$exists': False}}, {'$set': {kind: identifier}})


def current_policy(kind, db=None):
    db = current_app.db if db is None else db
    pointers = db.settings.find_one({'_id': 'terms'}) or {}
    document = db.policy_versions.find_one({'_id': pointers.get(kind), 'kind': kind})
    if not isinstance(document, dict):
        raise FieldValidationError({'termsVersion': 'Terms are temporarily unavailable. Please try again.'})
    return document


def acceptance(data, kind):
    if data.get('termsAccepted') is not True:
        raise FieldValidationError({'termsAccepted': 'Read and accept the terms and conditions to continue.'})
    document = current_policy(kind)
    if data.get('termsVersion') != str(document['_id']):
        raise FieldValidationError({'termsVersion': 'The terms were updated. Refresh and review the latest version.'})
    return {'version': document['_id'], 'acceptedAt': datetime.utcnow()}
