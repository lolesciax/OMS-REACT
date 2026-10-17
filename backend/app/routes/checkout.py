"""One database-backed checkout per customer; catalog prices are never cached."""
from datetime import datetime, timedelta
from bson import ObjectId
from flask import Blueprint, current_app, g, jsonify, request
from ..discounts import discount_for
import re

bp = Blueprint('checkout', __name__, url_prefix='/api/checkout')


def hydrate(draft):
    db = current_app.db
    order = db.orders.find_one({'_id': draft['orderId'], 'userId': g.user['_id']})
    if order:
        return {'checkoutId': str(draft['orderId']), 'items': order['items'],
                'pendingOrder': {**order, 'orderId': str(order['_id'])}}
    items = []
    for item in draft.get('items', []):
        product = db.products.find_one({'_id': item['productId']})
        if not product or not product.get('is_active', True):
            raise ValueError('A piece in this checkout is no longer available. Please review your bag.')
        if product.get('stock', 0) < item['qty']:
            raise ValueError(f"Only {product.get('stock', 0)} of {product.get('name', 'this piece')} remain. Please review your bag.")
        items.append({**product, 'id': str(product['_id']), 'qty': item['qty']})
    return {'checkoutId': str(draft['orderId']), 'items': items,
            'shippingAddress': draft.get('shippingAddress'), 'paymentMethod': draft.get('paymentMethod', ''), 'discountCode': draft.get('discountCode', '')}


@bp.route('', methods=['GET', 'PUT', 'PATCH', 'DELETE'])
def checkout():
    db = current_app.db
    owner = g.user['_id']
    if request.method == 'DELETE':
        db.checkouts.delete_one({'userId': owner})
        return jsonify(success=True)
    if request.method == 'PUT':
        data = request.get_json()
        if data.get('fromCart'):
            cart = db.carts.find_one({'user_id': owner}) or {}
            source = [{'id': item['product_id'], 'qty': item['qty']}
                      for item in cart.get('items', []) if item.get('selected')]
        else:
            source = data.get('items')
        if not isinstance(source, list) or not source:
            return jsonify(success=False, error='Choose at least one piece to check out.'), 400
        items, seen = [], set()
        for item in source:
            if not isinstance(item, dict) or not ObjectId.is_valid(item.get('id')) or type(item.get('qty')) is not int or item['qty'] < 1:
                return jsonify(success=False, error='Choose valid products and whole quantities.'), 400
            product_id = ObjectId(item['id'])
            if product_id in seen:
                return jsonify(success=False, error='A product cannot appear twice in checkout.'), 400
            seen.add(product_id)
            items.append({'productId': product_id, 'qty': item['qty']})
        draft = {'userId': owner, 'items': items, 'orderId': ObjectId(), 'updatedAt': datetime.utcnow(),
                 'expiresAt': datetime.utcnow() + timedelta(days=30)}
        try:
            hydrate(draft | {'_id': ObjectId()})
        except ValueError as error:
            return jsonify(success=False, error=str(error)), 409
        # Starting checkout intentionally replaces the draft; older unpaid orders
        # remain available from order history.
        result = db.checkouts.find_one_and_update({'userId': owner}, {'$set': draft, '$unset': {
            'shippingAddress': '', 'paymentMethod': '', 'discountCode': ''}, '$setOnInsert': {'createdAt': datetime.utcnow()}},
            upsert=True, return_document=True)
        return jsonify(success=True, checkout=hydrate(result))
    draft = db.checkouts.find_one({'userId': owner, 'expiresAt': {'$gt': datetime.utcnow()}})
    if not draft:
        return jsonify(success=False, error='There is no active checkout. Choose pieces from your bag.'), 404
    if request.method == 'PATCH':
        data = request.get_json()
        if str(draft['orderId']) != data.get('checkoutId'):
            return jsonify(success=False, error='Checkout changed in another tab. Refresh to continue.'), 409
        changes = {'updatedAt': datetime.utcnow()}
        editor, version = data.get('editorId'), data.get('editVersion')
        if editor is not None and (not isinstance(editor, str) or not re.fullmatch(r'[a-f0-9-]{36}', editor) or type(version) is not int or version < 1):
            return jsonify(success=False, error='Invalid checkout edit. Refresh and try again.'), 400
        if 'shippingAddress' in data:
            address = data['shippingAddress']
            keys = ('recipient', 'contact', 'street', 'barangay', 'city', 'province')
            if not isinstance(address, dict) or any(not isinstance(address.get(key, ''), str) for key in keys):
                return jsonify(success=False, error='Invalid delivery address.'), 400
            changes['shippingAddress'] = {key: address.get(key, '').strip()[:250] for key in keys}
        if 'paymentMethod' in data:
            if data['paymentMethod'] not in ('', 'gcash', 'paymaya'):
                return jsonify(success=False, error='Invalid payment method.'), 400
            changes['paymentMethod'] = data['paymentMethod']
        if 'discountCode' in data:
            try:
                changes['discountCode'] = discount_for(db, data['discountCode'], hydrate(draft)['items'])['code'] if data['discountCode'] else ''
            except ValueError as error:
                return jsonify(success=False, error=str(error)), 400
        query = {'_id': draft['_id'], 'userId': owner, 'orderId': draft['orderId']}
        if editor is not None:
            field = f'editorVersions.{editor}'
            query['$or'] = [{field: {'$lt': version}}, {field: {'$exists': False}}]
            changes[field] = version
        result = db.checkouts.update_one(query, {'$set': changes})
        if not result.matched_count:
            latest = db.checkouts.find_one({'_id': draft['_id'], 'orderId': draft['orderId']})
            if editor is not None and latest and latest.get('editorVersions', {}).get(editor, 0) >= version:
                return jsonify(success=True)
            return jsonify(success=False, error='Checkout changed in another tab. Refresh to continue.'), 409
        return jsonify(success=True)
    try:
        return jsonify(success=True, checkout=hydrate(draft))
    except ValueError as error:
        return jsonify(success=False, error=str(error)), 409


@bp.route('/quote', methods=['POST'])
def quote():
    from .orders import calculate_shipping_fee
    data = request.get_json()
    if not ObjectId.is_valid(data.get('checkoutId')):
        return jsonify(success=False, error='Invalid checkout.'), 400
    db = current_app.db
    draft = db.checkouts.find_one({'userId': g.user['_id'], 'orderId': ObjectId(data['checkoutId']), 'expiresAt': {'$gt': datetime.utcnow()}})
    if not draft:
        return jsonify(success=False, error='Checkout changed in another tab. Refresh to continue.'), 409
    province = data.get('province')
    if not isinstance(province, str) or not province.strip():
        return jsonify(success=False, error='Choose your delivery province.'), 400
    try:
        hydrated = hydrate(draft)
        if hydrated.get('pendingOrder'):
            return jsonify(success=False, error='This order was already created. Refresh to continue payment.'), 409
        items = hydrated['items']
        discount = discount_for(db, data.get('discountCode', ''), items)
    except (ValueError, TypeError) as error:
        return jsonify(success=False, error=str(error)), 400
    subtotal = round(sum(item['price'] * item['qty'] for item in items), 2)
    shipping = calculate_shipping_fee(province.strip())
    return jsonify(success=True, quote={'items': items, 'subtotal': subtotal, 'shippingFee': shipping,
        'discountCode': discount['code'], 'discountAmount': discount['amount'], 'total': round(subtotal + shipping - discount['amount'], 2)})
