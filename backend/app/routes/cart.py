from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from datetime import datetime

bp = Blueprint('cart', __name__, url_prefix='/api/cart')

# Add OPTIONS handler for all cart routes
@bp.before_request
def handle_options():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

# Helper function to get full image URL
def get_full_image_url(image_path):
    """Convert relative image path to full URL"""
    if not image_path:
        return 'http://localhost:5000/static/uploads/default-product.jpg'
    
    if image_path.startswith('http'):
        return image_path
    
    if image_path.startswith('/'):
        return f'http://localhost:5000{image_path}'
    
    return f'http://localhost:5000/static/uploads/{image_path}'

@bp.route('/<user_id>', methods=['GET', 'OPTIONS'])
def get_user_cart(user_id):
    """Get user's cart from database"""
    try:
        db = current_app.db
        
        # Find user's cart or create empty one
        cart = db.carts.find_one({'user_id': user_id})
        
        if not cart:
            # Create empty cart for user
            cart_data = {
                'user_id': user_id,
                'items': [],
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            result = db.carts.insert_one(cart_data)
            cart = db.carts.find_one({'_id': result.inserted_id})
        
        # Get current product information for cart items
        updated_items = []
        for item in cart.get('items', []):
            try:
                product = db.products.find_one({'_id': ObjectId(item['product_id'])})
                if product and product.get('is_active', True):
                    # FIXED: Ensure image has full URL
                    product_image = product.get('image', '/static/uploads/default-product.jpg')
                    if not product_image.startswith('http'):
                        product_image = get_full_image_url(product_image)
                    
                    updated_items.append({
                        'id': str(product['_id']),
                        'product_id': item['product_id'],
                        'name': product.get('name', 'Unknown Product'),
                        'price': product.get('price', 0),
                        'condition': product.get('condition', 'Good'),
                        'image': product_image,  # Now with full URL
                        'currentStock': product.get('stock', 0),
                        'qty': min(item.get('qty', 1), product.get('stock', 0)),
                        'selected': item.get('selected', False)  # Default to False instead of auto-selecting
                    })
                else:
                    # Product not found or inactive
                    updated_items.append({
                        'id': item.get('product_id', ''),
                        'product_id': item.get('product_id', ''),
                        'name': item.get('name', 'Product No Longer Available'),
                        'price': item.get('price', 0),
                        'condition': 'Unavailable',
                        'image': get_full_image_url('/static/uploads/default-product.jpg'),  # Full URL
                        'currentStock': 0,
                        'qty': item.get('qty', 1),
                        'selected': False  # Always false for unavailable products
                    })
            except Exception as e:
                print(f"Error processing cart item: {e}")
                continue
        
        return jsonify({
            'success': True,
            'cart': updated_items
        }), 200
        
    except Exception as e:
        print(f"❌ Error getting user cart: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'cart': []
        }), 500

