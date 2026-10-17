"""Preview or apply canonical MongoDB references, cart deduplication and indexes.

Every changed original is archived in normalization_backups before it is updated.
Run while the backend is stopped. No accounts or orders are deleted or merged.
"""
import argparse
from collections import defaultdict
from datetime import datetime
from urllib.parse import urlsplit
from uuid import NAMESPACE_URL, uuid5
import re
from bson import ObjectId
from app import create_app
from app.schema import ensure_indexes, ensure_validators
from normalize_catalog import numeric_repairs


def image_path(value):
    if not isinstance(value, str):
        return value
    path = urlsplit(value).path
    for prefix in ('/static/uploads/', '/uploads/'):
        if path.startswith(prefix):
            return '/static/uploads/' + path[len(prefix):]
    return value


def plan_normalization(db):
    users = list(db.users.find({}))
    aliases = {}
    ambiguous = set()
    for user in users:
        for value in (user['_id'], user.get('username'), user.get('user_id')):
            if value:
                key = str(value)
                if key in aliases and aliases[key] != user['_id']:
                    ambiguous.add(key)
                aliases[key] = user['_id']
    for key in ambiguous:
        aliases.pop(key, None)
    operations = []
    used_display_ids = set()
    numbers = [int(match[1]) for user in users if (match := re.fullmatch(r'USR-?(\d+)', str(user.get('user_id', ''))))]
    next_number = max(numbers, default=0) + 1
    for user in users:
        updated = dict(user)
        display = user.get('user_id')
        if not display or display in used_display_ids:
            updated['user_id'] = f'USR-{next_number:06d}'
            next_number += 1
        used_display_ids.add(updated['user_id'])
        addresses = []
        for index, address in enumerate(user.get('addresses', [])):
            address = dict(address)
            address['id'] = str(address.get('id') or uuid5(NAMESPACE_URL, f"oms:{user['_id']}:address:{index}"))
            addresses.append(address)
        if 'addresses' in user:
            updated['addresses'] = addresses
        if isinstance(user.get('email'), str):
            updated['email'] = user['email'].strip().lower()
        if updated != user:
            operations.append(('users', user, updated))
    groups = defaultdict(list)
    for cart in db.carts.find({}):
        owner = aliases.get(str(cart.get('user_id')))
        if not owner:
            raise ValueError('A cart has no matching user. No repair was applied.')
        groups[owner].append(cart)
    merged = 0
    for owner, carts in groups.items():
        keeper = next((cart for cart in carts if cart.get('user_id') == owner), carts[0])
        items = {}
        for cart in carts:
            for item in cart.get('items', []):
                pid = item.get('product_id')
                qty = item.get('qty', 1)
                if not ObjectId.is_valid(pid) or type(qty) is not int or qty < 0:
                    raise ValueError('Invalid cart item; inspect its archived source before normalizing.')
                if not qty:
                    continue
                pid = ObjectId(pid)
                normalized = {'product_id': pid, 'qty': qty, 'selected': bool(item.get('selected', False))}
                if item.get('added_at'):
                    normalized['added_at'] = item['added_at']
                if pid in items:
                    # Alias carts represent the same bag. Never multiply its quantities.
                    normalized['qty'] = max(qty, items[pid]['qty'])
                    normalized['selected'] = False
                items[pid] = normalized
        updated = {**keeper, 'user_id': owner, 'items': list(items.values())}
        if updated != keeper:
            operations.append(('carts', keeper, updated))
        for cart in carts:
            if cart['_id'] != keeper['_id']:
                operations.append(('carts', cart, None))
                merged += 1
    for order in db.orders.find({}):
        owner = aliases.get(str(order.get('userId')))
        if not owner:
            raise ValueError('An order has no matching user. No repair was applied.')
        updated = {**order, 'userId': owner}
        items = []
        for item in order.get('items', []):
            if not ObjectId.is_valid(item.get('id')):
                raise ValueError('An order has an invalid product reference. No repair was applied.')
            item = {**item, 'id': ObjectId(item['id'])}
            item.pop('_id', None)
            item.pop('stock', None)
            item['image'] = image_path(item.get('image', ''))
            items.append(item)
        updated['items'] = items
        if updated != order:
            operations.append(('orders', order, updated))
    for product in db.products.find({}):
        updated = {**product, **numeric_repairs(product)}
        if 'image' in product:
            updated['image'] = image_path(product['image'])
        if updated != product:
            operations.append(('products', product, updated))
    report = {'changes': len(operations), 'duplicateCartsMerged': merged,
              'collections': {name: sum(collection == name for collection, _, _ in operations)
                              for name in ('users', 'carts', 'orders', 'products')}}
    return operations, report


def apply_normalization(db, operations):
    run_id = ObjectId()
    for collection, original, updated in operations:
        db.normalization_backups.insert_one({'runId': run_id, 'collection': collection,
                                             'original': original, 'createdAt': datetime.utcnow()})
        # Compare the full original to avoid overwriting a concurrent edit.
        query = {'_id': original['_id'], **{key: value for key, value in original.items() if key != '_id'}}
        if updated is None:
            result = db[collection].delete_one(query)
            matched = result.deleted_count
        else:
            result = db[collection].replace_one(query, updated)
            matched = result.matched_count
        if not matched:
            raise RuntimeError('A document changed during normalization. Stop the backend and rerun the preview.')
    ensure_indexes(db)
    db.users.create_index('user_id', unique=True, partialFilterExpression={'user_id': {'$type': 'string'}})
    ensure_validators(db)
    return str(run_id)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    options = parser.parse_args()
    app = create_app()
    plan, report = plan_normalization(app.db)
    print(report)
    if options.apply:
        print('Applied normalization run:', apply_normalization(app.db, plan))
    else:
        print('Preview only; add --apply to save. Originals will be archived in MongoDB.')
