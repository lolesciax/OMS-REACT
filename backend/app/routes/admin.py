from ..admin_validation import account as validate_account, discount as validate_discount, FieldValidationError
from pymongo.errors import DuplicateKeyError
from ..identity import find_user, next_display_id
from ..access import access_fields, role_for, selected_role
from ..order_workflow import transition_order
from ..notifications import enqueue, prepare_document, order_event, account_event
from ..security import hash_password
from flask import Blueprint, jsonify, current_app, request, g
from datetime import datetime, timezone
from bson import ObjectId

bp = Blueprint('admin', __name__, url_prefix='/api/admin')


def order_owner(db, value):
    cache = getattr(g, 'order_owners', None)
    if cache is None:
        g.order_owners = cache = {}
    key = str(value)
    if key not in cache:
        cache[key] = find_user(db, value, {'username': 1, 'email': 1, 'firstName': 1, 'lastName': 1, 'phone': 1})
    return cache[key]

@bp.route('/stats', methods=['GET'])
def get_admin_stats():
    """Return admin dashboard statistics"""
    try:
        db = current_app.db

        # Count all products (including inactive)
        product_count = db.products.count_documents({})

        # Count all orders
        order_count = db.orders.count_documents({})

        # Count customers (non-admin users)
        customer_roles = [role['_id'] for role in db.roles.find({'permissions': {'$ne': 'admin.access'}})]
        customer_count = db.users.count_documents({'roleId': {'$in': customer_roles}})

        # ✅ FIXED: Compute total revenue for completed orders with correct field name
        revenue_pipeline = [
            {"$match": {"status": "completed"}},
            {"$group": {"_id": None, "totalRevenue": {"$sum": "$total"}}}
        ]
        revenue_result = list(db.orders.aggregate(revenue_pipeline))

        # ✅ FIXED: Use the correct field name 'totalRevenue'
        total_revenue = revenue_result[0]['totalRevenue'] if revenue_result else 0


        return jsonify({
            "productCount": product_count,
            "orderCount": order_count,
            "customerCount": customer_count,
            "revenueAmount": total_revenue
        }), 200

    except Exception as e:
        return jsonify({
            "productCount": 0,
            "orderCount": 0,
            "customerCount": 0,
            "revenueAmount": 0
        }), 500

@bp.route('/customers', methods=['GET'])
def get_customers():
    """Get all customers for admin panel"""
    try:
        db = current_app.db  # ✅ use live DB

        users_cursor = db.users.find({}, {'password': 0})  # Exclude passwords
        users = list(users_cursor)

        # ✅ Admin should appear on top
        admins = []
        customers = []

        for user in users:
            access = access_fields(user)
            formatted_user = {
                "_id": str(user["_id"]),
                "username": user.get("username", "N/A"),
                "email": user.get("email", "N/A"),
                "user_id": user.get("user_id", ""),
                "firstName": user.get("firstName", ""),
                "lastName": user.get("lastName", ""),
                "phone": user.get("phone", ""),
                **access,
                "isActive": user.get("isActive", True),
                "created_at": user.get("created_at", datetime.now(timezone.utc).isoformat())
            }

            if access['isAdmin']:
                admins.append(formatted_user)
            else:
                customers.append(formatted_user)

        # ✅ Sort customers chronologically by user_id
        customers.sort(key=lambda x: x.get("user_id", ""))

        all_users = admins + customers  # Admin on top


        return jsonify({
            "success": True,
            "customers": all_users,
            "count": len(all_users)
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to fetch customers: {str(e)}",
            "customers": []
        }), 500


