from bson import ObjectId
import re


def find_user(db, value, projection=None):
    """Resolve legacy display IDs only at the boundary; store ObjectId relations."""
    if isinstance(value, ObjectId) or (isinstance(value, str) and ObjectId.is_valid(value)):
        user = db.users.find_one({'_id': ObjectId(value)}, projection)
        if user:
            return user
    if isinstance(value, str) and value:
        return db.users.find_one({'$or': [{'username': value}, {'user_id': value}]}, projection)
    return None


def public_user(user):
    from .access import access_fields
    result = {key: (str(value) if isinstance(value, ObjectId) else value)
            for key, value in user.items()
            if key not in ('password', 'emailUnique', '_notificationOutbox') and not key.startswith('password_reset')}
    result.update(access_fields(user))
    return result


def next_display_id(db, collection, field, prefix):
    if not db.counters.find_one({'_id': collection}):
        numbers = [int(match[1]) for document in db[collection].find({}, {field: 1})
                   if (match := re.fullmatch(rf'{prefix}-?(\d+)', str(document.get(field, ''))))]
        db.counters.update_one({'_id': collection}, {'$max': {'value': max(numbers, default=0)}}, upsert=True)
    counter = db.counters.find_one_and_update({'_id': collection}, {'$inc': {'value': 1}}, upsert=True, return_document=True)
    return f"{prefix}-{counter['value']:06d}"
