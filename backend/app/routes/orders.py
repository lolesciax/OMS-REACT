from flask import Blueprint, request, jsonify
from bson import ObjectId
import json
from datetime import datetime
import base64
import os

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
        return 'http://localhost:5000/static/uploads/default-product.jpg'
    
    if image_path.startswith('http'):
        return image_path
    
    if image_path.startswith('/'):
        return f'http://localhost:5000{image_path}'
    
    return f'http://localhost:5000/static/uploads/{image_path}'

def calculate_shipping_fee(province):
    """Calculate shipping fee based on province"""
    for region, data in SHIPPING_FEES.items():
        if province in data['provinces']:
            return data['fee']
    
    # Default fee if province not found
    return 120.00

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
            print("📦 Received order request")
            data = request.get_json()
            print(f"📋 Order data received: {data}")
            
            # Validate required fields
            required_fields = ['userId', 'items', 'total', 'paymentMethod', 'shippingAddress']
            for field in required_fields:
                if field not in data:
                    print(f"❌ Missing required field: {field}")
                    return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400
            
            print("✅ All required fields present")
            
            # Get database
            from .. import get_db
            db = get_db()
            if db is None:
                print("❌ Database connection failed")
                return jsonify({'success': False, 'error': 'Database connection failed'}), 500
            
            print("✅ Database connected successfully")
            
            # Check stock availability (but don't deduct yet)
            for item in data['items']:
                product = db.products.find_one({'_id': ObjectId(item['id'])})
                if not product:
                    return jsonify({
                        'success': False, 
                        'error': f"Product not found: {item.get('name', 'Unknown')}"
                    }), 404
                
                if product['stock'] < item['qty']:
                    return jsonify({
                        'success': False,
                        'error': f"Insufficient stock for {product['name']}. Available: {product['stock']}, Requested: {item['qty']}"
                    }), 400
            
            # Calculate shipping fee based on province
            shipping_address = data['shippingAddress']
            province = shipping_address.get('province', '')
            shipping_fee = calculate_shipping_fee(province)
            
            print(f"📍 Shipping to {province}, fee: ₱{shipping_fee}")
            
            # Generate order number and ID
            order_number = f"ORD-{datetime.now().strftime('%Y%m%d')}-{ObjectId()}"
            print(f"📝 Generated order number: {order_number}")
            
            # Prepare order data with full image URLs
            order_data = {
                'orderNumber': order_number,
                'userId': data['userId'],
                'items': [],
                'subtotal': data.get('subtotal', 0),
                'shippingFee': shipping_fee,  # Use calculated shipping fee
                'total': data['total'],
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
                    'id': item['id'],
                    'name': item['name'],
                    'price': item['price'],
                    'qty': item['qty'],
                    'image': item_image,  # Now with full URL
                    'condition': item.get('condition', 'Good'),
                    'size': item.get('size', ''),
                    'material': item.get('material', ''),
                    'stock': item.get('stock', 0),
                    'category': item.get('category', 'General')
                })
            
            print(f"💾 Attempting to save order: {order_data}")
            
            # Insert into database
            result = db.orders.insert_one(order_data)
            print(f"✅ Order saved successfully with ID: {result.inserted_id}")
            
            return jsonify({
                'success': True,
                'orderId': str(result.inserted_id),
                'orderNumber': order_number,
                'message': 'Order created successfully',
                'shippingFee': shipping_fee
            }), 201
            
        except Exception as e:
            print(f"❌ Error creating order: {str(e)}")
            import traceback
            print(f"🔍 Stack trace: {traceback.format_exc()}")
            return jsonify({'success': False, 'error': str(e)}), 500
    
    elif request.method == 'GET':
        # Handle GET request for orders
        try:
            from .. import get_db
            db = get_db()
            if db is None:
                return jsonify({'success': False, 'error': 'Database connection failed'}), 500
            
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
            result = db.orders.update_one(
                {'_id': ObjectId(order_id)},
                {'$set': {**data, 'updatedAt': datetime.now()}}
            )
            
            if result.modified_count:
                return jsonify({'success': True, 'message': 'Order updated successfully'})
            else:
                return jsonify({'success': False, 'error': 'Order not found or no changes made'}), 404
                
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
        
        print(f"🔍 Fetching orders for user: {user_id}")
        
        # Find orders by user ID
        user_orders = list(db.orders.find({'userId': user_id}).sort('createdAt', -1))
        
        # Convert ObjectId to string and ensure full image URLs
        for order in user_orders:
            order['_id'] = str(order['_id'])
            # Ensure all items have full image URLs
            for item in order.get('items', []):
                if 'image' in item and not item['image'].startswith('http'):
                    item['image'] = get_full_image_url(item['image'])
        
        print(f"✅ Found {len(user_orders)} orders for user: {user_id}")
        
        return jsonify({
            'success': True,
            'orders': user_orders
        })
        
    except Exception as e:
        print(f"❌ Error fetching user orders: {e}")
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
        user_id = data.get('userId')
        proof_image = data.get('proofImage')  # Base64 encoded image
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID is required'}), 400
        
        if not proof_image:
            return jsonify({'success': False, 'error': 'Proof image is required'}), 400
        
        # Find the order and verify it belongs to the user
        order = db.orders.find_one({'_id': ObjectId(order_id), 'userId': user_id})
        if not order:
            return jsonify({'success': False, 'error': 'Order not found or access denied'}), 404
        
        # Only allow confirmation if order is shipped
        if order.get('status') != 'shipped':
            return jsonify({'success': False, 'error': 'Order must be shipped before confirming receipt'}), 400
        
        # Save proof image
        proof_filename = f"receipt_proof_{order_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        proof_path = os.path.join('static/uploads/receipts', proof_filename)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(proof_path), exist_ok=True)
        
        # Decode and save the image
        try:
            # Remove data URL prefix if present
            if ',' in proof_image:
                proof_image = proof_image.split(',')[1]
            
            image_data = base64.b64decode(proof_image)
            with open(proof_path, 'wb') as f:
                f.write(image_data)
        except Exception as e:
            return jsonify({'success': False, 'error': f'Failed to save proof image: {str(e)}'}), 400
        
        # Update order status to 'completed' with proof
        result = db.orders.update_one(
            {'_id': ObjectId(order_id)},
            {'$set': {
                'status': 'completed',
                'receiptConfirmedAt': datetime.now(),
                'receiptProof': f'/static/uploads/receipts/{proof_filename}',
                'updatedAt': datetime.now()
            }}
        )
        
        if result.modified_count:
            return jsonify({
                'success': True, 
                'message': 'Order receipt confirmed successfully with proof',
                'status': 'completed'
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to update order status'}), 400
            
    except Exception as e:
        print(f"❌ Error confirming order receipt: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# NEW: Payment Proof Upload Endpoint - FIXED: Don't change status to confirmed
@bp.route('/upload-payment-proof', methods=['POST'])
def upload_payment_proof():
    """Handle payment proof image upload - FIXED: Keep status as pending"""
    try:
        print("📸 Received payment proof upload request")
        
        # Get form data
        order_id = request.form.get('orderId')
        user_id = request.form.get('userId')
        payment_method = request.form.get('paymentMethod')
        payment_proof = request.files.get('paymentProof')
        
        print(f"📋 Payment proof data - Order: {order_id}, User: {user_id}")
        
        # Validate required fields
        if not all([order_id, user_id, payment_proof]):
            return jsonify({
                'success': False, 
                'error': 'Missing required fields: orderId, userId, or paymentProof'
            }), 400
        
        # Get database
        from .. import get_db
        db = get_db()
        if db is None:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500
        
        # Find the order and verify it belongs to the user
        order = db.orders.find_one({'_id': ObjectId(order_id), 'userId': user_id})
        if not order:
            return jsonify({'success': False, 'error': 'Order not found or access denied'}), 404
        
        # Check if stock has already been deducted for this order
        if order.get('stock_deducted'):
            print("⚠️ Stock already deducted for this order, skipping stock deduction")
        else:
            # NEW: Deduct stock from products after payment proof is uploaded
            print("📦 Deducting stock from products after payment verification")
            for item in order['items']:
                product = db.products.find_one({'_id': ObjectId(item['id'])})
                if product:
                    # Check stock availability again before deducting
                    if product['stock'] >= item['qty']:
                        # Deduct the exact quantity ordered by the user
                        new_stock = product['stock'] - item['qty']
                        db.products.update_one(
                            {'_id': ObjectId(item['id'])},
                            {'$set': {'stock': new_stock}}
                        )
                        print(f"✅ Stock deducted for {product['name']}: {product['stock']} -> {new_stock} (-{item['qty']})")
                    else:
                        print(f"❌ Insufficient stock for {product['name']}. Available: {product['stock']}, Requested: {item['qty']}")
                        return jsonify({
                            'success': False,
                            'error': f"Insufficient stock for {product['name']}. Available: {product['stock']}, Requested: {item['qty']}"
                        }), 400
                else:
                    print(f"❌ Product not found: {item['id']}")
                    return jsonify({
                        'success': False,
                        'error': f"Product not found: {item.get('name', 'Unknown')}"
                    }), 404
        
        # Validate file
        if not payment_proof.filename:
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        # Check file extension
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        file_ext = payment_proof.filename.rsplit('.', 1)[1].lower() if '.' in payment_proof.filename else ''
        if file_ext not in allowed_extensions:
            return jsonify({
                'success': False, 
                'error': 'Invalid file type. Allowed: PNG, JPG, JPEG, GIF, WebP'
            }), 400
        
        # Check file size (max 5MB)
        payment_proof.seek(0, 2)  # Seek to end
        file_size = payment_proof.tell()
        payment_proof.seek(0)  # Reset to beginning
        
        if file_size > 5 * 1024 * 1024:
            return jsonify({'success': False, 'error': 'File size too large. Maximum 5MB allowed'}), 400
        
        # Create payment proofs directory if it doesn't exist
        payment_proofs_dir = os.path.join('static', 'uploads', 'payment_proofs')
        os.makedirs(payment_proofs_dir, exist_ok=True)
        
        # Generate unique filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"payment_proof_{order_id}_{timestamp}.{file_ext}"
        filepath = os.path.join(payment_proofs_dir, filename)
        
        # Save the file
        payment_proof.save(filepath)
        print(f"✅ Payment proof saved: {filepath}")
        
        # FIXED: Update order with payment proof but KEEP status as 'pending'
        # Only mark stock as deducted and add payment proof
        update_data = {
            'paymentProof': f'/static/uploads/payment_proofs/{filename}',
            'paymentProofUploadedAt': datetime.now(),
            'status': 'pending',  # FIXED: Keep status as 'pending' - don't change to 'confirmed'
            'updatedAt': datetime.now(),
            'stock_deducted': True  # Mark that stock has been deducted
        }
        
        result = db.orders.update_one(
            {'_id': ObjectId(order_id)},
            {'$set': update_data}
        )
        
        if result.modified_count:
            print(f"✅ Order {order_id} updated with payment proof and stock deducted - STATUS REMAINS PENDING")
            return jsonify({
                'success': True,
                'message': 'Payment proof uploaded successfully and stock deducted. Order remains pending for admin confirmation.',
                'proofPath': f'/static/uploads/payment_proofs/{filename}'
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to update order with payment proof'}), 500
            
    except Exception as e:
        print(f"❌ Error uploading payment proof: {str(e)}")
        import traceback
        print(f"🔍 Stack trace: {traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

def get_shipping_region(province):
    """Get shipping region name for a province"""
    for region, data in SHIPPING_FEES.items():
        if province in data['provinces']:
            return data['name']
    return 'Unknown Region'