@bp.route('/orders', methods=['GET'])
def get_orders():
    """Get all orders for admin panel with customer information"""
    try:
        db = current_app.db  # ✅ use live DB

        orders_cursor = db.orders.find({}).sort('createdAt', -1)
        orders = list(orders_cursor)

        formatted_orders = []
        for order in orders:
            # Get user information for this order
            user = order_owner(db, order.get('userId'))
            customer_name = "Customer"
            username = "Customer"

            if user:
                # Get customer name from first and last name
                first_name = user.get('firstName', '')
                last_name = user.get('lastName', '')
                customer_name = f"{first_name} {last_name}".strip()
                if not customer_name:
                    customer_name = user.get('username', 'Customer')

                username = user.get('username', 'Customer')

            # Format order date
            order_date = order.get('orderDate')
            if isinstance(order_date, str):
                try:
                    order_date = datetime.fromisoformat(order_date.replace('Z', '+00:00'))
                except:
                    order_date = datetime.utcnow()
            elif not order_date:
                order_date = datetime.utcnow()

            # Format order ID display
            order_id = str(order["_id"])
            order_number = order.get('orderNumber', f"ORD-{order_id[-6:].upper()}")

            formatted_orders.append({
                "_id": order_id,
                "orderNumber": order_number,
                "customerName": customer_name,
                "username": username,
                "orderDate": (order_date.replace(tzinfo=timezone.utc) if order_date.tzinfo is None else order_date).isoformat(),
                "total": order.get("total", 0),
                "status": order.get("status", "pending"),
                "userId": order.get("userId", ""),
                "paymentProof": order.get("paymentProof")
            })


        return jsonify({
            "success": True,
            "orders": formatted_orders,
            "count": len(formatted_orders)
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to fetch orders: {str(e)}",
            "orders": []
        }), 500


@bp.route('/orders/<order_id>', methods=['GET', 'PUT', 'OPTIONS'])
def get_order_details(order_id):
    """Get single order details for admin panel and update order status"""
    try:
        db = current_app.db

        if request.method == 'OPTIONS':
            return '', 200

        if request.method == 'GET':

            # Find the order
            order = db.orders.find_one({'_id': ObjectId(order_id)})
            if not order:
                return jsonify({'success': False, 'error': 'Order not found'}), 404

            # Convert ObjectId to string
            order['_id'] = str(order['_id'])

            # Find user information
            user = order_owner(db, order.get('userId'))
            user_info = {}
            if user:
                first_name = user.get('firstName', '')
                last_name = user.get('lastName', '')
                full_name = f"{first_name} {last_name}".strip()
                if not full_name:
                    full_name = user.get('username', 'Customer')

                user_info = {
                    'username': user.get('username'),
                    'email': user.get('email'),
                    'phone': user.get('phone'),
                    'name': full_name,
                    'firstName': first_name,
                    'lastName': last_name
                }
            else:
                user_info = {
                    'username': order.get('userId', 'Customer'),
                    'email': 'N/A',
                    'phone': 'N/A',
                    'name': 'Customer'
                }

            # Combine order and user info
            order_details = {
                **order,
                **user_info
            }


            return jsonify({
                'success': True,
                'order': order_details
            }), 200

        elif request.method == 'PUT':
            data = request.get_json()
            new_status = data.get('status')
            tracking_number = data.get('trackingNumber')


            existing = db.orders.find_one({'_id': ObjectId(order_id)})
            if not existing:
                return jsonify(success=False, error='Order not found'), 404
            try:
                update_data = transition_order(existing, data)
            except FieldValidationError as error:
                return error.response()
            except ValueError as error:
                return jsonify(success=False, error=str(error)), 400

            result = db.orders.update_one(
                {'_id': ObjectId(order_id), 'status': existing.get('status', 'pending')},
                enqueue({'$set': update_data}, 'orders', existing['_id'],
                        order_event({**existing, **update_data}, update_data['status']) if update_data.get('status') in ('confirmed', 'processing', 'shipped', 'completed') else None)
            )

            if result.modified_count:
                # Return the updated order
                updated_order = db.orders.find_one({'_id': ObjectId(order_id)})
                updated_order['_id'] = str(updated_order['_id'])

                return jsonify({
                    'success': True,
                    'message': f'Order status updated to {new_status} successfully',
                    'order': updated_order
                })
            else:
                return jsonify(success=False, error='This order changed in another tab. Refresh before updating it.'), 409

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@bp.route('/products', methods=['GET'])
def get_products():
    """Get all products for admin panel"""
    try:
        db = current_app.db  # ✅ use live DB

        products_cursor = db.products.find({})
        products = list(products_cursor)

        formatted_products = []
        for product in products:
            formatted_products.append({
                "_id": str(product["_id"]),
                "name": product.get("name", "Unnamed Product"),
                "price": product.get("price", 0),
                "stock": product.get("stock", 0),
                "category": product.get("category", "Uncategorized"),
                "image": product.get("image", ""),
                "description": product.get("description", ""),
                "product_id": product.get("product_id", ""),
                "condition": product.get("condition", "Good"),
                "size": product.get("size", ""),
                "material": product.get("material", ""),
                "is_active": product.get("is_active", product.get("isActive", True)),
                "isActive": product.get("is_active", product.get("isActive", True))
            })

        return jsonify({
            "success": True,
            "products": formatted_products,
            "count": len(formatted_products)
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to fetch products: {str(e)}",
            "products": []
        }), 500


