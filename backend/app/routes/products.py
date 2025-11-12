from flask import Blueprint, request, jsonify, send_from_directory, current_app
from bson import ObjectId
from datetime import datetime
import os
from werkzeug.utils import secure_filename
import json

bp = Blueprint('products', __name__, url_prefix='/api/products')

# Add OPTIONS handler for all product routes
@bp.before_request
def handle_options():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')  # FIXED: Changed from 5000 to 5173
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

# ---------------- Helper ----------------
def allowed_file(filename):
    if not filename:
        return False
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

def get_full_image_url(image_path):
    """Convert relative image path to full URL"""
    if not image_path:
        return 'http://localhost:5000/static/uploads/default-product.jpg'
    
    if image_path.startswith('http'):
        return image_path
    
    if image_path.startswith('/'):
        return f'http://localhost:5000{image_path}'
    
    return f'http://localhost:5000/static/uploads/{image_path}'

def serialize_doc(doc):
    """Convert MongoDB ObjectId to string and ensure valid image paths."""
    if not doc:
        return doc
    
    doc['_id'] = str(doc['_id'])
    
    # Ensure image has full URL
    if not doc.get('image'):
        doc['image'] = 'http://localhost:5000/static/uploads/default-product.jpg'
    elif not doc['image'].startswith('http'):
        doc['image'] = get_full_image_url(doc['image'])
    
    return doc

# ---------------- Product Model ----------------
class ProductModel:
    def __init__(self, db):
        self.col = db.products

    def all(self):
        """Return all active products."""
        return list(self.col.find({'is_active': True}))

    def create(self, data):
        """Insert a new product document."""
        res = self.col.insert_one(data)
        return res.inserted_id

    def update(self, pid, data):
        """Update an existing product by ID."""
        return self.col.update_one({'_id': ObjectId(pid)}, {'$set': data}).modified_count > 0

    def delete(self, pid):
        """Permanently delete a product by ID."""
        return self.col.delete_one({'_id': ObjectId(pid)}).deleted_count > 0

    def get_by_id(self, pid):
        """Get product by ID"""
        return self.col.find_one({'_id': ObjectId(pid)})

# ---------------- DB Helper ----------------
def get_db():
    from flask import current_app
    return current_app.db

# ---------------- Routes ----------------
@bp.route('/static/uploads/<path:filename>')
def uploaded_file(filename):
    """Serve uploaded files."""
    upload_folder = current_app.config['UPLOAD_FOLDER']
    return send_from_directory(upload_folder, filename)

@bp.route('/', methods=['GET'])
def get_products():
    """Get all active products."""
    try:
        db = get_db()
        model = ProductModel(db)
        products = [serialize_doc(p) for p in model.all()]
        return jsonify({'products': products})
    except Exception as e:
        print(f"❌ Error getting products: {str(e)}")
        return jsonify({'error': str(e)}), 500

