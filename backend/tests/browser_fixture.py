"""Run an isolated MongoDB-backed API for browser workflow checks.

From the repository root: py backend/tests/browser_fixture.py
In another terminal, set OMS_BACKEND_URL=http://127.0.0.1:5001 before starting Vite.
Fixture credentials are test-only: customer_test/admin_test, password Demo-123!.
Use the shutdown URL/key in .tmp/browser-fixture.json to remove the test database.
"""
import json
import secrets
import shutil
import sys
import threading
from pathlib import Path
from uuid import uuid4
from bson import ObjectId
from flask import jsonify, request
from werkzeug.serving import make_server

WORKSPACE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(WORKSPACE / 'backend'))
from app import create_app
from app.schema import ensure_indexes, ensure_validators
from app.security import hash_password


def run():
    app = create_app()
    client = app.db.client
    name = 'oms_test_' + uuid4().hex[:24]
    app.db = client.get_database(name)
    ensure_indexes(app.db)
    ensure_validators(app.db)
    directory = WORKSPACE / '.tmp'
    directory.mkdir(exist_ok=True)
    uploads = directory / 'browser-uploads'
    uploads.mkdir(exist_ok=True)
    for image in ('p1.jpg', 'p2.jpg'):
        shutil.copyfile(WORKSPACE / 'frontend' / 'public' / image, uploads / image)
    app.config['UPLOAD_FOLDER'] = str(uploads)
    address = {'id': 'home', 'title': 'Home', 'recipient': 'Test Customer', 'contact': '09123456789',
               'street': '12 Main Street', 'barangay': 'Lahug', 'city': 'Cebu City', 'province': 'Cebu', 'isDefault': True}
    ids = [ObjectId() for _ in range(4)]
    app.db.users.insert_many([{'_id': ids[0], 'username': 'customer_test', 'user_id': 'USR-000001', 'firstName': 'Test', 'lastName': 'Customer',
        'email': 'customer@example.invalid', 'phone': address['contact'], 'addresses': [address], 'password': hash_password('Demo-123!'), 'roleId': app.db.roles.find_one({'code': 'customer'})['_id']},
        {'_id': ids[1], 'username': 'admin_test', 'user_id': 'USR-000002', 'email': 'admin@example.invalid', 'password': hash_password('Demo-123!'), 'roleId': app.db.roles.find_one({'code': 'admin'})['_id']}])
    app.db.products.insert_many([{'_id': ids[2], 'product_id': 'PROD-000001', 'name': 'Vintage cotton shirt', 'price': 125,
        'stock': 5, 'category': 'Shirts', 'size': 'Medium', 'condition': 'Good', 'image': '/static/uploads/p1.jpg', 'is_active': True},
        {'_id': ids[3], 'product_id': 'PROD-000002', 'name': 'Everyday jacket', 'price': 250,
        'stock': 3, 'category': 'Jackets', 'size': 'Large', 'condition': 'Good', 'image': '/static/uploads/p2.jpg', 'is_active': True}])
    key = secrets.token_urlsafe(32)
    responsive = {}
    if '--responsive' in sys.argv:
        from responsive_fixture import seed_responsive_records
        responsive = seed_responsive_records(app.db, ids[0], ids[2], address)
    server = make_server('127.0.0.1', 5001, app, threaded=True)

    @app.post('/__test__/shutdown')
    def shutdown():
        if not secrets.compare_digest(request.headers.get('X-Test-Key', ''), key):
            return jsonify(error='Access denied'), 403
        threading.Timer(.2, server.shutdown).start()
        return jsonify(success=True)

    (directory / 'browser-fixture.json').write_text(json.dumps({'database': name, 'key': key, 'customerId': str(ids[0]),
        'adminId': str(ids[1]), 'productId': str(ids[2]), 'otherProductId': str(ids[3]), **responsive}), encoding='utf-8')
    try:
        print('Browser fixture API ready on http://127.0.0.1:5001', flush=True)
        server.serve_forever()
    finally:
        server.server_close()
        if name.startswith('oms_test_') and len(name) == 33:
            client.drop_database(name)
        client.close()
        print('Browser fixture database removed.', flush=True)


if __name__ == '__main__':
    run()
