"""Private liked items, scoped exclusively to the authenticated session owner."""
from datetime import datetime, timezone
from bson import ObjectId
from flask import Blueprint, current_app, g, jsonify, request
from pymongo.errors import DuplicateKeyError

bp = Blueprint('favorites', __name__, url_prefix='/api/favorites')


def unexpected_input():
    # No supplied owner, arbitrary filters, or product metadata can change scope.
    return bool(request.args or (request.content_length and request.get_json(silent=True) != {}))


@bp.get('')
def liked_items():
    if unexpected_input():
        return jsonify(success=False, error='This request does not accept additional fields.'), 400
    documents = current_app.db.favorites.find({'userId': g.user['_id']}, {'productId': 1}).sort('createdAt', -1)
    return jsonify(success=True, productIds=[str(item['productId']) for item in documents])


@bp.route('/<product_id>', methods=['PUT', 'DELETE'])
def set_liked_item(product_id):
    if unexpected_input():
        return jsonify(success=False, error='This request does not accept additional fields.'), 400
    relation = {'userId': g.user['_id'], 'productId': ObjectId(product_id)}
    if request.method == 'DELETE':
        current_app.db.favorites.delete_one(relation)
        return jsonify(success=True, liked=False, productId=product_id)
    product = current_app.db.products.find_one(
        {'_id': relation['productId']},
        {'is_active': 1, 'isActive': 1, 'stock': 1},
    )
    if (
        not product
        or product.get('is_active', product.get('isActive', True)) is False
        or not isinstance(product.get('stock'), (int, float))
        or product.get('stock', 0) <= 0
    ):
        return jsonify(success=False, error='This piece is no longer available.'), 404
    try:
        current_app.db.favorites.update_one(relation, {'$setOnInsert': {
            **relation, 'createdAt': datetime.now(timezone.utc)}}, upsert=True)
    except DuplicateKeyError:
        # Concurrent identical requests represent the same idempotent like.
        pass
    return jsonify(success=True, liked=True, productId=product_id)
