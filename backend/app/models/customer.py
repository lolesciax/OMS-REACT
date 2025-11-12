from datetime import datetime
from bson import ObjectId

class Customer:
    def __init__(self, db):
        self.collection = db.customers
    
    def create_customer(self, customer_data):
        """Create a new customer"""
        customer_data['created_at'] = datetime.utcnow()
        customer_data['updated_at'] = datetime.utcnow()
        
        result = self.collection.insert_one(customer_data)
        return self.get_customer_by_id(result.inserted_id)
    
    def get_all_customers(self):
        """Get all customers"""
        return list(self.collection.find().sort('created_at', -1))
    
    def get_customer_by_id(self, customer_id):
        """Get customer by ID"""
        if isinstance(customer_id, str):
            customer_id = ObjectId(customer_id)
        return self.collection.find_one({'_id': customer_id})
    
    def update_customer(self, customer_id, update_data):
        """Update customer information"""
        if isinstance(customer_id, str):
            customer_id = ObjectId(customer_id)
        
        update_data['updated_at'] = datetime.utcnow()
        result = self.collection.update_one(
            {'_id': customer_id},
            {'$set': update_data}
        )
        return result.modified_count > 0
    
    def delete_customer(self, customer_id):
        """Delete a customer"""
        if isinstance(customer_id, str):
            customer_id = ObjectId(customer_id)
        
        result = self.collection.delete_one({'_id': customer_id})
        return result.deleted_count > 0
    
    def search_customers(self, query):
        """Search customers by name or email"""
        return list(self.collection.find({
            '$or': [
                {'name': {'$regex': query, '$options': 'i'}},
                {'email': {'$regex': query, '$options': 'i'}}
            ]
        }))
    
    def customer_exists(self, email):
        """Check if customer with email already exists"""
        return self.collection.find_one({'email': email}) is not None