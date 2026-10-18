"""Representative read-only browser states, restricted to a disposable database."""
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import re


def seed_responsive_records(db, customer_id, product_id, address):
    if not re.fullmatch(r'oms_test_[a-f0-9]{24}', db.name):
        raise RuntimeError('Responsive fixtures require a disposable test database.')
    now = datetime.now(timezone.utc)
    address = {key: value for key, value in address.items() if key not in ('id', 'title', 'isDefault')}
    address['street'] = '123 Sample Street, Building Two, Second Floor'
    name = 'Vintage heavyweight cotton graphic shirt in forest green'
    db.products.update_one({'_id': product_id}, {'$set': {'name': name}})
    db.carts.insert_one({'user_id': customer_id, 'items': [{'product_id': product_id, 'qty': 1, 'selected': True}]})
    db.checkouts.insert_one({'userId': customer_id, 'orderId': ObjectId(), 'items': [{'productId': product_id, 'qty': 1}],
                            'shippingAddress': address, 'paymentMethod': 'gcash', 'createdAt': now, 'updatedAt': now,
                            'expiresAt': now + timedelta(days=2)})
    orders = []
    for index, status in enumerate(('pending_payment', 'pending', 'shipped', 'completed')):
        order = {'_id': ObjectId(), 'userId': customer_id, 'orderNumber': f'ORD-BROWSER-{index + 1:06d}',
                 'items': [{'id': product_id, 'qty': 1, 'price': 125, 'name': name, 'size': 'Medium', 'image': '/static/uploads/p1.jpg'}],
                 'shippingAddress': address, 'subtotal': 125, 'shippingFee': 120, 'total': 245,
                 'paymentMethod': 'gcash', 'status': status, 'createdAt': now, 'updatedAt': now}
        if status != 'pending_payment':
            order['paymentProof'] = '/static/uploads/p1.jpg'
        if status in ('shipped', 'completed'):
            order.update(trackingNumber='PH-RESPONSIVE-2026-000001234567890', shippedAt=now, confirmedAt=now, processingAt=now)
        if status == 'completed':
            order.update(completedAt=now, receiptProof='/static/uploads/p1.jpg')
        orders.append(order)
    db.orders.insert_many(orders)
    return {'shippedOrderId': str(orders[2]['_id']), 'unpaidOrderId': str(orders[0]['_id'])}
