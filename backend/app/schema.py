"""Indexes for canonical MongoDB relations and expiring session/draft documents."""


def ensure_indexes(db):
    from .access import ensure_access_data
    ensure_access_data(db)
    from .policies import ensure_policies
    ensure_policies(db)
    from .content import ensure_content
    ensure_content(db)
    db.captcha_challenges.create_index('expiresAt', expireAfterSeconds=0)
    db.policy_versions.create_index([('kind', 1), ('publishedAt', -1)])
    db.users.create_index('roleId')
    db.favorites.create_index([('userId', 1), ('productId', 1)], unique=True)
    db.favorites.create_index([('userId', 1), ('createdAt', -1)])
    db.notifications.create_index([('userId', 1), ('eventKey', 1), ('audience', 1)], unique=True)
    db.notifications.create_index([('userId', 1), ('audience', 1), ('readAt', 1), ('_id', -1)])
    db.notifications.create_index([('userId', 1), ('_id', -1)])
    for collection in ('orders', 'users', 'products', 'roles', 'settings'):
        db[collection].create_index('_notificationOutbox.key', sparse=True)
    db.rate_limits.create_index('expiresAt', expireAfterSeconds=0)
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
    db.users.create_index('email', unique=True, name='unique_current_email', partialFilterExpression={'emailUnique': True})
    db.discounts.create_index('code', unique=True, partialFilterExpression={'code': {'$type': 'string'}})


def ensure_validators(db):
    from .policies import POLICY_SCHEMA
    object_id = {'bsonType': 'objectId'}
    quantity = {'bsonType': ['int', 'long'], 'minimum': 1}
    schemas = {
        'favorites': {'required': ['userId', 'productId', 'createdAt'], 'properties': {
            'userId': object_id, 'productId': object_id, 'createdAt': {'bsonType': 'date'}}},
        'captcha_challenges': {'required': ['secret', 'binding', 'purpose', 'challenge', 'expiresAt'], 'properties': {
            'secret': {'bsonType': 'string'}, 'binding': {'bsonType': 'string'}, 'purpose': {'enum': ['login', 'signup']},
            'challenge': {'bsonType': 'object'}, 'expiresAt': {'bsonType': 'date'}}},
        'policy_versions': POLICY_SCHEMA,
        'notifications': {'required': ['userId', 'eventKey', 'audience', 'category', 'title', 'message', 'href', 'createdAt', 'eventAt', 'readAt'], 'properties': {
            'userId': object_id, 'eventKey': {'bsonType': 'string'},
            'audience': {'enum': ['personal', 'admin']}, 'category': {'enum': ['orders', 'account', 'inventory', 'store']},
            'title': {'bsonType': 'string', 'maxLength': 150}, 'message': {'bsonType': 'string', 'maxLength': 1000},
            'href': {'bsonType': 'string', 'pattern': '^/(order-history|profile|admin/)'},
            'createdAt': {'bsonType': 'date'}, 'eventAt': {'bsonType': 'date'}, 'readAt': {'bsonType': ['date', 'null']}}},
        'users': {'properties': {'roleId': object_id}},
        'account_options': {'required': ['genders'], 'properties': {
            'genders': {'bsonType': 'array', 'minItems': 1, 'maxItems': 20, 'uniqueItems': True,
                        'items': {'bsonType': 'string', 'minLength': 1, 'maxLength': 30}}}},
        'catalog_options': {'required': ['categories', 'sizes', 'materials'], 'properties': {
            key: {'bsonType': 'array', 'minItems': 1, 'maxItems': 50, 'uniqueItems': True,
                  'items': {'bsonType': 'string', 'minLength': 1, 'maxLength': 80}}
            for key in ('categories', 'sizes', 'materials')}},
        'roles': {'required': ['code', 'label', 'permissions', 'active', 'system'], 'properties': {
            'code': {'bsonType': 'string', 'pattern': '^[a-z][a-z0-9_-]{1,39}$'},
            'label': {'bsonType': 'string', 'minLength': 1, 'maxLength': 80},
            'permissions': {'bsonType': 'array', 'uniqueItems': True, 'items': {'enum': ['admin.access']}},
            'active': {'bsonType': 'bool'}, 'system': {'bsonType': 'bool'}}},
        'rate_limits': {'required': ['attempts', 'allowed', 'checkedAt', 'expiresAt'], 'properties': {
            'attempts': {'bsonType': 'array', 'maxItems': 600, 'items': {'bsonType': 'date'}},
            'reservations': {'bsonType': 'array', 'maxItems': 600, 'items': {
                'bsonType': 'object', 'required': ['id', 'at'],
                'properties': {'id': {'bsonType': 'string'}, 'at': {'bsonType': 'date'}}}},
            'allowed': {'bsonType': 'bool'}, 'checkedAt': {'bsonType': 'date'}, 'expiresAt': {'bsonType': 'date'}}},
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
