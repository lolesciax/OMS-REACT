from bson import ObjectId

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
