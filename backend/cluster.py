"""Run a loopback-only Caddy balancer and two authenticated Waitress workers."""
import argparse
from collections import deque
import hashlib
import io
import json
import os
import re
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / 'backend'
CADDY_VERSION = '2.11.7'


def install_caddy():
    if sys.platform != 'win32':
        raise RuntimeError('Install Caddy from https://caddyserver.com/docs/install and set CADDY_BIN.')
    name = f'caddy_{CADDY_VERSION}_windows_amd64.zip'
    base = f'https://github.com/caddyserver/caddy/releases/download/v{CADDY_VERSION}/'
    with urllib.request.urlopen(base + f'caddy_{CADDY_VERSION}_checksums.txt', timeout=30) as response:
        checksums = response.read(1024 * 1024).decode()
    expected = next((line.split()[0] for line in checksums.splitlines() if line.split()[-1].lstrip('*') == name), None)
    if not expected:
        raise RuntimeError('The official release checksum is missing.')
    with urllib.request.urlopen(base + name, timeout=60) as response:
        archive = response.read(80 * 1024 * 1024)
    algorithm = {64: hashlib.sha256, 128: hashlib.sha512}.get(len(expected))
    if algorithm is None or algorithm(archive).hexdigest() != expected:
        raise RuntimeError('Caddy checksum verification failed.')
    destination = ROOT / '.tmp' / 'tools' / 'caddy.exe'
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Extract only this member; archive paths cannot write outside the tool cache.
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        destination.write_bytes(bundle.read('caddy.exe'))
    print(f'Installed checksum-verified Caddy {CADDY_VERSION} in the local tool cache.', flush=True)
    return destination


def find_caddy():
    configured = os.getenv('CADDY_BIN')
    candidate = Path(configured) if configured else ROOT / '.tmp' / 'tools' / 'caddy.exe'
    if candidate.is_file():
        return str(candidate.resolve())
    available = shutil.which('caddy')
    if available:
        return available
    raise RuntimeError('Caddy is missing. Run: py backend/cluster.py --install-caddy')


def start(command, environment):
    return subprocess.Popen(command, cwd=ROOT, env=environment,
                            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)


def wait_ready(port, token, process, timeout=40):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f'Worker on port {port} exited during startup.')
        try:
            request = urllib.request.Request(f'http://127.0.0.1:{port}/api/health', headers={'X-OMS-Proxy-Token': token})
            with urllib.request.urlopen(request, timeout=2) as response:
                if response.status == 200:
                    return
        except (OSError, urllib.error.URLError):
            time.sleep(.2)
    raise RuntimeError(f'Worker on port {port} did not become ready.')


def ensure_ports_free(ports):
    for port in ports:
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', port))


def run_cluster(port=5000, worker_ports=(5101, 5102), state_file=None):
    if len({port, *worker_ports}) != 3 or any(not 1024 <= value <= 65535 for value in (port, *worker_ports)):
        raise ValueError('Choose three distinct ports between 1024 and 65535.')
    ensure_ports_free((port, *worker_ports))
    caddy = find_caddy()
    environment = os.environ.copy()
    environment.update({
        'PYTHONDONTWRITEBYTECODE': '1', 'FLASK_DEBUG': '0', 'TRUST_PROXY': '1',
        'OMS_PROXY_TOKEN': environment.get('OMS_PROXY_TOKEN') or secrets.token_urlsafe(48),
        'OMS_PROXY_PEERS': '127.0.0.1/32', 'OMS_BALANCER_PORT': str(port),
        'OMS_WORKER_PORT_1': str(worker_ports[0]), 'OMS_WORKER_PORT_2': str(worker_ports[1]),
    })
    if not re.fullmatch(r'[A-Za-z0-9_-]{32,128}', environment['OMS_PROXY_TOKEN']):
        raise ValueError('OMS_PROXY_TOKEN must contain 32–128 URL-safe characters.')
    configuration = str(BACKEND / 'Caddyfile')
    # Validate before opening worker ports; admin/config persistence are disabled.
    subprocess.run([caddy, 'validate', '--config', configuration, '--adapter', 'caddyfile'],
                   env=environment, cwd=ROOT, check=True, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    children = []
    workers = {}
    restarts = deque()

    def save_state():
        if state_file:
            state = Path(state_file)
            state.parent.mkdir(parents=True, exist_ok=True)
            # No proxy credentials or customer information in this status file.
            state.write_text(json.dumps({'supervisor': os.getpid(), 'balancer': balancer.pid,
                'port': port, 'workers': {str(key): child.pid for key, child in workers.items()}}), encoding='utf-8')

    try:
        for worker_port in worker_ports:
            child = start([sys.executable, str(BACKEND / 'run.py')], {**environment, 'PORT': str(worker_port)})
            children.append(child)
            workers[worker_port] = child
            wait_ready(worker_port, environment['OMS_PROXY_TOKEN'], child)
        balancer = start([caddy, 'run', '--config', configuration, '--adapter', 'caddyfile'], environment)
        children.append(balancer)
        save_state()
        print(f'Balanced API: http://127.0.0.1:{port}; private workers: {worker_ports}. Press Ctrl+C to stop.', flush=True)
        while True:
            time.sleep(.5)
            if balancer.poll() is not None:
                raise RuntimeError('The load balancer exited; stopping private workers.')
            for worker_port, child in list(workers.items()):
                if child.poll() is None:
                    continue
                now = time.monotonic()
                while restarts and restarts[0] < now - 60:
                    restarts.popleft()
                if len(restarts) >= 5:
                    raise RuntimeError('Repeated worker failures; stopping rather than restarting indefinitely.')
                restarts.append(now)
                replacement = start([sys.executable, str(BACKEND / 'run.py')], {**environment, 'PORT': str(worker_port)})
                children.append(replacement)
                workers[worker_port] = replacement
                wait_ready(worker_port, environment['OMS_PROXY_TOKEN'], replacement)
                save_state()
                print(f'Restarted worker on port {worker_port}.', flush=True)
    except KeyboardInterrupt:
        pass
    finally:
        for child in reversed(children):
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
        if state_file:
            Path(state_file).unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install-caddy', action='store_true')
    parser.add_argument('--port', type=int, default=5000)
    parser.add_argument('--worker-ports', nargs=2, type=int, default=(5101, 5102))
    parser.add_argument('--state-file')
    options = parser.parse_args()
    try:
        if options.install_caddy:
            install_caddy()
        else:
            run_cluster(options.port, tuple(options.worker_ports), options.state_file)
    except (RuntimeError, ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f'Cluster stopped: {error}', file=sys.stderr)
        sys.exit(1)
