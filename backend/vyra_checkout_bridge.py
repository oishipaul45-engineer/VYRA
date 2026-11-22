"""VYRA Core 1.1: local sandbox checkout proxy. Not for production deployment."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sqlite3
from contextlib import contextmanager
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable

from dotenv import dotenv_values
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

BASE = Path(__file__).resolve().parent
CORE_DIR = BASE.parent / 'vyra-core'
CORE_ENV = CORE_DIR / '.env'
DB_FILE = BASE / 'vyra_checkout_test.sqlite3'
CORE_URL = 'http://127.0.0.1:8002'


def settings():
    # Read local Core secrets at request time. Never expose to the browser.
    vals = dotenv_values(CORE_ENV) if CORE_ENV.is_file() else {}
    return {key: vals.get(key, '') or '' for key in (
        'VYRA_CORE_ADMIN_KEY', 'VYRA_CORE_RZP_TEST_KEY_ID',
        'VYRA_CORE_RZP_TEST_KEY_SECRET')}


@contextmanager
def connect():
    db = sqlite3.connect(DB_FILE, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA busy_timeout=15000')
    try:
        yield db
        db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    with connect() as db:
        db.execute('''CREATE TABLE IF NOT EXISTS test_checkouts (
            user_id INTEGER NOT NULL,
            idempotency_key TEXT NOT NULL,
            core_order_id TEXT NOT NULL UNIQUE,
            provider_order_id TEXT NOT NULL UNIQUE,
            sku TEXT NOT NULL,
            amount_paise INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(user_id, idempotency_key)
        )''')


def core_request(method: str, path: str, body=None):
    cfg = settings()
    if not cfg['VYRA_CORE_ADMIN_KEY']:
        raise HTTPException(503, 'VYRA Core is not configured')
    req = urllib.request.Request(
        CORE_URL + path, method=method,
        headers={'X-Vyra-Core-Key': cfg['VYRA_CORE_ADMIN_KEY'], 'Content-Type': 'application/json'},
        data=json.dumps(body).encode('utf-8') if body is not None else None,
    )
    try:
        with urllib.request.urlopen(req, timeout=14) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        if exc.code in (409, 422, 503):
            raise HTTPException(exc.code, 'Core rejected the test order') from exc
        raise HTTPException(502, 'VYRA Core returned an error') from exc
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise HTTPException(503, 'VYRA Core is offline. Start it on port 8002.') from exc


class StartOrder(BaseModel):
    sku: str = Field(min_length=1, max_length=50)
    idempotency_key: str = Field(min_length=12, max_length=64, pattern=r'^[a-zA-Z0-9_-]+$')


class VerifyCheckout(BaseModel):
    core_order_id: str = Field(min_length=1, max_length=100)
    razorpay_order_id: str = Field(min_length=1, max_length=100)
    razorpay_payment_id: str = Field(min_length=1, max_length=100)
    razorpay_signature: str = Field(pattern=r'^[a-fA-F0-9]{64}$')


def checkout_valid(order_id: str, payment_id: str, signature: str, secret: str) -> bool:
    digest = hmac.new(secret.encode('utf-8'), (order_id + '|' + payment_id).encode('utf-8'), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature.lower())


def build_router(current_user: Callable):
    router = APIRouter(prefix='/merchant/test', tags=['Merchant Sandbox'])
    init_db()

    def owned(user_id: int, order_id: str):
        with connect() as db:
            row = db.execute('SELECT * FROM test_checkouts WHERE user_id=? AND core_order_id=?',
                             (user_id, order_id)).fetchone()
        if row is None:
            raise HTTPException(404, 'Test order not found')
        return row

    @router.get('/config')
    def config(user=Depends(current_user)):
        cfg = settings()
        key = cfg['VYRA_CORE_RZP_TEST_KEY_ID']
        ready = bool(key.startswith('rzp_test_') and cfg['VYRA_CORE_RZP_TEST_KEY_SECRET'] and cfg['VYRA_CORE_ADMIN_KEY'])
        return {'ready': ready, 'mode': 'test-only', 'public_key': key if ready else '',
                'catalog': [
                    {'sku':'vyra-test-pass','label':'VYRA Test Pass', 'amount_paise':19900},
                    {'sku':'vyra-test-bundle','label':'VYRA Test Bundle', 'amount_paise':49900}
                ]}

    @router.post('/orders', status_code=201)
    def start(body: StartOrder, user=Depends(current_user)):
        if not settings()['VYRA_CORE_RZP_TEST_KEY_ID'].startswith('rzp_test_'):
            raise HTTPException(503, 'Configure Razorpay TEST credentials in vyra-core/.env')
        if body.sku not in ('vyra-test-pass', 'vyra-test-bundle'):
            raise HTTPException(422, 'Unknown sandbox product')
        with connect() as db:
            old = db.execute('SELECT * FROM test_checkouts WHERE user_id=? AND idempotency_key=?',
                             (user['id'], body.idempotency_key)).fetchone()
        if old:
            if old['sku'] != body.sku:
                raise HTTPException(409, 'Idempotency key used for another product')
            return {'id':old['core_order_id'], 'provider_order_id':old['provider_order_id'],
                    'sku':old['sku'], 'amount_paise':old['amount_paise'], 'currency':'INR'}
        # Protect the provider sandbox from excessive accidental order creation.
        with connect() as db:
            recent = db.execute("SELECT COUNT(*) FROM test_checkouts WHERE user_id=? AND created_at >= datetime('now','-10 minutes')",
                                (user['id'],)).fetchone()[0]
        if recent >= 5:
            raise HTTPException(429, 'Sandbox limit reached: maximum five orders per ten minutes')
        # Namespace core idempotency to the authenticated user; no user IDs exposed in the provider reference.
        core_key = hashlib.sha256(f'{user["id"]}:{body.idempotency_key}'.encode()).hexdigest()[:48]
        order = core_request('POST', '/core/orders', {'sku':body.sku, 'idempotency_key':core_key})
        try:
            with connect() as db:
                db.execute('''INSERT INTO test_checkouts
                    (user_id,idempotency_key,core_order_id,provider_order_id,sku,amount_paise)
                    VALUES (?,?,?,?,?,?)''',
                    (user['id'], body.idempotency_key, order['id'], order['provider_order_id'],
                     body.sku, order['amount_paise']))
        except sqlite3.IntegrityError:
            # Retry may race; return only the current user's same product order.
            with connect() as db:
                previous = db.execute('SELECT * FROM test_checkouts WHERE user_id=? AND idempotency_key=?',
                                      (user['id'], body.idempotency_key)).fetchone()
            if not previous or previous['sku'] != body.sku:
                raise HTTPException(409, 'Order conflict. Check order status before retrying.')
            return {'id':previous['core_order_id'], 'provider_order_id':previous['provider_order_id'],
                    'sku':previous['sku'], 'amount_paise':previous['amount_paise'], 'currency':'INR'}
        return order

    @router.post('/verify')
    def verify(body: VerifyCheckout, user=Depends(current_user)):
        row = owned(user['id'], body.core_order_id)
        if row['provider_order_id'] != body.razorpay_order_id:
            raise HTTPException(409, 'Checkout order reference mismatch')
        secret = settings()['VYRA_CORE_RZP_TEST_KEY_SECRET']
        if not secret or not settings()['VYRA_CORE_RZP_TEST_KEY_ID'].startswith('rzp_test_'):
            raise HTTPException(503, 'Razorpay TEST credentials are not configured')
        if not checkout_valid(body.razorpay_order_id, body.razorpay_payment_id,
                              body.razorpay_signature, secret):
            raise HTTPException(401, 'Invalid checkout signature')
        # Signature alone is not capture/settlement proof. Only Core's verified webhook changes order status.
        result = core_request('GET', '/core/orders/' + body.core_order_id)
        if result['provider_order_id'] != body.razorpay_order_id:
            raise HTTPException(409, 'Core order reference mismatch')
        return {'signature_verified':True, 'status':result['status'],
                'message': 'Awaiting signed provider capture webhook' if result['status'] != 'captured' else 'Provider capture confirmed'}

    @router.get('/orders/{order_id}')
    def status(order_id: str, user=Depends(current_user)):
        row = owned(user['id'], order_id)
        result = core_request('GET', '/core/orders/' + order_id)
        return {'id':result['id'], 'status':result['status'],
                'amount_paise':row['amount_paise'], 'sku':row['sku'], 'currency':'INR'}

    return router
