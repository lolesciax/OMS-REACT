from flask import Blueprint, jsonify, request
import datetime
from bson import ObjectId

bp = Blueprint('users', __name__, url_prefix='/api/users')

@bp.route('/')
def get_users():
    sample_users = [
        {
            '_id': '1',
            'name': 'John Smith',
            'email': 'john@example.com',
            'role': 'customer',
            'created_at': datetime.datetime.utcnow().isoformat()
        },
        {
            '_id': '2', 
            'name': 'Sarah Johnson',
            'email': 'sarah@example.com',
            'role': 'customer',
            'created_at': datetime.datetime.utcnow().isoformat()
        }
    ]
    return jsonify(sample_users)

@bp.route('/test')
def test_users():
    return {'message': 'Users API is working!'}

# -----------------------------------------------------
# 🧩 Get User Profile
# -----------------------------------------------------
@bp.route('/profile/<user_id>', methods=['GET'])
def get_user_profile(user_id):
    try:
        from flask import current_app
        
        print(f"🔍 Fetching profile for user: {user_id}")
        
        # Find user by username or user_id
        user = current_app.db.users.find_one({
            '$or': [
                {'username': user_id},
                {'user_id': user_id},
                {'_id': ObjectId(user_id) if ObjectId.is_valid(user_id) else None}
            ]
        })
        
        if not user:
            print(f"❌ User not found: {user_id}")
            return jsonify({"error": "User not found"}), 404
        
        # Prepare user data (exclude password)
        user['_id'] = str(user['_id'])
        user_data = {k: v for k, v in user.items() if k != 'password'}
        
        print(f"✅ Profile found for: {user_data.get('username')}")
        return jsonify({"user": user_data})
        
    except Exception as e:
        print(f"❌ Error fetching user profile: {e}")
        return jsonify({"error": "Server error"}), 500

# -----------------------------------------------------
# 🧩 Update User Profile
# -----------------------------------------------------
@bp.route('/profile/<user_id>', methods=['PUT'])
def update_user_profile(user_id):
    try:
        from flask import current_app
        
        data = request.get_json()
        print(f"📝 Updating profile for user: {user_id}")
        print(f"📦 Update data: {data}")
        
        # Find user by username or user_id
        user = current_app.db.users.find_one({
            '$or': [
                {'username': user_id},
                {'user_id': user_id},
                {'_id': ObjectId(user_id) if ObjectId.is_valid(user_id) else None}
            ]
        })
        
        if not user:
            print(f"❌ User not found: {user_id}")
            return jsonify({"error": "User not found"}), 404
        
        # Update fields that are provided in the request
        update_fields = {}
        
        # Profile fields
        if 'firstName' in data:
            update_fields['firstName'] = data['firstName']
        if 'lastName' in data:
            update_fields['lastName'] = data['lastName']
        if 'phone' in data:
            update_fields['phone'] = data['phone']
        if 'gender' in data:
            update_fields['gender'] = data['gender']
        if 'dob' in data:
            update_fields['dob'] = data['dob']
        if 'profilePic' in data:
            update_fields['profilePic'] = data['profilePic']
        
        # Address fields
        if 'addresses' in data:
            update_fields['addresses'] = data['addresses']
        
        # Update the user in database
        result = current_app.db.users.update_one(
            {'_id': user['_id']},
            {'$set': update_fields}
        )
        
        if result.modified_count > 0:
            print(f"✅ Profile updated for: {user_id}")
            
            # Fetch updated user data
            updated_user = current_app.db.users.find_one({'_id': user['_id']})
            updated_user['_id'] = str(updated_user['_id'])
            user_data = {k: v for k, v in updated_user.items() if k != 'password'}
            
            return jsonify({
                "message": "Profile updated successfully",
                "user": user_data
            })
        else:
            print(f"ℹ️ No changes made for: {user_id}")
            return jsonify({"message": "No changes made"})
            
    except Exception as e:
        print(f"❌ Error updating user profile: {e}")
        return jsonify({"error": "Server error"}), 500

# -----------------------------------------------------
# 🧩 Update User Address
# -----------------------------------------------------
@bp.route('/profile/<user_id>/address', methods=['PUT'])
def update_user_address(user_id):
    try:
        from flask import current_app
        
        data = request.get_json()
        print(f"🏠 Updating address for user: {user_id}")
        print(f"📦 Address data: {data}")
        
        # Find user by username or user_id
        user = current_app.db.users.find_one({
            '$or': [
                {'username': user_id},
                {'user_id': user_id},
                {'_id': ObjectId(user_id) if ObjectId.is_valid(user_id) else None}
            ]
        })
        
        if not user:
            print(f"❌ User not found: {user_id}")
            return jsonify({"error": "User not found"}), 404
        
        # Update address
        result = current_app.db.users.update_one(
            {'_id': user['_id']},
            {'$set': {'addresses': data.get('addresses', [])}}
        )
        
        if result.modified_count > 0:
            print(f"✅ Address updated for: {user_id}")
            return jsonify({"message": "Address updated successfully"})
        else:
            print(f"ℹ️ No address changes for: {user_id}")
            return jsonify({"message": "No changes made"})
            
    except Exception as e:
        print(f"❌ Error updating user address: {e}")
        return jsonify({"error": "Server error"}), 500