from flask import Blueprint, jsonify, current_app, request
from datetime import datetime
from bson import ObjectId

bp = Blueprint('admin', __name__, url_prefix='/api/admin')

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
        customer_count = db.users.count_documents({"isAdmin": False})

        # ✅ FIXED: Compute total revenue for completed orders with correct field name
        revenue_pipeline = [
            {"$match": {"status": "completed"}},
            {"$group": {"_id": None, "totalRevenue": {"$sum": "$total"}}}
        ]
        revenue_result = list(db.orders.aggregate(revenue_pipeline))
        
        # ✅ FIXED: Use the correct field name 'totalRevenue'
        total_revenue = revenue_result[0]['totalRevenue'] if revenue_result else 0

        print(f"📊 Stats - Products: {product_count}, Orders: {order_count}, Customers: {customer_count}, Revenue: {total_revenue}")

        return jsonify({
            "productCount": product_count,
            "orderCount": order_count,
            "customerCount": customer_count,
            "revenueAmount": total_revenue
        }), 200

    except Exception as e:
        print(f"❌ Error fetching admin stats: {e}")
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
            formatted_user = {
                "_id": str(user["_id"]),
                "username": user.get("username", "N/A"),
                "email": user.get("email", "N/A"),
                "user_id": user.get("user_id", ""),
                "firstName": user.get("firstName", ""),
                "lastName": user.get("lastName", ""),
                "phone": user.get("phone", ""),
                "role": "admin" if user.get("isAdmin") else "customer",
                "isAdmin": user.get("isAdmin", False),
                "isActive": user.get("isActive", True),
                "created_at": user.get("created_at", datetime.utcnow().isoformat())
            }

            if user.get("isAdmin"):
                admins.append(formatted_user)
            else:
                customers.append(formatted_user)

        # ✅ Sort customers chronologically by user_id
        customers.sort(key=lambda x: x.get("user_id", ""))

        all_users = admins + customers  # Admin on top

        print(f"📊 Found {len(all_users)} users in database")

        return jsonify({
            "success": True,
            "customers": all_users,
            "count": len(all_users)
        }), 200

    except Exception as e:
        print(f"❌ Error fetching customers: {str(e)}")
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
            user = db.users.find_one({'username': order.get('userId')})
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
                "orderDate": order_date.isoformat(),
                "total": order.get("total", 0),
                "status": order.get("status", "pending"),
                "userId": order.get("userId", "")
            })

        print(f"📦 Found {len(formatted_orders)} orders in database")

        return jsonify({
            "success": True,
            "orders": formatted_orders,
            "count": len(formatted_orders)
        }), 200

    except Exception as e:
        print(f"❌ Error fetching orders: {str(e)}")
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
            print(f"🔍 Fetching order details for: {order_id}")
            
            # Find the order
            order = db.orders.find_one({'_id': ObjectId(order_id)})
            if not order:
                return jsonify({'success': False, 'error': 'Order not found'}), 404
            
            # Convert ObjectId to string
            order['_id'] = str(order['_id'])
            
            # Find user information
            user = db.users.find_one({'username': order.get('userId')})
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
            
            print(f"✅ Found order: {order_details.get('orderNumber')}")
            
            return jsonify({
                'success': True,
                'order': order_details
            }), 200
            
        elif request.method == 'PUT':
            print(f"🔄 Updating order status for: {order_id}")
            data = request.get_json()
            new_status = data.get('status')
            
            if not new_status:
                return jsonify({'success': False, 'error': 'Status is required'}), 400
            
            # Validate status values - admin can only set up to shipped
            valid_statuses = ['pending', 'confirmed', 'processing', 'shipped']
            if new_status.lower() not in valid_statuses:
                return jsonify({'success': False, 'error': f'Invalid status. Admin can only set: {", ".join(valid_statuses)}'}), 400
            
            # Update the order status
            result = db.orders.update_one(
                {'_id': ObjectId(order_id)},
                {'$set': {
                    'status': new_status.lower(),
                    'updatedAt': datetime.now()
                }}
            )
            
            if result.modified_count:
                print(f"✅ Order {order_id} status updated to: {new_status}")
                return jsonify({
                    'success': True,
                    'message': f'Order status updated to {new_status} successfully'
                })
            else:
                return jsonify({'success': False, 'error': 'Order not found or no changes made'}), 404
                
    except Exception as e:
        print(f"❌ Error in order details endpoint: {str(e)}")
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
                "isActive": product.get("isActive", True)
            })

        return jsonify({
            "success": True,
            "products": formatted_products,
            "count": len(formatted_products)
        }), 200

    except Exception as e:
        print(f"❌ Error fetching products: {str(e)}")
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
                "type": discount.get("type", "percentage"),
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
        print(f"❌ Error fetching discounts: {str(e)}")
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
        print(f"❌ Error fetching revenue stats: {str(e)}")
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
            user = db.users.find_one({'username': order.get('userId')})
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
                "orderDate": order.get("orderDate", datetime.utcnow().isoformat())
            })

        return jsonify({
            "success": True,
            "recentOrders": formatted_orders
        }), 200

    except Exception as e:
        print(f"❌ Error fetching recent orders: {str(e)}")
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

        # Validate required fields
        if not data.get('username') or not data.get('email'):
            return jsonify({'success': False, 'error': 'Username and email are required'}), 400

        # Check if username already exists
        existing_user = db.users.find_one({'username': data['username']})
        if existing_user:
            return jsonify({'success': False, 'error': 'Username already exists'}), 400

        # Check if email already exists
        existing_email = db.users.find_one({'email': data['email']})
        if existing_email:
            return jsonify({'success': False, 'error': 'Email already exists'}), 400

        # Hash password if provided
        hashed_password = None
        if data.get('password'):
            import hashlib
            hashed_password = hashlib.sha256(data['password'].encode()).hexdigest()

        user_data = {
            'username': data['username'],
            'email': data['email'],
            'firstName': data.get('firstName', ''),
            'lastName': data.get('lastName', ''),
            'phone': data.get('phone', ''),
            'isAdmin': data.get('isAdmin', False),
            'isActive': data.get('isActive', True),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        # Add password if provided
        if hashed_password:
            user_data['password'] = hashed_password

        # Generate user_id
        user_count = db.users.count_documents({})
        user_data['user_id'] = f"USR{user_count + 1:04d}"

        result = db.users.insert_one(user_data)

        return jsonify({
            'success': True,
            'message': 'User created successfully',
            'user_id': str(result.inserted_id)
        }), 201

    except Exception as e:
        print(f"❌ Error creating user: {str(e)}")
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

        update_data = {
            'updated_at': datetime.utcnow()
        }

        # Update fields if provided
        if 'username' in data and data['username'] != user.get('username'):
            # Check if new username already exists
            existing_user = db.users.find_one({
                'username': data['username'],
                '_id': {'$ne': ObjectId(user_id)}
            })
            if existing_user:
                return jsonify({'success': False, 'error': 'Username already exists'}), 400
            update_data['username'] = data['username']

        if 'email' in data and data['email'] != user.get('email'):
            # Check if new email already exists
            existing_email = db.users.find_one({
                'email': data['email'],
                '_id': {'$ne': ObjectId(user_id)}
            })
            if existing_email:
                return jsonify({'success': False, 'error': 'Email already exists'}), 400
            update_data['email'] = data['email']

        if 'firstName' in data:
            update_data['firstName'] = data['firstName']
        if 'lastName' in data:
            update_data['lastName'] = data['lastName']
        if 'phone' in data:
            update_data['phone'] = data['phone']
        if 'isAdmin' in data:
            update_data['isAdmin'] = data['isAdmin']
        if 'isActive' in data:
            update_data['isActive'] = data['isActive']

        # Update password if provided
        if data.get('password'):
            import hashlib
            update_data['password'] = hashlib.sha256(data['password'].encode()).hexdigest()

        result = db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': update_data}
        )

        if result.modified_count:
            return jsonify({
                'success': True,
                'message': 'User updated successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'No changes made'}), 400

    except Exception as e:
        print(f"❌ Error updating user: {str(e)}")
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
        if user.get('isAdmin'):
            return jsonify({'success': False, 'error': 'Cannot delete admin users'}), 400

        # Check if user has orders
        user_orders = db.orders.find_one({'userId': user.get('username')})
        if user_orders:
            return jsonify({'success': False, 'error': 'Cannot delete user with existing orders'}), 400

        result = db.users.delete_one({'_id': ObjectId(user_id)})

        if result.deleted_count:
            return jsonify({
                'success': True,
                'message': 'User deleted successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to delete user'}), 400

    except Exception as e:
        print(f"❌ Error deleting user: {str(e)}")
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
            user = db.users.find_one({'username': order.get('userId')})
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
                "orderDate": order.get("orderDate", datetime.utcnow().isoformat()),
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
            user = db.users.find_one({'username': customer_data['_id']})
            if user:
                first_name = user.get('firstName', '')
                last_name = user.get('lastName', '')
                customer_name = f"{first_name} {last_name}".strip()
                if not customer_name:
                    customer_name = user.get('username', 'Customer')
                
                formatted_top_customers.append({
                    "username": customer_data['_id'],
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
        recent_customers = list(db.users.find({
            'isAdmin': False
        }).sort('created_at', -1).limit(5))
        
        formatted_recent_customers = []
        for user in recent_customers:
            formatted_recent_customers.append({
                "_id": str(user["_id"]),
                "username": user.get("username", ""),
                "email": user.get("email", ""),
                "firstName": user.get("firstName", ""),
                "lastName": user.get("lastName", ""),
                "created_at": user.get("created_at", datetime.utcnow().isoformat())
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
        print(f"❌ Error fetching dashboard data: {str(e)}")
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
            {"$sort": {"_id": 1}},
            {"$limit": 6}
        ]
        monthly_result = list(db.orders.aggregate(monthly_pipeline))

        return jsonify({
            "success": True,
            "monthlyRevenue": monthly_result
        }), 200

    except Exception as e:
        print(f"❌ Error fetching monthly revenue: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Failed to fetch monthly revenue: {str(e)}",
            "monthlyRevenue": []
        }), 500