@bp.route('/discounts', methods=['GET'])
def get_discounts():
    """Get all discounts for admin panel"""
    try:
        db = current_app.db  # ✅ use live DB

        discounts_cursor = db.discounts.find({})
        discounts = list(discounts_cursor)

        formatted_discounts = []
        for discount in discounts:
            formatted_discounts.append({
                "_id": str(discount["_id"]),
                "code": discount.get("code", ""),
                "type": discount.get("discountType", discount.get("type", "percentage")),
                "discountType": discount.get("discountType", discount.get("type", "percentage")),
                "minPurchase": discount.get("minPurchase", discount.get("minOrder", 0)),
                "validUntil": discount.get("validUntil", discount.get("endDate", "")),
                "applyTo": discount.get("applyTo", "all"),
                "category": discount.get("category", ""),
                "value": discount.get("value", 0),
                "minOrder": discount.get("minOrder", 0),
                "maxDiscount": discount.get("maxDiscount"),
                "usageLimit": discount.get("usageLimit"),
                "usedCount": discount.get("usedCount", 0),
                "startDate": discount.get("startDate"),
                "endDate": discount.get("endDate"),
                "isActive": discount.get("isActive", True)
            })

        return jsonify({
            "success": True,
            "discounts": formatted_discounts,
            "count": len(formatted_discounts)
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to fetch discounts: {str(e)}",
            "discounts": []
        }), 500


@bp.route('/revenue', methods=['GET'])
def get_revenue_stats():
    """Get revenue statistics for admin panel"""
    try:
        db = current_app.db

        # Total revenue from completed orders
        revenue_pipeline = [
            {"$match": {"status": "completed"}},
            {"$group": {"_id": None, "totalRevenue": {"$sum": "$total"}}}
        ]
        revenue_result = list(db.orders.aggregate(revenue_pipeline))
        total_revenue = revenue_result[0]['totalRevenue'] if revenue_result else 0

        # Monthly revenue breakdown
        monthly_pipeline = [
            {"$match": {"status": "completed"}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m", "date": "$orderDate"}},
                "revenue": {"$sum": "$total"},
                "orders": {"$sum": 1}
            }},
            {"$sort": {"_id": -1}},
            {"$limit": 6}
        ]
        monthly_result = list(db.orders.aggregate(monthly_pipeline))

        # Order status breakdown
        status_pipeline = [
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "totalValue": {"$sum": "$total"}
            }}
        ]
        status_result = list(db.orders.aggregate(status_pipeline))

        return jsonify({
            "success": True,
            "totalRevenue": total_revenue,
            "monthlyBreakdown": monthly_result,
            "statusBreakdown": status_result
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to fetch revenue stats: {str(e)}",
            "totalRevenue": 0,
            "monthlyBreakdown": [],
            "statusBreakdown": []
        }), 500


@bp.route('/recent-orders', methods=['GET'])
def get_recent_orders():
    """Get recent orders for admin dashboard"""
    try:
        db = current_app.db

        # Get last 5 orders
        recent_orders_cursor = db.orders.find({}).sort('createdAt', -1).limit(5)
        recent_orders = list(recent_orders_cursor)

        formatted_orders = []
        for order in recent_orders:
            # Get user information
            user = order_owner(db, order.get('userId'))
            customer_name = "Customer"
            if user:
                first_name = user.get('firstName', '')
                last_name = user.get('lastName', '')
                customer_name = f"{first_name} {last_name}".strip()
                if not customer_name:
                    customer_name = user.get('username', 'Customer')

            formatted_orders.append({
                "_id": str(order["_id"]),
                "orderNumber": order.get('orderNumber', f"ORD-{str(order['_id'])[-6:].upper()}"),
                "customerName": customer_name,
                "total": order.get("total", 0),
                "status": order.get("status", "pending"),
                "orderDate": order.get("orderDate", datetime.now(timezone.utc).isoformat())
            })

        return jsonify({
            "success": True,
            "recentOrders": formatted_orders
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to fetch recent orders: {str(e)}",
            "recentOrders": []
        }), 500


