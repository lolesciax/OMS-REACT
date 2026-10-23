from ..admin_validation import product as validate_product, stock as validate_stock, FieldValidationError
from ..catalog import catalog_options
from ..uploads import MAX_IMAGE_BYTES, save_image
from ..identity import next_display_id
from ..notifications import stock_update
from ..models.product import ProductModel
from .. import get_db
from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from datetime import datetime

bp = Blueprint('products', __name__, url_prefix='/api/products')

# ---------------- Helpers ----------------
def get_full_image_url(image_path):
    """Convert relative image path to full URL"""
    if not image_path:
        return request.host_url.rstrip('/') + '/static/uploads/default-product.jpg'

    if image_path.startswith('http'):
        return image_path

    if image_path.startswith('/'):
        return request.host_url.rstrip('/') + image_path

    return request.host_url.rstrip('/') + f'/static/uploads/{image_path}'

def serialize_doc(doc):
    """Convert MongoDB ObjectId to string and ensure valid image paths."""
    if not doc:
        return doc

    doc['_id'] = str(doc['_id'])

    # Ensure image has full URL
    if not doc.get('image'):
        doc['image'] = request.host_url.rstrip('/') + '/static/uploads/default-product.jpg'
    elif not doc['image'].startswith('http'):
        doc['image'] = get_full_image_url(doc['image'])

    return doc

# ---------------- Routes ----------------
@bp.route('/static/uploads/<path:filename>')
def uploaded_file(filename):
    """Serve uploaded files."""
    from ..uploads import serve_image
    return serve_image(filename)

@bp.route('/', methods=['GET'])
def get_products():
    """Get all active products."""
    try:
        db = get_db()
        if db is None:
            return jsonify(success=False, error='The database is temporarily unavailable'), 503
        model = ProductModel(db)
        products = [serialize_doc(p) for p in model.all()]
        return jsonify({'products': products})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/<product_id>', methods=['GET'])
def get_product(product_id):
    """Get single product by ID"""
    try:
        db = get_db()
        if db is None:
            return jsonify(success=False, error='The database is temporarily unavailable'), 503
        model = ProductModel(db)
        product = model.get_by_id(product_id)

        if (
            not product
            or product.get('is_active', product.get('isActive', True)) is False
            or not isinstance(product.get('stock'), (int, float))
            or product.get('stock', 0) <= 0
        ):
            return jsonify({'error': 'Product not found'}), 404

        return jsonify({'product': serialize_doc(product)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ✅ Helper: Generate professional product ID
def generate_product_id(db):
    """Generate formatted product ID like PROD-000001"""
    return next_display_id(db, 'products', 'product_id', 'PROD')

@bp.route('/', methods=['POST'])
def create_product():
    """Create a new product."""
    try:
        db = get_db()
        if db is None:
            return jsonify(success=False, error='The database is temporarily unavailable'), 503
        model = ProductModel(db)

        data = validate_product(request.form, options=catalog_options(db))
        image = request.files.get('image')
        image_url = ''
        if image and image.filename:
            try:
                image_url = save_image(image.read(MAX_IMAGE_BYTES + 1), 'products', image.filename)
            except ValueError as error:
                raise FieldValidationError({'image': str(error)})
        product_id = generate_product_id(db)
        data.update(product_id=product_id, image=image_url, is_active=True,
                    created_at=datetime.utcnow(), updated_at=datetime.utcnow())

        # Insert into database
        inserted_id = model.create(data)

        # Return the created product with full URL
        created_product = model.get_by_id(inserted_id)

        return jsonify({
            'success': True,
            'message': 'Product added successfully',
            'product_id': product_id,
            'image_url': get_full_image_url(image_url),  # Return full URL in response
            'product': serialize_doc(created_product)
        }), 201

    except FieldValidationError as error:
        return error.response()
    except Exception as e:
        return jsonify({'error': f'Failed to create product: {str(e)}'}), 500

@bp.route('/<pid>', methods=['PUT'])
def update_product(pid):
    """Update an existing product."""
    try:
        db = get_db()
        if db is None:
            return jsonify(success=False, error='The database is temporarily unavailable'), 503
        model = ProductModel(db)

        # Get existing product
        existing_product = model.get_by_id(pid)
        if not existing_product:
            return jsonify({'error': 'Product not found'}), 404

        data = validate_product(
            request.form,
            existing_product,
            catalog_options(db),
        )
        image = request.files.get('image')
        if image and image.filename:
            try:
                data['image'] = save_image(image.read(MAX_IMAGE_BYTES + 1), 'products', image.filename)
            except ValueError as error:
                raise FieldValidationError({'image': str(error)})
        if not data:
            raise FieldValidationError({'form': 'Choose at least one product field to update.'})

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

    except FieldValidationError as error:
        return error.response()
    except Exception as e:
        return jsonify({'error': f'Failed to update product: {str(e)}'}), 500

@bp.route('/<pid>', methods=['DELETE'])
def delete_product(pid):
    """Permanently delete a product."""
    try:
        db = get_db()
        if db is None:
            return jsonify(success=False, error='The database is temporarily unavailable'), 503
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
        return jsonify({'error': f'Failed to delete product: {str(e)}'}), 500

@bp.route('/check-stock/<product_id>', methods=['POST', 'OPTIONS'])
def check_product_stock(product_id):
    """Check product stock availability"""
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        return response

    try:
        db = get_db()
        if db is None:
            return jsonify(success=False, error='The database is temporarily unavailable'), 503
        model = ProductModel(db)

        data = request.get_json()
        quantity = data.get('quantity', 1)
        if type(quantity) is not int or quantity < 1:
            return jsonify(available=False, error='Quantity must be a positive whole number'), 400

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
        return response, 200

    except Exception as e:
        response = jsonify({
            'available': False,
            'message': f'Error checking stock: {str(e)}'
        })
        return response, 500

# FIXED: REMOVED the duplicate stock deduction endpoint
# Stock deduction is now ONLY handled in orders.py when payment proof is uploaded
# This prevents double deduction of stock

@bp.route('/update-stock/<product_id>', methods=['PUT', 'OPTIONS'])
def update_product_stock(product_id):
    """Update product stock (for admin use only)"""
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        return response

    try:
        db = get_db()
        if db is None:
            return jsonify(success=False, error='The database is temporarily unavailable'), 503
        model = ProductModel(db)

        data = request.get_json()
        new_stock = data.get('stock')

        try:
            if type(new_stock) is not int:
                raise ValueError('Stock must be a whole number of zero or more.')
            new_stock = validate_stock(new_stock)
        except ValueError as error:
            return FieldValidationError({'stock': str(error)}).response()

        # Get current product
        product = model.get_by_id(product_id)
        if not product:
            response = jsonify({
                'success': False,
                'message': 'Product not found'
            })
            return response, 404

        # Update the stock
        result = db.products.update_one(
            {'_id': ObjectId(product_id)},
            stock_update(product, {'stock': int(new_stock)})
        )

        if result.matched_count:
            response = jsonify({
                'success': True,
                'message': f'Stock updated successfully for {product["name"]}',
                'product_name': product['name'],
                'new_stock': new_stock
            })
            return response, 200
        else:
            response = jsonify({
                'success': False,
                'message': 'Failed to update stock'
            })
            return response, 500

    except Exception as e:
        response = jsonify({
            'success': False,
            'message': f'Error updating stock: {str(e)}'
        })
        return response, 500
