from ..discounts import discount_for
from ..validation import address as validate_address
from ..uploads import save_image
import binascii
from pymongo.errors import DuplicateKeyError
from ..order_workflow import transition_order
from flask import Blueprint, request, jsonify, current_app, g
from bson import ObjectId
import json
from datetime import datetime, timedelta
import base64
import os
import math

bp = Blueprint('orders', __name__, url_prefix='/api/orders')

# Shipping fee configuration by region
SHIPPING_FEES = {
    'metro_manila': {
        'name': 'Metro Manila',
        'fee': 50.00,
        'provinces': ['Metro Manila']
    },
    'luzon': {
        'name': 'Luzon',
        'fee': 80.00,
        'provinces': [
            'Abra', 'Albay', 'Apayao', 'Aurora', 'Bataan', 'Batanes', 'Batangas',
            'Benguet', 'Bulacan', 'Cagayan', 'Camarines Norte', 'Camarines Sur',
            'Catanduanes', 'Cavite', 'Ifugao', 'Ilocos Norte', 'Ilocos Sur',
            'Isabela', 'Kalinga', 'La Union', 'Laguna', 'Marinduque', 'Masbate',
            'Mountain Province', 'Nueva Ecija', 'Nueva Vizcaya', 'Occidental Mindoro',
            'Oriental Mindoro', 'Palawan', 'Pampanga', 'Pangasinan', 'Quezon',
            'Quirino', 'Rizal', 'Romblon', 'Sorsogon', 'Tarlac', 'Zambales'
        ]
    },
    'visayas': {
        'name': 'Visayas',
        'fee': 120.00,
        'provinces': [
            'Aklan', 'Antique', 'Biliran', 'Bohol', 'Capiz', 'Cebu', 'Eastern Samar',
            'Guimaras', 'Iloilo', 'Leyte', 'Negros Occidental', 'Negros Oriental',
            'Northern Samar', 'Samar', 'Siquijor', 'Southern Leyte'
        ]
    },
    'mindanao': {
        'name': 'Mindanao',
        'fee': 150.00,
        'provinces': [
            'Agusan del Norte', 'Agusan del Sur', 'Bukidnon', 'Camiguin',
            'Cotabato', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental',
            'Davao Oriental', 'Lanao del Norte', 'Misamis Occidental',
            'Misamis Oriental', 'Sarangani', 'South Cotabato', 'Sultan Kudarat',
            'Surigao del Norte', 'Surigao del Sur', 'Zamboanga del Norte',
            'Zamboanga del Sur', 'Zamboanga Sibugay'
        ]
    }
}

# JSON encoder to handle ObjectId
class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        return json.JSONEncoder.default(self, o)

# Helper function to get full image URL
def get_full_image_url(image_path):
    """Convert relative image path to full URL"""
    if not image_path:
        return request.host_url.rstrip('/') + '/static/uploads/default-product.jpg'

    if image_path.startswith('http'):
        return image_path

    if image_path.startswith('/'):
        return request.host_url.rstrip('/') + image_path

    return request.host_url.rstrip('/') + f'/static/uploads/{image_path}'

def calculate_shipping_fee(province):
    """Calculate shipping fee based on province"""
    for region, data in SHIPPING_FEES.items():
        if province in data['provinces']:
            return data['fee']

    # Default fee if province not found
    return 120.00

def check_and_auto_complete_orders():
    """Check and auto-complete orders that were shipped 10 days ago"""
    try:
        from .. import get_db
        db = get_db()
        if db is None:
            return

        ten_days_ago = datetime.now() - timedelta(days=10)

        # Find orders that were shipped more than 10 days ago and are still in 'shipped' status
        orders_to_complete = db.orders.find({
            'status': 'shipped',
            'shippedAt': {'$lte': ten_days_ago},
            'receiptConfirmedAt': {'$exists': False}  # Not manually confirmed
        })

        completed_count = 0
        for order in orders_to_complete:
            # Update order status to completed and mark as auto-completed
            result = db.orders.update_one(
                {'_id': order['_id']},
                {'$set': {
                    'status': 'completed',
                    'autoCompletedAt': datetime.now(),
                    'updatedAt': datetime.now()
                }}
            )
            if result.modified_count:
                completed_count += 1

        if completed_count > 0:
            pass

    except Exception as e:
        pass