# Error handler for 404
@bp.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Resource not found'
    }), 404


# Error handler for 500
@bp.errorhandler(500)
def internal_server_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500

@bp.route('/users', methods=['POST'])
def create_user():
    """Create a new user (admin or customer)"""
    try:
        db = current_app.db
        data = request.get_json()

        data = validate_account(data)
        data['roleId'] = selected_role(data)['_id']

        # Check if username already exists
        existing_user = db.users.find_one({'username': data['username']})
        if existing_user:
            return jsonify(success=False, error='Username already exists', fields={'username': 'This username is already taken.'}), 409

        # Check if email already exists
        existing_email = db.users.find_one({'email': data['email']})
        if existing_email:
            return jsonify(success=False, error='Email already exists', fields={'email': 'This email is already registered.'}), 409

        hashed_password = hash_password(data['password'])

        user_data = {
            'username': data['username'],
            'email': data['email'],
            'emailUnique': True,
            'firstName': data.get('firstName', ''),
            'lastName': data.get('lastName', ''),
            'phone': data.get('phone', ''),
            'roleId': data['roleId'],
            'isActive': data.get('isActive', True),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }


        # Add password if provided
        if hashed_password:
            user_data['password'] = hashed_password

        # Generate user_id
        user_data['user_id'] = next_display_id(db, 'users', 'user_id', 'USR')
        user_data['_id'] = ObjectId()
        prepare_document(user_data, 'users', account_event(user_data['_id'], 'Welcome to Old Goods', 'Your account is ready. Review your details and add a delivery address.', key=f"welcome:{user_data['_id']}"))

        result = db.users.insert_one(user_data)

        return jsonify({
            'success': True,
            'message': 'User created successfully',
            'user_id': str(result.inserted_id)
        }), 201

    except FieldValidationError as error:
        return error.response()
    except ValueError as error:
        return jsonify(success=False, error=str(error)), 400
    except DuplicateKeyError:
        return jsonify(success=False, error='This username is already taken.'), 409
    except Exception as e:
        return jsonify({'success': False, 'error': f'Failed to create user: {str(e)}'}), 500


