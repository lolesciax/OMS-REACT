"""Durable in-app notifications, with an outbox stored in each changed document.

The business write and its event commit together. Delivery can be retried after
worker interruption; a unique recipient/event index prevents duplicate alerts.
"""
from datetime import datetime
from uuid import uuid4
from bson import ObjectId
from flask import current_app, g, has_request_context

OUTBOX = '_notificationOutbox'
SOURCES = ('orders', 'users', 'products', 'roles', 'settings')


def event(key, category, title, message, href, user_id=None, admins=False, role_id=None, admin_href=None):
    return {'key': key, 'category': category, 'title': title, 'message': message,
            'href': href, 'adminHref': admin_href or href, 'userId': user_id,
            'admins': admins, 'roleId': role_id, 'at': datetime.utcnow()}


def watch(collection, document_id):
    if has_request_context():
        if not hasattr(g, 'notification_sources'):
            g.notification_sources = set()
        g.notification_sources.add((collection, document_id))


def enqueue(update, collection, document_id, *events):
    events = [item for item in events if item]
    if events:
        update.setdefault('$push', {})[OUTBOX] = {'$each': events}
        watch(collection, document_id)
    return update


def prepare_document(document, collection, *events):
    document.setdefault('_id', ObjectId())
    if events:
        document[OUTBOX] = [item for item in events if item]
        watch(collection, document['_id'])
    return document


def order_event(order, kind):
    order_id = str(order['_id'])
    number = order.get('orderNumber') or order_id[-8:].upper()
    if len(number) > 28:
        number = '#' + order_id[-8:].upper()
    messages = {
        'created': ('Order placed', f'Order {number} is saved. Submit your payment proof to continue.'),
        'payment': ('Payment proof received', f'Payment proof for {number} is awaiting store review.'),
        'confirmed': ('Payment verified', f'Your payment for {number} has been verified.'),
        'processing': ('Getting your order ready', f'We are preparing {number} for shipment.'),
        'shipped': ('Your order is on its way', f'Order {number} has shipped. Tracking: {order.get("trackingNumber", "") }.'),
        'completed': ('Order completed',
                      f'Order {number} completed automatically after 10 days in transit. Contact the store if your delivery has not arrived.'
                      if order.get('autoCompletedAt') else f'Order {number} is marked delivered. Thank you for shopping with us.'),
    }
    title, message = messages[kind]
    item = event(f'order:{order_id}:{kind}', 'orders', title, message,
                 f'/order-history?order={order_id}', order.get('userId'),
                 admins=kind in ('created', 'payment', 'completed'),
                 admin_href=f'/admin/view-orders/{order_id}')
    if kind == 'created':
        item['adminTitle'] = 'New order placed'
        item['adminMessage'] = f'Order {number} was placed. Payment proof has not been submitted yet.'
    elif kind == 'payment':
        item['adminTitle'] = 'Payment needs review'
        item['adminMessage'] = f'Review the payment proof for {number} before confirming the order.'
    return item


def account_event(user_id, title, message, key=None, admins=False):
    return event(key or f'account:{uuid4().hex}', 'account', title, message,
                 '/profile', user_id, admins=admins, admin_href='/admin/customers')


def stock_event(product):
    stock = product.get('stock')
    if type(stock) is not int or stock > 5 or stock < 0 or product.get('is_active') is False:
        return None
    level = 'out' if stock == 0 else 'low'
    return event(f"stock:{product['_id']}:{product.get('stockNoticeCycle', 'initial')}:{level}", 'inventory',
                 'Product sold out' if stock == 0 else 'Low stock',
                 f"{product.get('name', 'A product')} has {stock} {'item' if stock == 1 else 'items'} remaining. Review inventory.",
                 '/admin/products', admins=True)


def stock_update(existing, changes):
    """A restock starts a fresh low-stock notification cycle."""
    if 'stock' not in changes:
        return {'$set': changes}
    updated = {**existing, **changes}
    if changes['stock'] > existing.get('stock', 0):
        changes['stockNoticeCycle'] = updated['stockNoticeCycle'] = uuid4().hex
    return enqueue({'$set': changes}, 'products', existing['_id'], stock_event(updated))


def deliver_source(db, collection, document_id):
    document = db[collection].find_one({'_id': document_id}, {OUTBOX: 1})
    if not isinstance(document, dict):
        return
    for item in document.get(OUTBOX, [])[:10]:
        recipients = []
        if isinstance(item.get('userId'), ObjectId):
            recipients.append((item['userId'], 'personal'))
        if item.get('admins'):
            role_ids = [role['_id'] for role in db.roles.find({'active': True, 'permissions': 'admin.access'}, {'_id': 1})]
            recipients.extend((user['_id'], 'admin') for user in db.users.find({'roleId': {'$in': role_ids}, 'isActive': {'$ne': False}}, {'_id': 1}))
        if isinstance(item.get('roleId'), ObjectId):
            recipients.extend((user['_id'], 'personal') for user in db.users.find({'roleId': item['roleId']}, {'_id': 1}))
        for user_id, audience in set(recipients):
            if not db.users.find_one({'_id': user_id}, {'_id': 1}):
                continue
            query = {'userId': user_id, 'eventKey': item['key'], 'audience': audience}
            db.notifications.update_one(query, {'$setOnInsert': {
                **query, 'category': item['category'],
                'title': item.get('adminTitle', item['title']) if audience == 'admin' else item['title'],
                'message': item.get('adminMessage', item['message']) if audience == 'admin' else item['message'],
                'href': item['adminHref'] if audience == 'admin' else item['href'],
                'createdAt': datetime.utcnow(), 'eventAt': item['at'], 'readAt': None,
            }}, upsert=True)
        # A crash before this acknowledgement is safe: recipient writes are idempotent.
        db[collection].update_one({'_id': document_id}, {'$pull': {OUTBOX: {'key': item['key']}}})


def flush_sources(sources=None):
    """Bounded delivery, also invoked by inbox reads to retry interrupted work."""
    db = current_app.db
    try:
        if sources is None:
            sources = [(collection, document['_id']) for collection in SOURCES
                       for document in db[collection].find({f'{OUTBOX}.key': {'$exists': True}}, {'_id': 1}).limit(5)]
    except Exception:
        current_app.logger.exception('Notification delivery deferred; the outbox will retry')
        return
    for collection, document_id in sources:
        try:
            deliver_source(db, collection, document_id)
        except Exception:
            # Keep this source queued without blocking other accounts' events.
            current_app.logger.exception('Notification delivery deferred; the outbox will retry')


def deliver_after_response(response):
    sources = getattr(g, 'notification_sources', None)
    if response.status_code < 400 and sources:
        flush_sources(sources)
    return response
