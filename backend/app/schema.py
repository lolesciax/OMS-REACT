"""Indexes for canonical MongoDB relations and expiring session/draft documents."""


def ensure_indexes(db):
    db.sessions.create_index('expiresAt', expireAfterSeconds=0)
    db.sessions.create_index('userId')
    db.checkouts.create_index('userId', unique=True)
    db.checkouts.create_index('expiresAt', expireAfterSeconds=0)
    db.orders.create_index([('userId', 1), ('createdAt', -1)])
    # Legacy duplicate carts are merged by normalize_database.py before this
    # partial index is created; unmatched legacy owners cannot bypass new writes.
    db.carts.create_index('user_id', unique=True, partialFilterExpression={'user_id': {'$type': 'objectId'}})
    db.users.create_index('username', unique=True, partialFilterExpression={'username': {'$type': 'string'}})
    # Existing accounts can share an email. Preserve them and index lookups.
    db.users.create_index('email')


def ensure_validators(db):
    object_id = {'bsonType': 'objectId'}
    quantity = {'bsonType': ['int', 'long'], 'minimum': 1}
    schemas = {
        'sessions': {'required': ['userId', 'expiresAt', 'csrfToken', 'passwordVersion'], 'properties': {
            'userId': object_id, 'expiresAt': {'bsonType': 'date'}, 'csrfToken': {'bsonType': 'string'}, 'passwordVersion': {'bsonType': 'string'}}},
        'checkouts': {'required': ['userId', 'orderId', 'items', 'expiresAt'], 'properties': {
            'userId': object_id, 'orderId': object_id, 'expiresAt': {'bsonType': 'date'},
            'items': {'bsonType': 'array', 'minItems': 1, 'items': {'bsonType': 'object', 'required': ['productId', 'qty'], 'properties': {'productId': object_id, 'qty': quantity}}}}},
        'carts': {'required': ['user_id', 'items'], 'properties': {
            'user_id': object_id, 'items': {'bsonType': 'array', 'items': {'bsonType': 'object', 'required': ['product_id', 'qty', 'selected'],
                'properties': {'product_id': object_id, 'qty': quantity, 'selected': {'bsonType': 'bool'}}}}}},
        'orders': {'required': ['userId', 'items'], 'properties': {
            'userId': object_id, 'items': {'bsonType': 'array', 'items': {'bsonType': 'object', 'required': ['id', 'qty', 'price'],
                'properties': {'id': object_id, 'qty': quantity, 'price': {'bsonType': ['double', 'int', 'long', 'decimal'], 'minimum': 0}}}}}},
    }
    for name, schema in schemas.items():
        validator = {'$jsonSchema': {'bsonType': 'object', **schema}}
        if name not in db.list_collection_names():
            db.create_collection(name, validator=validator, validationLevel='strict', validationAction='error')
        else:
            db.command({'collMod': name, 'validator': validator, 'validationLevel': 'strict', 'validationAction': 'error'})
