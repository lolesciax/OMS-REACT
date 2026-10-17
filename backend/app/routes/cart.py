"""Customer carts contain references and quantities; products own catalog data."""
from datetime import datetime
from bson import ObjectId
from flask import Blueprint, current_app, jsonify, request

bp = Blueprint('cart', __name__, url_prefix='/api/cart')


def product_input(data):
    value = data.get('product_id')
    if not ObjectId.is_valid(value):
        raise ValueError('Invalid product ID')
    return ObjectId(value)


@bp.route('/<user_id>', methods=['GET'])
def get_user_cart(user_id):
    db = current_app.db
    cart = db.carts.find_one({'user_id': user_id}) or {}
    items = []
    for item in cart.get('items', []):
        product = db.products.find_one({'_id': item['product_id']})
        available = product and product.get('is_active', True)
        stock = product.get('stock', 0) if available else 0
        items.append({'id': str(item['product_id']), 'name': product.get('name', 'Unavailable piece') if product else 'Product no longer available',
                      'price': product.get('price', 0) if product else None, 'image': product.get('image', '') if product else '',
                      'condition': product.get('condition', 'Pre-loved') if available else 'Unavailable',
                      'size': product.get('size', '') if product else '', 'currentStock': stock,
                      'qty': min(item['qty'], stock) if stock > 0 else item['qty'], 'selected': bool(item.get('selected')) and stock > 0})
    return jsonify(success=True, cart=items)


@bp.route('/<user_id>/add', methods=['POST'])
def add_to_cart(user_id):
    db = current_app.db
    data = request.get_json()
    try:
        product_id = product_input(data)
    except ValueError as error:
        return jsonify(success=False, error=str(error)), 400
    quantity = data.get('quantity', 1)
    if type(quantity) is not int or quantity < 1:
        return jsonify(success=False, error='Quantity must be a positive integer'), 400
    product = db.products.find_one({'_id': product_id})
    if not product or not product.get('is_active', True):
        return jsonify(success=False, error='Product not found'), 404
    stock = product.get('stock', 0)
    if quantity > stock:
        return jsonify(success=False, error=f'Only {stock} items available'), 400
    db.carts.update_one({'user_id': user_id}, {'$setOnInsert': {'items': [], 'created_at': datetime.utcnow()}}, upsert=True)
    for _ in range(2):
        updated = db.carts.update_one({'user_id': user_id, 'items': {'$elemMatch': {'product_id': product_id, 'qty': {'$lte': stock - quantity}}}},
                                     {'$inc': {'items.$.qty': quantity}, '$set': {'updated_at': datetime.utcnow()}})
        if updated.modified_count:
            return jsonify(success=True, message='Item added to cart')
        inserted = db.carts.update_one({'user_id': user_id, 'items.product_id': {'$ne': product_id}},
                                      {'$push': {'items': {'product_id': product_id, 'qty': quantity, 'selected': False, 'added_at': datetime.utcnow()}},
                                       '$set': {'updated_at': datetime.utcnow()}})
        if inserted.modified_count:
            return jsonify(success=True, message='Item added to cart')
    return jsonify(success=False, error=f'Cannot add more than available stock ({stock})'), 409


@bp.route('/<user_id>/update', methods=['PUT'])
def update_cart_item(user_id):
    db = current_app.db
    data = request.get_json()
    try:
        product_id = product_input(data)
    except ValueError as error:
        return jsonify(success=False, error=str(error)), 400
    quantity = data.get('quantity', data.get('qty'))
    if quantity is not None and (type(quantity) is not int or quantity < 1):
        return jsonify(success=False, error='Quantity must be a positive integer'), 400
    if 'selected' in data and type(data['selected']) is not bool:
        return jsonify(success=False, error='Selection must be true or false'), 400
    product = db.products.find_one({'_id': product_id})
    if not product or not product.get('is_active', True):
        return jsonify(success=False, error='Product not found'), 404
    if quantity is not None and quantity > product.get('stock', 0):
        return jsonify(success=False, error=f"Only {product.get('stock', 0)} items available"), 400
    changes = {'updated_at': datetime.utcnow()}
    if quantity is not None:
        changes['items.$.qty'] = quantity
    if 'selected' in data:
        changes['items.$.selected'] = data['selected']
    result = db.carts.update_one({'user_id': user_id, 'items.product_id': product_id}, {'$set': changes})
    if not result.matched_count:
        return jsonify(success=False, error='Item not found in cart'), 404
    return jsonify(success=True)


@bp.route('/<user_id>/remove', methods=['DELETE'])
def remove_from_cart(user_id):
    try:
        product_id = product_input(request.get_json())
    except ValueError as error:
        return jsonify(success=False, error=str(error)), 400
    result = current_app.db.carts.update_one({'user_id': user_id, 'items.product_id': product_id},
        {'$pull': {'items': {'product_id': product_id}}, '$set': {'updated_at': datetime.utcnow()}})
    if not result.matched_count:
        return jsonify(success=False, error='Item not found in cart'), 404
    return jsonify(success=True)


@bp.route('/<user_id>/clear', methods=['DELETE'])
def clear_cart(user_id):
    current_app.db.carts.update_one({'user_id': user_id}, {'$set': {'items': [], 'updated_at': datetime.utcnow()}})
    return jsonify(success=True)