@bp.route('/<product_id>', methods=['GET'])
def get_product(product_id):
    """Get single product by ID"""
    try:
        db = get_db()
        model = ProductModel(db)
        product = model.get_by_id(product_id)
        
        if not product:
            return jsonify({'error': 'Product not found'}), 404
            
        return jsonify({'product': serialize_doc(product)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ✅ Helper: Generate professional product ID
def generate_product_id(db):
    """Generate formatted product ID like PROD-000001"""
    last_product = db.products.find_one(
        {"product_id": {"$regex": "^PROD-"}},
        sort=[("product_id", -1)]
    )
    next_id = 1
    if last_product and "product_id" in last_product:
        try:
            next_id = int(last_product["product_id"].split("-")[1]) + 1
        except Exception as e:
            print(f"⚠️ Product ID parse error: {e}")
    return f"PROD-{next_id:06d}"

@bp.route('/', methods=['POST'])
def create_product():
    """Create a new product."""
    try:
        db = get_db()
        model = ProductModel(db)

        # Check if form data is present
        if not request.form:
            return jsonify({'error': 'No form data provided'}), 400

        name = request.form.get('name')
        category = request.form.get('category')
        price = request.form.get('price')
        stock = request.form.get('stock')
        condition = request.form.get('condition', 'Good')
        description = request.form.get('description', '')
        size = request.form.get('size', '')
        material = request.form.get('material', '')
        image = request.files.get('image')

        # Validate required fields
        if not all([name, category, price, stock]):
            return jsonify({'error': 'Missing required fields: name, category, price, stock'}), 400

        # Handle image upload - FIXED PATH ISSUE
        image_filename = None
        if image and image.filename:
            if allowed_file(image.filename):
                # Generate unique filename with timestamp
                timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')
                original_name = secure_filename(image.filename)
                name_without_ext = os.path.splitext(original_name)[0]
                extension = os.path.splitext(original_name)[1]
                unique_filename = f"{name_without_ext}_{timestamp}{extension}"
                
                # Use app config for upload folder - FIXED: Use absolute path
                upload_folder = os.path.join(current_app.root_path, current_app.config['UPLOAD_FOLDER'])
                save_path = os.path.join(upload_folder, unique_filename)
                
                # Ensure directory exists
                os.makedirs(upload_folder, exist_ok=True)
                
                # Save the file
                image.save(save_path)
                image_filename = unique_filename
                print(f"✅ Image saved: {save_path}")
                print(f"📁 Upload folder: {upload_folder}")
                print(f"🌐 Image will be served from: /static/uploads/{unique_filename}")
            else:
                return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, gif'}), 400

        # ✅ Generate new formatted product ID
        product_id = generate_product_id(db)

        # Create image URL - FIXED: Use relative path for serving
        if image_filename:
            image_url = f"/static/uploads/{image_filename}"  # Changed to relative path
        else:
            image_url = "/static/uploads/default-product.jpg"  # Changed to relative path

        # Create product data
        data = {
            'product_id': product_id,
            'name': name.strip(),
            'category': category.strip(),
            'price': float(price),
            'stock': int(stock),
            'condition': condition,
            'description': description.strip(),
            'size': size.strip(),
            'material': material.strip(),
            'image': image_url,  # Store relative path
            'is_active': True,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        # Insert into database
        inserted_id = model.create(data)
        print(f"✅ Product added: {product_id} - {name}")
        print(f"📸 Image URL stored: {image_url}")
        
        # Return the created product with full URL
        created_product = model.get_by_id(inserted_id)
        
        return jsonify({
            'success': True,
            'message': 'Product added successfully',
            'product_id': product_id,
            'image_url': get_full_image_url(image_url),  # Return full URL in response
            'product': serialize_doc(created_product)
        }), 201

    except Exception as e:
        print(f"❌ Error creating product: {str(e)}")
        return jsonify({'error': f'Failed to create product: {str(e)}'}), 500

@bp.route('/<pid>', methods=['PUT'])
def update_product(pid):
    """Update an existing product."""
    try:
        db = get_db()
        model = ProductModel(db)
        
        # Get existing product
        existing_product = model.get_by_id(pid)
        if not existing_product:
            return jsonify({'error': 'Product not found'}), 404

        data = request.form.to_dict()
        image = request.files.get('image')

        # Handle image update - FIXED PATH ISSUE
        if image and image.filename and allowed_file(image.filename):
            upload_folder = os.path.join(current_app.root_path, current_app.config['UPLOAD_FOLDER'])
            
            # Generate unique filename with timestamp
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')
            original_name = secure_filename(image.filename)
            name_without_ext = os.path.splitext(original_name)[0]
            extension = os.path.splitext(original_name)[1]
            unique_filename = f"{name_without_ext}_{timestamp}{extension}"
            save_path = os.path.join(upload_folder, unique_filename)
            
            # Ensure directory exists
            os.makedirs(upload_folder, exist_ok=True)
            
            # Save the file
            image.save(save_path)
            data['image'] = f'/static/uploads/{unique_filename}'  # Store relative path
            print(f"✅ Updated image saved: {save_path}")

        data['updated_at'] = datetime.utcnow()
        success = model.update(pid, data)
        
        if success:
            updated_product = model.get_by_id(pid)
            return jsonify({
                'success': True,
                'message': 'Product updated successfully',
                'product': serialize_doc(updated_product)
            })
        else:
            return jsonify({'message': 'No changes made'})

    except Exception as e:
        print(f"❌ Error updating product: {str(e)}")
        return jsonify({'error': f'Failed to update product: {str(e)}'}), 500

@bp.route('/<pid>', methods=['DELETE'])
def delete_product(pid):
    """Permanently delete a product."""
    try:
        db = get_db()
        model = ProductModel(db)
        success = model.delete(pid)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Product deleted successfully'
            }), 200
        else:
            return jsonify({'error': 'Product not found'}), 404
            
    except Exception as e:
        print(f"❌ Error deleting product: {str(e)}")
        return jsonify({'error': f'Failed to delete product: {str(e)}'}), 500

@bp.route('/check-stock/<product_id>', methods=['POST', 'OPTIONS'])
def check_product_stock(product_id):
    """Check product stock availability"""
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
        
    try:
        db = get_db()
        model = ProductModel(db)
        
        data = request.get_json()
        quantity = data.get('quantity', 1)
        
        # Get current product stock
        product = model.get_by_id(product_id)
        if not product:
            return jsonify({
                'available': False,
                'message': 'Product not found'
            }), 404
        
        available = product['stock'] >= quantity
        message = f"Stock available: {product['stock']}" if available else f"Only {product['stock']} items available"
        
        response = jsonify({
            'available': available,
            'message': message,
            'current_stock': product['stock'],
            'requested_quantity': quantity
        })
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        return response, 200
        
    except Exception as e:
        response = jsonify({
            'available': False,
            'message': f'Error checking stock: {str(e)}'
        })
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        return response, 500

# FIXED: REMOVED the duplicate stock deduction endpoint
# Stock deduction is now ONLY handled in orders.py when payment proof is uploaded
# This prevents double deduction of stock

@bp.route('/update-stock/<product_id>', methods=['PUT', 'OPTIONS'])
def update_product_stock(product_id):
    """Update product stock (for admin use only)"""
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'PUT,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
        
    try:
        db = get_db()
        model = ProductModel(db)
        
        data = request.get_json()
        new_stock = data.get('stock')
        
        if new_stock is None:
            response = jsonify({
                'success': False,
                'message': 'Stock quantity is required'
            })
            response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
            return response, 400
        
        # Get current product
        product = model.get_by_id(product_id)
        if not product:
            response = jsonify({
                'success': False,
                'message': 'Product not found'
            })
            response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
            return response, 404
        
        # Update the stock
        result = db.products.update_one(
            {'_id': ObjectId(product_id)},
            {'$set': {'stock': int(new_stock)}}
        )
        
        if result.modified_count:
            print(f"✅ Stock updated for {product['name']}: {new_stock}")
            response = jsonify({
                'success': True,
                'message': f'Stock updated successfully for {product["name"]}',
                'product_name': product['name'],
                'new_stock': new_stock
            })
            response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
            return response, 200
        else:
            response = jsonify({
                'success': False,
                'message': 'Failed to update stock'
            })
            response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
            return response, 500
        
    except Exception as e:
        print(f"❌ Error updating stock: {str(e)}")
        response = jsonify({
            'success': False,
            'message': f'Error updating stock: {str(e)}'
        })
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
        return response, 500