@bp.route('/<user_id>/add', methods=['POST', 'OPTIONS'])
def add_to_cart(user_id):
    """Add item to user's cart"""
    try:
        db = current_app.db
        data = request.get_json()
        
        product_id = data.get('product_id')
        quantity = data.get('quantity', 1)
        
        if not product_id:
            return jsonify({'success': False, 'error': 'Product ID is required'}), 400
        
        # Get product details
        product = db.products.find_one({'_id': ObjectId(product_id)})
        if not product or not product.get('is_active', True):
            return jsonify({'success': False, 'error': 'Product not found'}), 404
        
        # Check stock availability
        if product.get('stock', 0) < quantity:
            return jsonify({
                'success': False, 
                'error': f'Only {product.get("stock", 0)} items available'
            }), 400
        
        # Find or create user's cart
        cart = db.carts.find_one({'user_id': user_id})
        if not cart:
            cart_data = {
                'user_id': user_id,
                'items': [],
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            db.carts.insert_one(cart_data)
            cart = db.carts.find_one({'user_id': user_id})
        
        # Check if item already in cart
        existing_item = None
        for item in cart.get('items', []):
            if item.get('product_id') == product_id:
                existing_item = item
                break
        
        if existing_item:
            # Update quantity (ensure it doesn't exceed stock)
            new_qty = existing_item.get('qty', 0) + quantity
            if new_qty > product.get('stock', 0):
                return jsonify({
                    'success': False,
                    'error': f'Cannot add more than available stock ({product.get("stock", 0)})'
                }), 400
            
            # Update item in cart - don't auto-select
            db.carts.update_one(
                {'user_id': user_id, 'items.product_id': product_id},
                {'$set': {
                    'items.$.qty': new_qty,
                    # Keep the existing selected status, don't force to True
                    'updated_at': datetime.utcnow()
                }}
            )
        else:
            # Add new item to cart - default selected to False
            cart_item = {
                'product_id': product_id,
                'qty': quantity,
                'selected': False,  # Default to unchecked
                'added_at': datetime.utcnow()
            }
            
            db.carts.update_one(
                {'user_id': user_id},
                {
                    '$push': {'items': cart_item},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
        
        return jsonify({
            'success': True,
            'message': 'Item added to cart'
        }), 200
        
    except Exception as e:
        print(f"❌ Error adding to cart: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@bp.route('/<user_id>/update', methods=['PUT', 'OPTIONS'])
def update_cart_item(user_id):
    """Update cart item quantity"""
    try:
        db = current_app.db
        data = request.get_json()
        
        product_id = data.get('product_id')
        quantity = data.get('quantity')
        selected = data.get('selected')
        
        if not product_id:
            return jsonify({'success': False, 'error': 'Product ID is required'}), 400
        
        # Get product details to check stock
        product = db.products.find_one({'_id': ObjectId(product_id)})
        if not product or not product.get('is_active', True):
            return jsonify({'success': False, 'error': 'Product not found'}), 404
        
        # If updating quantity, validate against stock
        if quantity is not None:
            if quantity < 1:
                return jsonify({'success': False, 'error': 'Quantity must be at least 1'}), 400
            
            if quantity > product.get('stock', 0):
                return jsonify({
                    'success': False,
                    'error': f'Only {product.get("stock", 0)} items available'
                }), 400
        
        # Build update query
        update_fields = {}
        if quantity is not None:
            update_fields['items.$.qty'] = quantity
        if selected is not None:
            # Allow selection only if product is in stock, otherwise force to False
            update_fields['items.$.selected'] = selected and product.get('stock', 0) > 0
        
        update_fields['updated_at'] = datetime.utcnow()
        
        result = db.carts.update_one(
            {'user_id': user_id, 'items.product_id': product_id},
            {'$set': update_fields}
        )
        
        if result.modified_count == 0:
            return jsonify({'success': False, 'error': 'Item not found in cart'}), 404
        
        return jsonify({
            'success': True,
            'message': 'Cart updated successfully'
        }), 200
        
    except Exception as e:
        print(f"❌ Error updating cart: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@bp.route('/<user_id>/remove', methods=['DELETE', 'OPTIONS'])
def remove_from_cart(user_id):
    """Remove item from cart"""
    try:
        db = current_app.db
        data = request.get_json()
        
        product_id = data.get('product_id')
        
        if not product_id:
            return jsonify({'success': False, 'error': 'Product ID is required'}), 400
        
        result = db.carts.update_one(
            {'user_id': user_id},
            {
                '$pull': {'items': {'product_id': product_id}},
                '$set': {'updated_at': datetime.utcnow()}
            }
        )
        
        if result.modified_count == 0:
            return jsonify({'success': False, 'error': 'Item not found in cart'}), 404
        
        return jsonify({
            'success': True,
            'message': 'Item removed from cart'
        }), 200
        
    except Exception as e:
        print(f"❌ Error removing from cart: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@bp.route('/<user_id>/clear', methods=['DELETE', 'OPTIONS'])
def clear_cart(user_id):
    """Clear user's cart"""
    try:
        db = current_app.db
        
        result = db.carts.update_one(
            {'user_id': user_id},
            {
                '$set': {
                    'items': [],
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        return jsonify({
            'success': True,
            'message': 'Cart cleared successfully'
        }), 200
        
    except Exception as e:
        print(f"❌ Error clearing cart: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# NEW: Clear cart endpoint without user_id in URL (for checkout)
@bp.route('/clear', methods=['DELETE', 'OPTIONS'])
def clear_cart_with_body():
    """Clear user's cart using user ID from request body"""
    try:
        db = current_app.db
        data = request.get_json()
        
        user_id = data.get('userId')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID is required'}), 400
        
        result = db.carts.update_one(
            {'user_id': user_id},
            {
                '$set': {
                    'items': [],
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        return jsonify({
            'success': True,
            'message': 'Cart cleared successfully'
        }), 200
        
    except Exception as e:
        print(f"❌ Error clearing cart: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# NEW: Sync cart endpoint
@bp.route('/sync', methods=['POST', 'OPTIONS'])
def sync_cart():
    """Sync cart with database - used during checkout"""
    try:
        db = current_app.db
        data = request.get_json()
        
        user_id = data.get('userId')
        items = data.get('items', [])
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID is required'}), 400
        
        # Find or create user's cart
        cart = db.carts.find_one({'user_id': user_id})
        if not cart:
            cart_data = {
                'user_id': user_id,
                'items': [],
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            db.carts.insert_one(cart_data)
            cart = db.carts.find_one({'user_id': user_id})
        
        # Convert items to cart format
        cart_items = []
        for item in items:
            cart_items.append({
                'product_id': item.get('id'),
                'qty': item.get('qty', 1),
                'selected': True,  # Items in checkout are selected
                'added_at': datetime.utcnow()
            })
        
        # Update cart with new items
        result = db.carts.update_one(
            {'user_id': user_id},
            {
                '$set': {
                    'items': cart_items,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.modified_count:
            print(f"✅ Cart synced for user: {user_id}")
            return jsonify({
                'success': True,
                'message': 'Cart synced successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to sync cart'
            }), 500
        
    except Exception as e:
        print(f"❌ Error syncing cart: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# NEW: Add item to cart with user ID in request body (alternative endpoint)
@bp.route('/add', methods=['POST', 'OPTIONS'])
def add_to_cart_alt():
    """Add item to user's cart with user ID in request body"""
    try:
        db = current_app.db
        data = request.get_json()
        
        user_id = data.get('userId')
        product_id = data.get('productId')
        quantity = data.get('quantity', 1)
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID is required'}), 400
        
        if not product_id:
            return jsonify({'success': False, 'error': 'Product ID is required'}), 400
        
        # Get product details
        product = db.products.find_one({'_id': ObjectId(product_id)})
        if not product or not product.get('is_active', True):
            return jsonify({'success': False, 'error': 'Product not found'}), 404
        
        # Check stock availability
        if product.get('stock', 0) < quantity:
            return jsonify({
                'success': False, 
                'error': f'Only {product.get("stock", 0)} items available'
            }), 400
        
        # Find or create user's cart
        cart = db.carts.find_one({'user_id': user_id})
        if not cart:
            cart_data = {
                'user_id': user_id,
                'items': [],
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            db.carts.insert_one(cart_data)
            cart = db.carts.find_one({'user_id': user_id})
        
        # Check if item already in cart
        existing_item = None
        for item in cart.get('items', []):
            if item.get('product_id') == product_id:
                existing_item = item
                break
        
        if existing_item:
            # Update quantity (ensure it doesn't exceed stock)
            new_qty = existing_item.get('qty', 0) + quantity
            if new_qty > product.get('stock', 0):
                return jsonify({
                    'success': False,
                    'error': f'Cannot add more than available stock ({product.get("stock", 0)})'
                }), 400
            
            # Update item in cart - don't auto-select
            db.carts.update_one(
                {'user_id': user_id, 'items.product_id': product_id},
                {'$set': {
                    'items.$.qty': new_qty,
                    'updated_at': datetime.utcnow()
                }}
            )
        else:
            # Add new item to cart - default selected to False
            cart_item = {
                'product_id': product_id,
                'qty': quantity,
                'selected': False,  # Default to unchecked
                'added_at': datetime.utcnow()
            }
            
            db.carts.update_one(
                {'user_id': user_id},
                {
                    '$push': {'items': cart_item},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
        
        return jsonify({
            'success': True,
            'message': 'Item added to cart'
        }), 200
        
    except Exception as e:
        print(f"❌ Error adding to cart: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500