@bp.route('/calculate-shipping', methods=['POST'])
def calculate_shipping():
    """Calculate shipping fee for a given province"""
    try:
        data = request.get_json()
        province = data.get('province')

        if not province:
            return jsonify({'success': False, 'error': 'Province is required'}), 400

        shipping_fee = calculate_shipping_fee(province)

        return jsonify({
            'success': True,
            'shippingFee': shipping_fee,
            'province': province
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/', methods=['GET', 'POST', 'OPTIONS'])
def orders():
    if request.method == 'OPTIONS':
        return '', 200

    if request.method == 'POST':
        try:
            data = request.get_json()

            # Validate required fields
            required_fields = ['userId', 'items', 'total', 'paymentMethod', 'shippingAddress']
            for field in required_fields:
                if field not in data:
                    return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400


            # Get database
            from .. import get_db
            db = get_db()
            if db is None:
                return jsonify({'success': False, 'error': 'Database connection failed'}), 500


            if data.get('checkoutId') and ObjectId.is_valid(data['checkoutId']):
                previous = db.orders.find_one({'_id': ObjectId(data['checkoutId']), 'userId': data['userId']})
                if previous:
                    return jsonify(success=True, orderId=str(previous['_id']), orderNumber=previous['orderNumber'],
                                   total=previous['total'], subtotal=previous['subtotal'], shippingFee=previous['shippingFee'], items=previous['items'], order=previous), 200

            if not isinstance(data['items'], list) or not data['items']:
                return jsonify(success=False, error='An order must contain at least one item'), 400
            try:
                data['shippingAddress'] = validate_address(data['shippingAddress'])
            except ValueError as error:
                return jsonify(success=False, error=str(error)), 400
            address = data['shippingAddress']
            if not isinstance(address, dict) or not all(isinstance(address.get(key), str) and address[key].strip() for key in ('recipient', 'contact', 'street', 'city', 'province')):
                return jsonify(success=False, error='A complete shipping address is required'), 400
            if data['paymentMethod'] not in ('gcash', 'paymaya'):
                return jsonify(success=False, error='Invalid payment method'), 400
            canonical_items = []
            seen = set()
            for item in data['items']:
                if not isinstance(item, dict) or not ObjectId.is_valid(item.get('id', '')):
                    return jsonify(success=False, error='Invalid product ID'), 400
                qty = item.get('qty')
                if type(qty) is not int or qty < 1:
                    return jsonify(success=False, error='Quantity must be a positive integer'), 400
                if item['id'] in seen:
                    return jsonify(success=False, error='Duplicate product in order'), 400
                seen.add(item['id'])
                product = db.products.find_one({'_id': ObjectId(item['id'])})
                if not product or not product.get('is_active', True):
                    return jsonify(success=False, error='Product is no longer available'), 404
                if product.get('stock', 0) < qty:
                    return jsonify(success=False, error=f"Insufficient stock for {product.get('name', 'product')}"), 400
                price = float(product.get('price', 0))
                if not math.isfinite(price) or price < 0:
                    return jsonify(success=False, error='Product price is unavailable'), 400
                canonical_items.append({**product, 'id': item['id'], 'qty': qty, 'price': price})
            data['items'] = canonical_items
            subtotal = round(sum(item['price'] * item['qty'] for item in canonical_items), 2)

            # Calculate shipping fee based on province
            shipping_address = data['shippingAddress']
            province = shipping_address.get('province', '')
            shipping_fee = calculate_shipping_fee(province)


            try:
                discount = discount_for(db, data.get('discountCode', ''), canonical_items)
            except ValueError as error:
                return jsonify(success=False, error=str(error)), 400

            # Generate order number and ID
            order_number = f"ORD-{datetime.now().strftime('%Y%m%d')}-{ObjectId()}"

            # Prepare order data with full image URLs
            order_data = {
                'orderNumber': order_number,
                'userId': data['userId'],
                'items': [],
                'subtotal': subtotal,
                'shippingFee': shipping_fee,  # Use calculated shipping fee
                'discountCode': discount['code'],
                'discountAmount': discount['amount'],
                'total': round(subtotal + shipping_fee - discount['amount'], 2),
                'paymentMethod': data['paymentMethod'],
                'shippingAddress': shipping_address,
                'status': 'pending',  # Start as 'pending'
                'orderDate': datetime.now(),
                'createdAt': datetime.now(),
                'updatedAt': datetime.now(),
                'stock_deducted': False,  # Track if stock has been deducted
                'shippingRegion': get_shipping_region(province)  # Store shipping region for reference
            }

            # Process items to ensure full image URLs
            for item in data['items']:
                # Ensure image has full URL
                item_image = item.get('image', '/static/uploads/default-product.jpg')
                if not item_image.startswith('http'):
                    item_image = get_full_image_url(item_image)

                order_data['items'].append({
                    'id': ObjectId(item['id']),
                    'name': item['name'],
                    'price': item['price'],
                    'qty': item['qty'],
                    'image': item.get('image', ''),
                    'condition': item.get('condition', 'Good'),
                    'size': item.get('size', ''),
                    'material': item.get('material', ''),
                    'category': item.get('category', 'General')
                })


            checkout_id = data.get('checkoutId')
            if checkout_id:
                if not ObjectId.is_valid(checkout_id):
                    return jsonify(success=False, error='Invalid checkout'), 400
                draft = db.checkouts.find_one({'orderId': ObjectId(checkout_id), 'userId': data['userId'], 'expiresAt': {'$gt': datetime.utcnow()}})
                if not draft:
                    return jsonify(success=False, error='Checkout changed. Refresh to continue.'), 409
                expected = {(str(item['productId']), item['qty']) for item in draft['items']}
                received = {(item['id'], item['qty']) for item in data['items']}
                if expected != received:
                    return jsonify(success=False, error='Checkout items changed. Refresh to continue.'), 409
                order_data['_id'] = draft['orderId']
                existing = db.orders.find_one({'_id': draft['orderId'], 'userId': data['userId']})
                if existing:
                    return jsonify(success=True, orderId=str(existing['_id']), orderNumber=existing['orderNumber'],
                                   total=existing['total'], subtotal=existing['subtotal'], shippingFee=existing['shippingFee'], items=existing['items'], order=existing), 200
            try:
                result = db.orders.insert_one(order_data)
                inserted_id = result.inserted_id
            except DuplicateKeyError:
                if not checkout_id:
                    raise
                existing = db.orders.find_one({'_id': draft['orderId'], 'userId': data['userId']})
                return jsonify(success=True, orderId=str(existing['_id']), orderNumber=existing['orderNumber'],
                               total=existing['total'], subtotal=existing['subtotal'], shippingFee=existing['shippingFee'], items=existing['items'], order=existing), 200

            return jsonify({
                'success': True,
                'orderId': str(inserted_id),
                'orderNumber': order_number,
                'message': 'Order created successfully',
                'shippingFee': shipping_fee,
                'subtotal': subtotal,
                'total': order_data['total'],
                'items': order_data['items'],
                'order': order_data
            }), 201

        except Exception as e:
            import traceback
            return jsonify({'success': False, 'error': str(e)}), 500

    elif request.method == 'GET':
        # Handle GET request for orders
        try:
            from .. import get_db
            db = get_db()
            if db is None:
                return jsonify({'success': False, 'error': 'Database connection failed'}), 500

            # Check for auto-completion before returning orders
            check_and_auto_complete_orders()

            orders = list(db.orders.find().sort('createdAt', -1))

            # Convert ObjectId to string and ensure full image URLs
            for order in orders:
                order['_id'] = str(order['_id'])
                # Ensure all items have full image URLs
                for item in order.get('items', []):
                    if 'image' in item and not item['image'].startswith('http'):
                        item['image'] = get_full_image_url(item['image'])

            return jsonify({
                'success': True,
                'orders': orders
            })

        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/<order_id>', methods=['GET', 'PUT', 'DELETE', 'OPTIONS'])
def order_detail(order_id):
    if request.method == 'OPTIONS':
        return '', 200

    try:
        from .. import get_db
        db = get_db()
        if db is None:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500

        if request.method == 'GET':
            # Check for auto-completion before returning order details
            check_and_auto_complete_orders()

            order = db.orders.find_one({'_id': ObjectId(order_id)})
            if not order:
                return jsonify({'success': False, 'error': 'Order not found'}), 404

            order['_id'] = str(order['_id'])

            # FIXED: Ensure all items have full image URLs
            for item in order.get('items', []):
                if 'image' in item and not item['image'].startswith('http'):
                    item['image'] = get_full_image_url(item['image'])

            return jsonify({'success': True, 'order': order})

        elif request.method == 'PUT':
            data = request.get_json()

            existing = db.orders.find_one({'_id': ObjectId(order_id)})
            if not existing:
                return jsonify(success=False, error='Order not found'), 404
            try:
                update_data = transition_order(existing, data)
            except ValueError as error:
                return jsonify(success=False, error=str(error)), 400

            result = db.orders.update_one(
                {'_id': ObjectId(order_id), 'status': existing.get('status', 'pending')},
                {'$set': update_data}
            )

            if result.modified_count:
                # Return the updated order with tracking number
                updated_order = db.orders.find_one({'_id': ObjectId(order_id)})
                updated_order['_id'] = str(updated_order['_id'])

                # Ensure all items have full image URLs
                for item in updated_order.get('items', []):
                    if 'image' in item and not item['image'].startswith('http'):
                        item['image'] = get_full_image_url(item['image'])

                return jsonify({
                    'success': True,
                    'message': 'Order updated successfully',
                    'order': updated_order
                })
            else:
                return jsonify(success=False, error='This order changed in another tab. Refresh before updating it.'), 409

        elif request.method == 'DELETE':
            result = db.orders.delete_one({'_id': ObjectId(order_id)})
            if result.deleted_count:
                return jsonify({'success': True, 'message': 'Order deleted successfully'})
            else:
                return jsonify({'success': False, 'error': 'Order not found'}), 404

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/user/<user_id>', methods=['GET'])
def get_user_orders(user_id):
    """Get orders for specific user"""
    try:
        from .. import get_db
        db = get_db()
        if db is None:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500


        # Check for auto-completion before returning user orders
        check_and_auto_complete_orders()

        # Find orders by user ID
        user_orders = list(db.orders.find({'userId': user_id}).sort('createdAt', -1))

        # Convert ObjectId to string and ensure full image URLs
        for order in user_orders:
            order['_id'] = str(order['_id'])
            # Ensure all items have full image URLs
            for item in order.get('items', []):
                if 'image' in item and not item['image'].startswith('http'):
                    item['image'] = get_full_image_url(item['image'])


        return jsonify({
            'success': True,
            'orders': user_orders
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/<order_id>/confirm-receipt', methods=['PUT'])
def confirm_order_receipt(order_id):
    """Customer confirms they received the product with photo proof"""
    try:
        from .. import get_db
        db = get_db()
        if db is None:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500

        data = request.get_json()
        user_id = getattr(g, 'owner_id', None) or data.get('userId')
        order = db.orders.find_one({'_id': ObjectId(order_id), 'userId': user_id})
        if not order:
            return jsonify(success=False, error='Order not found or access denied'), 404
        if order.get('status') == 'completed' and order.get('receiptProof'):
            return jsonify(success=True, status='completed', message='Delivery was already confirmed.')
        if order.get('status') != 'shipped':
            return jsonify(success=False, error='The order must be shipped before confirming delivery.'), 409
        proof = data.get('proofImage')
        try:
            if not isinstance(proof, str):
                raise ValueError('Choose a delivery photo.')
            encoded = proof.split(',', 1)[-1]
            image = base64.b64decode(encoded, validate=True)
            path = save_image(image, 'receipts')
        except (ValueError, binascii.Error) as error:
            return jsonify(success=False, error=str(error)), 400
        result = db.orders.update_one({'_id': ObjectId(order_id), 'userId': user_id, 'status': 'shipped'}, {'$set': {
            'status': 'completed', 'receiptConfirmedAt': datetime.now(), 'completedAt': datetime.now(),
            'receiptProof': path, 'updatedAt': datetime.now(),
        }})
        if not result.modified_count:
            os.remove(os.path.join(current_app.config['UPLOAD_FOLDER'], path.removeprefix('/static/uploads/')))
            latest = db.orders.find_one({'_id': ObjectId(order_id), 'userId': user_id})
            if latest and latest.get('receiptProof'):
                return jsonify(success=True, status='completed', message='Delivery was already confirmed.')
            return jsonify(success=False, error='This order changed. Refresh and try again.'), 409
        return jsonify(success=True, status='completed', message='Delivery confirmed. Thank you!')

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# NEW: Payment Proof Upload Endpoint - FIXED: Don't change status to confirmed
@bp.route('/upload-payment-proof', methods=['POST', 'OPTIONS'])
def upload_payment_proof():
    if request.method == 'OPTIONS':
        return '', 200
    from .. import get_db
    db = get_db()
    if db is None:
        return jsonify(success=False, error='Database connection failed'), 503
    order_id = request.form.get('orderId', '')
    user_id = getattr(g, 'owner_id', None) or request.form.get('userId')
    proof = request.files.get('paymentProof')
    if not ObjectId.is_valid(order_id) or not user_id or not proof or not proof.filename:
        return jsonify(success=False, error='A valid order, user and payment proof are required'), 400
    extension = proof.filename.rsplit('.', 1)[-1].lower()
    if extension not in {'png', 'jpg', 'jpeg', 'gif', 'webp'}:
        return jsonify(success=False, error='Upload a PNG, JPG, GIF or WebP image'), 400
    proof.seek(0, 2)
    size = proof.tell()
    proof.seek(0)
    if size == 0 or size > 5 * 1024 * 1024:
        return jsonify(success=False, error='Image must be between 1 byte and 5MB'), 400
    header = proof.read(16)
    proof.seek(0)
    signatures = {
        'png': header.startswith(b'\x89PNG\r\n\x1a\n'),
        'jpg': header.startswith(b'\xff\xd8\xff'),
        'jpeg': header.startswith(b'\xff\xd8\xff'),
        'gif': header.startswith((b'GIF87a', b'GIF89a')),
        'webp': header.startswith(b'RIFF') and header[8:12] == b'WEBP',
    }
    if not signatures[extension]:
        return jsonify(success=False, error='The file content does not match its image type'), 400
    query = {'_id': ObjectId(order_id), 'userId': user_id}
    order = db.orders.find_one(query)
    if not order:
        return jsonify(success=False, error='Order not found'), 404
    if order.get('paymentProof'):
        return jsonify(success=True, message='Payment proof already received', proofPath=order['paymentProof'])
    if order.get('status') not in ('pending', 'pending_payment'):
        return jsonify(success=False, error='This order cannot accept a payment proof'), 409
    # Claim this order so simultaneous retries cannot deduct its stock twice.
    claim = db.orders.update_one({**query, 'paymentProcessing': {'$ne': True}, 'paymentProof': {'$exists': False}}, {'$set': {'paymentProcessing': True}})
    if not claim.modified_count:
        return jsonify(success=False, error='Payment proof is already being processed. Please retry shortly.'), 409
    deducted = []
    filepath = None
    committed = False
    try:
        filename = f"payment_proof_{order_id}_{ObjectId()}.{extension}"
        directory = os.path.join(current_app.config['UPLOAD_FOLDER'], 'payment_proofs')
        os.makedirs(directory, exist_ok=True)
        filepath = os.path.join(directory, filename)
        proof.save(filepath)
        if not order.get('stock_deducted'):
            for item in order['items']:
                product_id = ObjectId(item['id'])
                qty = item['qty']
                result = db.products.update_one({'_id': product_id, 'stock': {'$gte': qty}, 'is_active': {'$ne': False}}, {'$inc': {'stock': -qty}})
                if not result.modified_count:
                    raise ValueError(f"Insufficient stock for {item.get('name', 'product')}. Contact the store before retrying payment.")
                deducted.append((product_id, qty))
        proof_path = f'/static/uploads/payment_proofs/{filename}'
        db.orders.update_one(query, {'$set': {'paymentProof': proof_path, 'paymentProofUploadedAt': datetime.now(), 'updatedAt': datetime.now(), 'stock_deducted': True, 'status': 'pending'}, '$unset': {'paymentProcessing': ''}})
        committed = True
        db.checkouts.delete_one({'userId': user_id, 'orderId': ObjectId(order_id)})
        # Use stored cart quantities, which are not clamped to the newly reduced stock.
        cart = db.carts.find_one({'user_id': user_id})
        if cart:
            quantities = {str(item['id']): item['qty'] for item in order['items']}
            for item in cart.get('items', []):
                product_id = item.get('product_id')
                if str(product_id) in quantities:
                    remaining = item.get('qty', 0) - quantities[str(product_id)]
                    if remaining <= 0:
                        db.carts.update_one({'user_id': user_id}, {'$pull': {'items': {'product_id': product_id}}})
                    else:
                        db.carts.update_one({'user_id': user_id, 'items.product_id': product_id}, {'$inc': {'items.$.qty': -quantities[str(product_id)]}})
        return jsonify(success=True, message='Payment proof received. Awaiting store verification.', proofPath=proof_path)
    except Exception as error:
        if committed:
            # The proof and stock are committed; a cart cleanup failure must not undo payment.
            current_app.logger.exception('Cart cleanup failed after payment proof upload')
            return jsonify(success=True, message='Payment proof received. Refresh your cart.', proofPath=proof_path)
        for product_id, qty in deducted:
            db.products.update_one({'_id': product_id}, {'$inc': {'stock': qty}})
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
        db.orders.update_one(query, {'$unset': {'paymentProcessing': ''}})
        current_app.logger.exception('Payment proof upload failed')
        return jsonify(success=False, error=str(error)), 409


def get_shipping_region(province):
    """Get shipping region name for a province"""
    for region, data in SHIPPING_FEES.items():
        if province in data['provinces']:
            return data['name']
    return 'Unknown Region'
