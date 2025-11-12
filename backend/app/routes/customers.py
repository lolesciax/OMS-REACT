from flask import Blueprint, request, jsonify
from bson import ObjectId
from bson.json_util import dumps
import json

# Helper function to convert ObjectId to string
def serialize_doc(doc):
    if doc and '_id' in doc:
        doc['_id'] = str(doc['_id'])
    return doc

bp = Blueprint('customers', __name__, url_prefix='/api/customers')

def get_customer_model():
    from app import get_db
    from app.models.customer import Customer
    return Customer(get_db())

@bp.route('/', methods=['GET'])
def get_customers():
    """Get all customers"""
    try:
        customer_model = get_customer_model()
        customers = customer_model.get_all_customers()
        
        # Convert ObjectId to string for JSON serialization
        serialized_customers = [serialize_doc(customer) for customer in customers]
        
        return jsonify({
            'status': 'success',
            'data': serialized_customers,
            'count': len(serialized_customers)
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch customers: {str(e)}'
        }), 500

@bp.route('/<customer_id>', methods=['GET'])
def get_customer(customer_id):
    """Get a specific customer by ID"""
    try:
        customer_model = get_customer_model()
        customer = customer_model.get_customer_by_id(customer_id)
        
        if not customer:
            return jsonify({
                'status': 'error',
                'message': 'Customer not found'
            }), 404
        
        return jsonify({
            'status': 'success',
            'data': serialize_doc(customer)
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch customer: {str(e)}'
        }), 500

@bp.route('/', methods=['POST'])
def create_customer():
    """Create a new customer"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'email']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'status': 'error',
                    'message': f'Missing required field: {field}'
                }), 400
        
        customer_model = get_customer_model()
        
        # Check if customer already exists
        if customer_model.customer_exists(data['email']):
            return jsonify({
                'status': 'error',
                'message': 'Customer with this email already exists'
            }), 400
        
        # Create customer
        customer_data = {
            'name': data['name'],
            'email': data['email'],
            'phone': data.get('phone', ''),
            'address': data.get('address', {}),
            'status': data.get('status', 'active')
        }
        
        new_customer = customer_model.create_customer(customer_data)
        
        return jsonify({
            'status': 'success',
            'message': 'Customer created successfully',
            'data': serialize_doc(new_customer)
        }), 201
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Failed to create customer: {str(e)}'
        }), 500

@bp.route('/<customer_id>', methods=['PUT'])
def update_customer(customer_id):
    """Update a customer"""
    try:
        data = request.get_json()
        
        customer_model = get_customer_model()
        
        # Check if customer exists
        existing_customer = customer_model.get_customer_by_id(customer_id)
        if not existing_customer:
            return jsonify({
                'status': 'error',
                'message': 'Customer not found'
            }), 404
        
        # Prepare update data
        update_data = {}
        if 'name' in data:
            update_data['name'] = data['name']
        if 'email' in data:
            update_data['email'] = data['email']
        if 'phone' in data:
            update_data['phone'] = data['phone']
        if 'address' in data:
            update_data['address'] = data['address']
        if 'status' in data:
            update_data['status'] = data['status']
        
        success = customer_model.update_customer(customer_id, update_data)
        
        if success:
            updated_customer = customer_model.get_customer_by_id(customer_id)
            return jsonify({
                'status': 'success',
                'message': 'Customer updated successfully',
                'data': serialize_doc(updated_customer)
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to update customer'
            }), 500
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Failed to update customer: {str(e)}'
        }), 500

@bp.route('/<customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    """Delete a customer"""
    try:
        customer_model = get_customer_model()
        
        # Check if customer exists
        existing_customer = customer_model.get_customer_by_id(customer_id)
        if not existing_customer:
            return jsonify({
                'status': 'error',
                'message': 'Customer not found'
            }), 404
        
        success = customer_model.delete_customer(customer_id)
        
        if success:
            return jsonify({
                'status': 'success',
                'message': 'Customer deleted successfully'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to delete customer'
            }), 500
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Failed to delete customer: {str(e)}'
        }), 500

@bp.route('/search/<query>', methods=['GET'])
def search_customers(query):
    """Search customers by name or email"""
    try:
        customer_model = get_customer_model()
        customers = customer_model.search_customers(query)
        
        serialized_customers = [serialize_doc(customer) for customer in customers]
        
        return jsonify({
            'status': 'success',
            'data': serialized_customers,
            'count': len(serialized_customers)
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Search failed: {str(e)}'
        }), 500