@bp.route('/users/<user_id>', methods=['PUT'])
def update_user(user_id):
    """Update user information"""
    try:
        db = current_app.db
        data = request.get_json()

        # Find the user
        user = db.users.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        data = validate_account(data, user)
        assigned_role = selected_role(data, user)
        if assigned_role is None and 'roleId' not in user:
            assigned_role = role_for(user)
        data.pop('isAdmin', None)
        if assigned_role:
            data['roleId'] = assigned_role['_id']
        role = role_for({'roleId': data.get('roleId', user.get('roleId'))}) if 'roleId' in data or 'roleId' in user else role_for(user)
        if getattr(g, 'user', {}).get('_id') == user['_id'] and (not role or 'admin.access' not in role.get('permissions', []) or data.get('isActive') is False):
            raise FieldValidationError({'roleId': 'You cannot remove your own administrator access.', 'isActive': 'Your own account must stay active.'})
        update_data = {key: data[key] for key in ('firstName', 'lastName', 'phone') if key in data}
        update_data['updated_at'] = datetime.utcnow()

        # Update fields if provided
        if 'username' in data and data['username'] != user.get('username'):
            # Check if new username already exists
            existing_user = db.users.find_one({
                'username': data['username'],
                '_id': {'$ne': ObjectId(user_id)}
            })
            if existing_user:
                return jsonify(success=False, error='Username already exists', fields={'username': 'This username is already taken.'}), 409
            update_data['username'] = data['username']

        if 'email' in data and data['email'] != user.get('email'):
            # Check if new email already exists
            existing_email = db.users.find_one({
                'email': data['email'],
                '_id': {'$ne': ObjectId(user_id)}
            })
            if existing_email:
                return jsonify(success=False, error='Email already exists', fields={'email': 'This email is already registered.'}), 409
            update_data['email'] = data['email']
            update_data['emailUnique'] = True

        if 'roleId' in data:
            update_data['roleId'] = data['roleId']
        if 'isActive' in data:
            update_data['isActive'] = data['isActive']

        # Update password if provided
        if data.get('password'):
            update_data['password'] = hash_password(data['password'])

        security_changed = any(key in update_data and update_data[key] != user.get(key) for key in ('password', 'email', 'phone', 'roleId', 'isActive'))
        result = db.users.update_one(
            {'_id': ObjectId(user_id)},
            enqueue({'$set': update_data, '$unset': {'isAdmin': ''}}, 'users', user['_id'],
                    account_event(user['_id'], 'Account settings changed', 'A store administrator updated your contact details, password, or account access. Contact the store if you did not expect this.') if security_changed else None)
        )

        if result.modified_count:
            return jsonify({
                'success': True,
                'message': 'User updated successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'No changes made'}), 400

    except FieldValidationError as error:
        return error.response()
    except ValueError as error:
        return jsonify(success=False, error=str(error)), 400
    except DuplicateKeyError:
        return jsonify(success=False, error='This username is already taken.'), 409
    except Exception as e:
        return jsonify({'success': False, 'error': f'Failed to update user: {str(e)}'}), 500


@bp.route('/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete a user"""
    try:
        db = current_app.db

        # Find the user
        user = db.users.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        # Prevent deletion of admin users
        if access_fields(user)['isAdmin']:
            return jsonify({'success': False, 'error': 'Cannot delete admin users'}), 400

        # Check if user has orders
        user_orders = db.orders.find_one({'userId': user['_id']})
        if user_orders:
            return jsonify({'success': False, 'error': 'Cannot delete user with existing orders'}), 400

        result = db.users.delete_one({'_id': ObjectId(user_id)})

        if result.deleted_count:
            # Remove account-owned state so deleting an unused account cannot
            # leave sessions, carts or checkout drafts pointing to a missing user.
            db.carts.delete_many({'user_id': user['_id']})
            db.favorites.delete_many({'userId': user['_id']})
            db.checkouts.delete_many({'userId': user['_id']})
            db.sessions.delete_many({'userId': user['_id']})
            return jsonify({
                'success': True,
                'message': 'User deleted successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to delete user'}), 400

    except Exception as e:
        return jsonify({'success': False, 'error': f'Failed to delete user: {str(e)}'}), 500

@bp.route('/dashboard-data', methods=['GET'])
def get_dashboard_data():
    """Get comprehensive dashboard data with relationships"""
    try:
        db = current_app.db

        # 1. Recent Orders with Customer Details
        recent_orders = list(db.orders.find().sort('createdAt', -1).limit(5))
        formatted_recent_orders = []
        for order in recent_orders:
            user = order_owner(db, order.get('userId'))
            customer_name = "Customer"
            if user:
                first_name = user.get('firstName', '')
                last_name = user.get('lastName', '')
                customer_name = f"{first_name} {last_name}".strip()
                if not customer_name:
                    customer_name = user.get('username', 'Customer')

            formatted_recent_orders.append({
                "_id": str(order["_id"]),
                "orderNumber": order.get('orderNumber', f"ORD-{str(order['_id'])[-6:].upper()}"),
                "customerName": customer_name,
                "total": order.get("total", 0),
                "status": order.get("status", "pending"),
                "orderDate": order.get("orderDate", datetime.now(timezone.utc).isoformat()),
                "items": order.get('items', [])
            })

        # 2. Low Stock Products (stock < 10)
        low_stock_products = list(db.products.find({
            'stock': {'$lt': 10},
            'is_active': True
        }).limit(5))

        formatted_low_stock = []
        for product in low_stock_products:
            formatted_low_stock.append({
                "_id": str(product["_id"]),
                "name": product.get("name", "Unnamed Product"),
                "stock": product.get("stock", 0),
                "price": product.get("price", 0),
                "category": product.get("category", "Uncategorized")
            })

        # 3. Top Customers by Order Value
        top_customers_pipeline = [
            {"$match": {"status": "completed"}},
            {"$group": {
                "_id": "$userId",
                "totalSpent": {"$sum": "$total"},
                "orderCount": {"$sum": 1}
            }},
            {"$sort": {"totalSpent": -1}},
            {"$limit": 5}
        ]
        top_customers_result = list(db.orders.aggregate(top_customers_pipeline))

        formatted_top_customers = []
        for customer_data in top_customers_result:
            user = order_owner(db, customer_data['_id'])
            if user:
                first_name = user.get('firstName', '')
                last_name = user.get('lastName', '')
                customer_name = f"{first_name} {last_name}".strip()
                if not customer_name:
                    customer_name = user.get('username', 'Customer')

                formatted_top_customers.append({
                    "username": user.get('username', 'Customer'),
                    "name": customer_name,
                    "totalSpent": customer_data['totalSpent'],
                    "orderCount": customer_data['orderCount']
                })

        # 4. Order Status Distribution
        status_pipeline = [
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "totalValue": {"$sum": "$total"}
            }}
        ]
        status_distribution = list(db.orders.aggregate(status_pipeline))

        # 5. Recent Customer Registrations
        customer_roles = [role['_id'] for role in db.roles.find({'permissions': {'$ne': 'admin.access'}})]
        recent_customers = list(db.users.find({
            'roleId': {'$in': customer_roles}
        }).sort('created_at', -1).limit(5))

        formatted_recent_customers = []
        for user in recent_customers:
            formatted_recent_customers.append({
                "_id": str(user["_id"]),
                "username": user.get("username", ""),
                "email": user.get("email", ""),
                "firstName": user.get("firstName", ""),
                "lastName": user.get("lastName", ""),
                "created_at": user.get("created_at", datetime.now(timezone.utc).isoformat())
            })

        # 6. Top Selling Products
        top_products_pipeline = [
            {"$unwind": "$items"},
            {"$group": {
                "_id": "$items.name",
                "totalSold": {"$sum": "$items.qty"},
                "totalRevenue": {"$sum": {"$multiply": ["$items.qty", "$items.price"]}}
            }},
            {"$sort": {"totalSold": -1}},
            {"$limit": 5}
        ]
        top_products_result = list(db.orders.aggregate(top_products_pipeline))

        return jsonify({
            "success": True,
            "recentOrders": formatted_recent_orders,
            "lowStockProducts": formatted_low_stock,
            "topCustomers": formatted_top_customers,
            "orderStatusDistribution": status_distribution,
            "recentCustomers": formatted_recent_customers,
            "topSellingProducts": top_products_result
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to fetch dashboard data: {str(e)}",
            "recentOrders": [],
            "lowStockProducts": [],
            "topCustomers": [],
            "orderStatusDistribution": [],
            "recentCustomers": [],
            "topSellingProducts": []
        }), 500


@bp.route('/monthly-revenue', methods=['GET'])
def get_monthly_revenue():
    """Get monthly revenue data for charts"""
    try:
        db = current_app.db

        monthly_pipeline = [
            {"$match": {"status": "completed"}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m", "date": "$orderDate"}},
                "revenue": {"$sum": "$total"},
                "orders": {"$sum": 1}
            }},
            {"$sort": {"_id": -1}},
            {"$limit": 6},
            {"$sort": {"_id": 1}}
        ]
        monthly_result = list(db.orders.aggregate(monthly_pipeline))

        return jsonify({
            "success": True,
            "monthlyRevenue": monthly_result
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to fetch monthly revenue: {str(e)}",
            "monthlyRevenue": []
        }), 500

@bp.route('/discounts', methods=['POST'])
def create_discount():
    try:
        values = validate_discount(request.get_json(silent=True) or {})
    except FieldValidationError as error:
        return error.response()
    db = current_app.db
    if db.discounts.find_one({'code': values['code']}):
        return jsonify(success=False, error='This discount code already exists', fields={'code': 'This discount code already exists.'}), 409
    try:
        result = db.discounts.insert_one({**values, 'isActive': True, 'createdAt': datetime.utcnow()})
    except DuplicateKeyError:
        return jsonify(success=False, error='This discount code already exists', fields={'code': 'This discount code already exists.'}), 409
    return jsonify(success=True, discountId=str(result.inserted_id), message='Discount created'), 201


@bp.route('/discounts/<discount_id>', methods=['DELETE'])
def delete_discount(discount_id):
    if not ObjectId.is_valid(discount_id):
        return jsonify(success=False, error='Invalid discount ID'), 400
    result = current_app.db.discounts.delete_one({'_id': ObjectId(discount_id)})
    if not result.deleted_count:
        return jsonify(success=False, error='Discount not found'), 404
    return jsonify(success=True, message='Discount deleted')
