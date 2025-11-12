# models/product.py
from bson import ObjectId
from datetime import datetime

class Product:
    def __init__(self, db):
        self.collection = db.products
    
    def get_all_products(self, active_only=True):
        """Get all products, optionally only active ones"""
        query = {'is_active': True} if active_only else {}
        return list(self.collection.find(query))
    
    def get_product_by_id(self, product_id):
        """Get a single product by ID"""
        return self.collection.find_one({'_id': ObjectId(product_id)})
    
    def get_product_by_product_id(self, product_id):
        """Get a single product by product_id field"""
        return self.collection.find_one({'product_id': product_id})
    
    def search_products(self, query):
        """Search products by name or category"""
        search_filter = {
            '$and': [
                {'is_active': True},
                {'$or': [
                    {'name': {'$regex': query, '$options': 'i'}},
                    {'category': {'$regex': query, '$options': 'i'}},
                    {'description': {'$regex': query, '$options': 'i'}}
                ]}
            ]
        }
        return list(self.collection.find(search_filter))
    
    def create_product(self, product_data):
        """Create a new product"""
        product = {
            'product_id': product_data['product_id'],
            'name': product_data['name'],
            'category': product_data['category'],
            'price': float(product_data['price']),
            'stock': int(product_data['stock']),
            'condition': product_data.get('condition', 'Good'),
            'description': product_data.get('description', ''),
            'image': product_data.get('image', '/static/uploads/default-product.jpg'),
            'is_active': True,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        result = self.collection.insert_one(product)
        return result.inserted_id
    
    def update_product(self, product_id, update_data):
        """Update a product"""
        # Only include fields that are provided
        update_fields = {}
        allowed_fields = ['name', 'category', 'price', 'stock', 'condition', 'description', 'image']
        
        for field in allowed_fields:
            if field in update_data:
                if field == 'price':
                    update_fields[field] = float(update_data[field])
                elif field == 'stock':
                    update_fields[field] = int(update_data[field])
                else:
                    update_fields[field] = update_data[field]
        
        update_fields['updated_at'] = datetime.utcnow()
        
        result = self.collection.update_one(
            {'_id': ObjectId(product_id)},
            {'$set': update_fields}
        )
        return result.modified_count > 0
    
    def delete_product(self, product_id):
        """Soft delete a product by setting is_active to False"""
        result = self.collection.update_one(
            {'_id': ObjectId(product_id)},
            {'$set': {
                'is_active': False,
                'updated_at': datetime.utcnow()
            }}
        )
        return result.modified_count > 0
    
    def update_stock(self, product_id, quantity):
        """Update product stock (for cart/orders)"""
        product = self.get_product_by_id(product_id)
        if not product:
            raise Exception('Product not found')
        
        new_stock = product['stock'] - quantity
        if new_stock < 0:
            raise Exception(f'Insufficient stock. Only {product["stock"]} available')
        
        result = self.collection.update_one(
            {'_id': ObjectId(product_id)},
            {'$set': {
                'stock': new_stock,
                'updated_at': datetime.utcnow()
            }}
        )
        return result.modified_count > 0
    
    def check_stock_availability(self, product_id, requested_quantity):
        """Check if requested quantity is available"""
        product = self.get_product_by_id(product_id)
        if not product:
            return False, "Product not found"
        
        if product['stock'] >= requested_quantity:
            return True, f"Stock available: {product['stock']}"
        else:
            return False, f"Only {product['stock']} items available"