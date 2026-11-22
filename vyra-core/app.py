"""VYRA Core 1.0: local-only, test-mode merchant payment foundation.

IMPORTANT: Not a live banking service, not a wallet, not an accounting ledger.
No P2P transfer APIs are exposed. No browser client can mark orders paid.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import urllib.error
import urllib.request
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / '.env')
DB_PATH = Path(os.getenv('VYRA_CORE_DB', str(ROOT / 'data' / 'core.sqlite3')))
KEY_ID = os.getenv('VYRA_CORE_RZP_TEST_KEY_ID', '')
KEY_SECRET = os.getenv('VYRA_CORE_RZP_TEST_KEY_SECRET', '')
WEBHOOK_SECRET = os.getenv('VYRA_CORE_RZP_WEBHOOK_SECRET', '')
ADMIN_KEY = os.getenv('VYRA_CORE_ADMIN_KEY', '')
if len(ADMIN_KEY) < 32:
    raise RuntimeError('VYRA_CORE_ADMIN_KEY must have at least 32 characters. Use installer-generated .env.')
if (KEY_ID or KEY_SECRET) and not (KEY_ID.startswith('rzp_test_') and KEY_SECRET):
    raise RuntimeError('VYRA Core only accepts Razorpay TEST credentials. Live keys are prohibited.')

# A deliberately restricted product catalog; the client cannot choose the charged amount.
CATALOG = {'vyra-test-pass': {'amount_paise': 19900, 'label': 'VYRA Test Pass'},
           'vyra-test-bundle': {'amount_paise': 49900, 'label': 'VYRA Test Bundle'}}

app = FastAPI(title='VYRA Core / Merchant Sandbox', version='1.0.0')


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def db_conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA busy_timeout=10000')
    con.execute('PRAGMA foreign_keys=ON')
    try:
        yield con
    finally:
        con.close()


def initialize():
    with db_conn() as con:
        con.executescript('''
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                idempotency_key TEXT NOT NULL UNIQUE,
                sku TEXT NOT NULL,
                amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
                currency TEXT NOT NULL CHECK(currency = 'INR'),
                provider_order_id TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL CHECK(status IN ('created','captured')),
                provider_payment_id TEXT UNIQUE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS payment_events (
                seq INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL REFERENCES orders(id),
                event_key TEXT NOT NULL UNIQUE,
                event_type TEXT NOT NULL,
                provider_payment_id TEXT,
                recorded_at TEXT NOT NULL
            );
            CREATE TRIGGER IF NOT EXISTS no_payment_event_update
            BEFORE UPDATE ON payment_events BEGIN SELECT RAISE(ABORT, 'payment journal is append only'); END;
            CREATE TRIGGER IF NOT EXISTS no_payment_event_delete
            BEFORE DELETE ON payment_events BEGIN SELECT RAISE(ABORT, 'payment journal is append only'); END;
        ''')


initialize()


def protect(request: Request, key: str | None):
    # Admin operations stay on the loopback interface in this foundational release.
    if request.client is not None and request.client.host not in ('127.0.0.1', '::1', 'testclient'):
        raise HTTPException(403, 'Core admin endpoints are local-only')
    if not key or not hmac.compare_digest(key, ADMIN_KEY):
        raise HTTPException(401, 'Invalid core admin key')


@app.middleware('http')
async def add_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    return response


class CreateOrder(BaseModel):
    sku: str = Field(min_length=1, max_length=50)
    idempotency_key: str = Field(min_length=12, max_length=100, pattern=r'^[A-Za-z0-9_-]+$')


def provider_create_order(amount_paise: int, receipt: str) -> dict:
    """Call Razorpay Orders API with server-owned amount; test keys only."""
    if not KEY_ID or not KEY_SECRET:
        raise HTTPException(503, 'Razorpay TEST keys not configured')
    payload = json.dumps({'amount': amount_paise, 'currency': 'INR', 'receipt': receipt}).encode()
    credentials = base64.b64encode(f'{KEY_ID}:{KEY_SECRET}'.encode()).decode()
    req = urllib.request.Request(
        'https://api.razorpay.com/v1/orders', data=payload, method='POST',
        headers={'Authorization': f'Basic {credentials}', 'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            return json.loads(response.read(65536))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
        # Never leak provider credentials or provider error bodies to API clients.
        raise HTTPException(502, 'Test payment provider unavailable or rejected order') from exc


def create_order(sku: str, idempotency_key: str, provider: Callable[[int, str], dict] = provider_create_order):
    if sku not in CATALOG:
        raise HTTPException(422, 'Unknown product')
    product = CATALOG[sku]
    with db_conn() as con:
        # SQLite write lock also prevents concurrent duplicate order creation.
        con.execute('BEGIN IMMEDIATE')
        existing = con.execute('SELECT * FROM orders WHERE idempotency_key=?', (idempotency_key,)).fetchone()
        if existing:
            con.commit()
            if existing['sku'] != sku:
                raise HTTPException(409, 'Idempotency key already used with a different product')
            return public_order(existing)
        oid = 'vcore_' + secrets.token_hex(12)
        # Avoid holding a DB lock during an outbound HTTP call.
        con.commit()
    # A provider timeout can leave an orphaned provider order. Reconcile before production.
    created = provider(product['amount_paise'], oid)
    if (not isinstance(created, dict) or not isinstance(created.get('id'), str)
            or not created['id'].startswith('order_')
            or type(created.get('amount')) is not int or created['amount'] != product['amount_paise']
            or created.get('currency') != 'INR'):
        raise HTTPException(502, 'Invalid test provider order response')
    timestamp = now()
    try:
        with db_conn() as con:
            con.execute('BEGIN IMMEDIATE')
            con.execute('''INSERT INTO orders
                (id,idempotency_key,sku,amount_paise,currency,provider_order_id,status,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?, ?,?)''',
                (oid,idempotency_key,sku,product['amount_paise'],'INR',created['id'],'created',timestamp,timestamp))
            con.execute('INSERT INTO payment_events (order_id,event_key,event_type,recorded_at) VALUES (?,?,?,?)',
                        (oid, 'created:'+oid,'order.created',timestamp))
            con.commit()
    except sqlite3.IntegrityError:
        # Concurrent idempotent requests may have initiated two provider orders;
        # local uniqueness protects our ledger, but reconciliation is still needed.
        with db_conn() as con:
            previous = con.execute('SELECT * FROM orders WHERE idempotency_key=?', (idempotency_key,)).fetchone()
        if previous and previous['sku'] == sku:
            return public_order(previous)
        raise HTTPException(409, 'Order already exists; contact support')
    return {'id': oid, 'sku': sku, 'amount_paise': product['amount_paise'],
            'currency': 'INR', 'provider_order_id': created['id'], 'status': 'created'}


def public_order(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in ('id','sku','amount_paise','currency','provider_order_id','status')}


@app.get('/core/health')
def health():
    return {'status':'ok', 'mode':'test-only', 'merchant_test_configured':bool(KEY_ID and KEY_SECRET),
            'p2p_upi':'disabled_partner_required'}


@app.get('/core/catalog')
def catalog(request: Request, x_vyra_core_key: str | None = Header(default=None)):
    protect(request, x_vyra_core_key)
    return CATALOG


@app.post('/core/orders', status_code=201)
def order(body: CreateOrder, request: Request, x_vyra_core_key: str | None = Header(default=None)):
    protect(request, x_vyra_core_key)
    return create_order(body.sku, body.idempotency_key)


@app.get('/core/orders/{order_id}')
def order_status(order_id: str, request: Request, x_vyra_core_key: str | None = Header(default=None)):
    protect(request, x_vyra_core_key)
    with db_conn() as con:
        row = con.execute('SELECT * FROM orders WHERE id=?', (order_id,)).fetchone()
        if row is None:
            raise HTTPException(404, 'Order not found')
        events = con.execute('SELECT event_type,recorded_at FROM payment_events WHERE order_id=? ORDER BY seq',
                             (order_id,)).fetchall()
    return {**public_order(row), 'journal': [dict(e) for e in events]}


@app.post('/core/webhooks/razorpay')
async def webhook(request: Request, x_razorpay_signature: str | None = Header(default=None),
                  x_razorpay_event_id: str | None = Header(default=None)):
    if not WEBHOOK_SECRET:
        raise HTTPException(503, 'Webhook secret not configured')
    body = await request.body()
    if len(body) > 131072:
        raise HTTPException(413, 'Webhook payload too large')
    expected = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    if not x_razorpay_signature or not hmac.compare_digest(expected, x_razorpay_signature):
        raise HTTPException(401, 'Invalid webhook signature')
    if not x_razorpay_event_id or len(x_razorpay_event_id) > 160:
        raise HTTPException(422, 'Missing provider event ID')
    try:
        event = json.loads(body)
        if event.get('event') != 'payment.captured':
            return {'accepted': True, 'action': 'ignored_event'}
        payment = event['payload']['payment']['entity']
        provider_order_id = payment['order_id']
        payment_id = payment['id']
        amount_paise = payment['amount']
        currency = payment['currency']
        status = payment['status']
        if (not isinstance(provider_order_id, str) or not isinstance(payment_id, str)
                or not payment_id.startswith('pay_') or type(amount_paise) is not int
                or currency != 'INR' or status != 'captured'):
            raise ValueError('Invalid capture event')
    except (ValueError, TypeError, KeyError, AttributeError, json.JSONDecodeError) as exc:
        raise HTTPException(422, 'Invalid captured-payment event') from exc
    with db_conn() as con:
        con.execute('BEGIN IMMEDIATE')
        row = con.execute('SELECT * FROM orders WHERE provider_order_id=?', (provider_order_id,)).fetchone()
        if row is None:
            raise HTTPException(404, 'Unknown provider order')
        if amount_paise != row['amount_paise']:
            raise HTTPException(409, 'Provider payment amount differs from order')
        existing = con.execute('SELECT order_id FROM payment_events WHERE event_key=?',
                               ('razorpay:'+x_razorpay_event_id,)).fetchone()
        if existing:
            con.commit()
            return {'accepted':True,'action':'duplicate'}
        if row['status'] == 'captured':
            if row['provider_payment_id'] != payment_id:
                raise HTTPException(409, 'Order already captured by another payment')
            action = 'already_captured'
        else:
            con.execute('UPDATE orders SET status=?,provider_payment_id=?,updated_at=? WHERE id=?',
                        ('captured',payment_id,now(),row['id']))
            action = 'captured'
        con.execute('INSERT INTO payment_events (order_id,event_key,event_type,provider_payment_id,recorded_at) VALUES (?,?,?,?,?)',
                    (row['id'],'razorpay:'+x_razorpay_event_id,'payment.captured',payment_id,now()))
        con.commit()
    return {'accepted':True, 'action':action}
