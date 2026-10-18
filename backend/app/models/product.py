from bson import ObjectId
from ..notifications import prepare_document, stock_event, stock_update
from uuid import uuid4

class ProductModel:
    def __init__(self, db):
        self.db = db
        self.col = db.products

    def all(self):
        """Return active products that are currently in stock."""
        return list(self.col.find({
            'is_active': True,
            'stock': {'$gt': 0}
        }))

    def create(self, data):
        """Insert a new product document."""
        data.setdefault('_id', ObjectId())
        data['stockNoticeCycle'] = uuid4().hex
        prepare_document(data, 'products', stock_event(data))
        res = self.col.insert_one(data)
        return res.inserted_id

    def update(self, pid, data):
        """Update an existing product by ID."""
        existing = self.get_by_id(pid)
        return self.col.update_one({'_id': ObjectId(pid)}, stock_update(existing, data)).modified_count > 0

    def delete(self, pid):
        """Permanently delete a product by ID."""
        deleted = self.col.delete_one({'_id': ObjectId(pid)}).deleted_count > 0
        if deleted:
            self.db.favorites.delete_many({'productId': ObjectId(pid)})
        return deleted

    def get_by_id(self, pid):
        """Get product by ID"""
        return self.col.find_one({'_id': ObjectId(pid)})
