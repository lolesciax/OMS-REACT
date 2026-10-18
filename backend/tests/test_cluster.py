from altcha import Challenge, Payload, solve_challenge
"""Opt-in real Caddy/two-worker smoke test using a disposable database only."""
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
from uuid import uuid4
from datetime import datetime, timedelta
from pymongo import MongoClient
from app.security import hash_password

ROOT = Path(__file__).resolve().parents[2]


@unittest.skipUnless(os.getenv('OMS_CLUSTER_INTEGRATION') == '1', 'Opt-in Caddy cluster integration test')
class ClusterTests(unittest.TestCase):
    def test_real_balancer_shared_limits_sessions_failover_and_direct_access(self):
        database_name = 'oms_test_' + uuid4().hex[:24]
        connection = MongoClient(os.environ['MONGODB_URI'], serverSelectionTimeoutMS=5000)
        database = connection[database_name]
        temporary = tempfile.TemporaryDirectory(dir=Path(__file__).parent)
        directory = Path(temporary.name)
        state_path = directory / 'state.json'
        token = 'cluster-test-private-token-' + uuid4().hex
        uri = urllib.parse.urlsplit(os.environ['MONGODB_URI'])
        environment = {**os.environ, 'MONGODB_URI': urllib.parse.urlunsplit(uri._replace(path='/' + database_name)),
            'OMS_PROXY_TOKEN': token, 'PYTHONDONTWRITEBYTECODE': '1', 'ADMIN_PASSWORD': '', 'TRUST_PROXY': '1',
            'OMS_UPLOAD_FOLDER': str(directory / 'uploads')}
        user_id = database.users.insert_one({'username': 'cluster-user', 'password': hash_password('Example-123!'), 'isAdmin': False}).inserted_id
        product_id = database.products.insert_one({'name': 'Test shirt', 'price': 20, 'stock': 5, 'is_active': True}).inserted_id
        order_id = database.orders.insert_one({'userId': user_id, 'status': 'pending',
            'items': [{'id': product_id, 'qty': 1, 'price': 20, 'name': 'Test shirt'}]}).inserted_id
        log = (directory / 'cluster.log').open('w', encoding='utf-8')
        process = subprocess.Popen([sys.executable, str(ROOT / 'backend/cluster.py'), '--port', '5002',
            '--worker-ports', '5201', '5202', '--state-file', str(state_path)], env=environment, cwd=ROOT,
            stdout=log, stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

        def request(path, port=5002, body=None, headers=None, raw=None):
            supplied = dict(headers or {})
            if body is not None:
                supplied['Content-Type'] = 'application/json'
            req = urllib.request.Request(f'http://127.0.0.1:{port}{path}',
                data=raw if raw is not None else (json.dumps(body).encode() if body is not None else None), headers=supplied)
            try:
                response = opener.open(req, timeout=10)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                data = response.read()
                return response.status, response.headers, json.loads(data or b'{}') if response.headers.get_content_type() == 'application/json' else data

        try:
            deadline = time.monotonic() + 50
            while True:
                if process.poll() is not None:
                    self.fail('Cluster startup failed: ' + (directory / 'cluster.log').read_text())
                try:
                    if state_path.exists() and request('/api/health')[0] == 200:
                        break
                except OSError:
                    pass
                if time.monotonic() > deadline:
                    self.fail('Cluster did not become ready')
                time.sleep(.2)
            for port in (5201, 5202):
                self.assertEqual(request('/api/health', port)[0], 403)
                self.assertEqual(request('/api/health', port, headers={'X-Forwarded-For': '192.0.2.50', 'X-OMS-Proxy-Token': 'forged'})[0], 403)
            for index in range(20):
                path = '/api/auth/login' + ('/' if index % 2 else '') + '?cache=' + str(index)
                status, _, _ = request(path, body={'username': 'absent-user', 'password': ''},
                    headers={'X-Forwarded-For': f'192.0.2.{index}', 'Forwarded': f'for=192.0.2.{index}',
                        'X_Forwarded_For': f'198.51.100.{index}', 'X-Forwarded_For': f'203.0.113.{index}'})
                self.assertEqual(status, 400)
            status, headers, _ = request('/api/auth/login/', body={'username': 'absent-user', 'password': ''})
            self.assertEqual(status, 429)
            self.assertIn('Retry-After', headers)
            database.rate_limits.delete_many({})
            challenge = Challenge.from_dict(request('/api/auth/captcha?purpose=login')[2])
            proof = Payload(challenge, solve_challenge(challenge)).to_base64()
            status, _, login = request('/api/auth/login', body={'username': 'cluster-user', 'password': 'Example-123!', 'captcha': proof})
            self.assertEqual(status, 200)
            for index in range(8):
                self.assertEqual(request('/api/auth/session' + ('/' if index % 2 else ''))[0], 200)
            # The same session and budgets work on both private workers.
            trusted = {'X-OMS-Proxy-Token': token, 'X-Forwarded-For': '192.0.2.88'}
            for port in (5201, 5202):
                self.assertEqual(request('/api/auth/session', port, headers=trusted)[0], 200)
            boundary = 'oms-proof-' + uuid4().hex
            fields = b''.join((f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n').encode()
                              for name, value in (('orderId', order_id), ('userId', user_id)))
            image = (ROOT / 'frontend/public/p1.jpg').read_bytes()
            fields += (f'--{boundary}\r\nContent-Disposition: form-data; name="paymentProof"; filename="proof.jpg"\r\nContent-Type: image/jpeg\r\n\r\n').encode()
            fields += image + (f'\r\n--{boundary}--\r\n').encode()
            status, _, proof = request('/api/orders/upload-payment-proof', raw=fields,
                headers={'Content-Type': f'multipart/form-data; boundary={boundary}', 'X-CSRF-Token': login['csrfToken']})
            self.assertEqual(status, 200)
            self.assertEqual(database.products.find_one({'_id': product_id})['stock'], 4)
            self.assertEqual(request(proof['proofPath'])[0], 200)
            for index in range(20):
                status, _, _ = request('/api/auth/login', (5201, 5202)[index % 2],
                    body={'username': 'absent-user', 'password': ''}, headers=trusted)
                self.assertEqual(status, 400)
            self.assertEqual(request('/api/auth/login', 5202, body={'username': 'absent-user', 'password': ''}, headers=trusted)[0], 429)
            # A public health-header forgery is still throttled; private probes
            # must remain healthy even while this client's budget is exhausted.
            digest = hashlib.sha256(b'ip:burst:127.0.0.1').hexdigest()
            database.rate_limits.update_one({'_id': digest}, {'$set': {'attempts': [datetime.utcnow()] * 120,
                'allowed': True, 'checkedAt': datetime.utcnow(), 'expiresAt': datetime.utcnow() + timedelta(minutes=1)}}, upsert=True)
            self.assertEqual(request('/api/health', headers={'X-OMS-Health-Check': '1', 'X_OMS_Health_Check': '1'})[0], 429)
            time.sleep(6)
            database.rate_limits.delete_many({})
            self.assertEqual(request('/api/health')[0], 200)
            before = json.loads(state_path.read_text())
            os.kill(before['workers']['5201'], signal.SIGTERM)
            deadline = time.monotonic() + 30
            while True:
                self.assertEqual(request('/api/health')[0], 200)
                after = json.loads(state_path.read_text())
                if after['workers']['5201'] != before['workers']['5201']:
                    break
                if time.monotonic() > deadline:
                    self.fail('Failed worker was not restarted')
                time.sleep(.2)
            self.assertEqual(request('/api/auth/session')[0], 200)
            self.assertEqual(request('/api/auth/logout/', body={})[0], 403)
            self.assertEqual(request('/api/auth/logout/', body={}, headers={'X-CSRF-Token': login['csrfToken']})[0], 200)
            self.assertEqual(request('/api/auth/session/')[0], 401)
            self.assertEqual(request(proof['proofPath'])[0], 404)
        finally:
            state = json.loads(state_path.read_text()) if state_path.exists() else {}
            process.terminate()
            process.wait(timeout=10)
            for child in [state.get('balancer'), *state.get('workers', {}).values()]:
                if child:
                    try:
                        os.kill(child, signal.SIGTERM)
                    except OSError:
                        pass
            log.close()
            if not database_name.startswith('oms_test_') or len(database_name) != 33:
                raise RuntimeError('Refusing to remove an unexpected database')
            connection.drop_database(database_name)
            connection.close()
            temporary.cleanup()
