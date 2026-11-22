"""VYRA payment foundations: Razorpay TEST orders and partner-gated UPI.

Never import this module as evidence of regulatory or production readiness.
No live key or live transfer support is implemented.
"""

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
from contextlib import closing
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

CATALOG = {
    "demo_pass": {"label": "VYRA sandbox experience", "amount_paise": 4900},
    "demo_support": {"label": "VYRA sandbox supporter", "amount_paise": 9900},
}


def test_credentials():
    enabled = os.environ.get("VYRA_RAZORPAY_TEST_ENABLED") == "1"
    key_id = os.environ.get("VYRA_RAZORPAY_TEST_KEY_ID", "")
    secret = os.environ.get("VYRA_RAZORPAY_TEST_KEY_SECRET", "")
    webhook = os.environ.get("VYRA_RAZORPAY_TEST_WEBHOOK_SECRET", "")
    return enabled and key_id.startswith("rzp_test_") and bool(secret) and bool(webhook)


def create_razorpay_test_order(key_id: str, secret: str, amount_paise: int, receipt: str):
    """Only calls Razorpay's documented TEST Orders API (keys must be rzp_test_)."""
    if not key_id.startswith("rzp_test_"):
        raise ValueError("Live-mode Razorpay keys are forbidden in VYRA foundation")
    payload = json.dumps({"amount": amount_paise, "currency": "INR", "receipt": receipt}).encode()
    auth = base64.b64encode(f"{key_id}:{secret}".encode()).decode()
    request = UrlRequest(
        "https://api.razorpay.com/v1/orders", data=payload, method="POST",
        headers={"Authorization": f"Basic {auth}", "Content-Type": "application/json"},
    )
    try:
        with urlopen(request, timeout=10) as resp:
            result = json.load(resp)
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError("Payment test provider unavailable; check test credentials") from exc
    if (not isinstance(result, dict) or not str(result.get("id", "")).startswith("order_")
            or result.get("amount") != amount_paise or result.get("currency") != "INR"):
        raise RuntimeError("Unexpected response from payment test provider")
    return result["id"]


class OrderRequest(BaseModel):
    sku: str = Field(pattern="^(demo_pass|demo_support)$")
    idempotency_key: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


def build_payment_router(connect, current_user, provider_create=None):
    """Dependency-injected for isolated tests; uses VYRA's existing SQLite DB."""
    router = APIRouter(prefix="/payments", tags=["Payment foundation (test only)"])
    create_order = provider_create or create_razorpay_test_order
    with closing(connect()) as db:
        with db:
            db.execute("""CREATE TABLE IF NOT EXISTS payment_test_orders (
                id TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
                idempotency_key TEXT NOT NULL, sku TEXT NOT NULL,
                amount_paise INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'INR',
                provider_order_id TEXT UNIQUE, status TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                payment_id TEXT,
                UNIQUE(user_id, idempotency_key)
            )""")
            db.execute("""CREATE TABLE IF NOT EXISTS payment_test_events (
                event_id TEXT PRIMARY KEY, order_id TEXT NOT NULL,
                event_type TEXT NOT NULL, received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )""")
    lock = threading.Lock()
    rate: dict[int, list[float]] = {}

    def view(row):
        return {
            "id": row["id"], "sku": row["sku"], "amount_paise": row["amount_paise"],
            "currency": row["currency"], "provider_order_id": row["provider_order_id"],
            "status": row["status"], "mode": "RAZORPAY_TEST_ONLY",
        }

    @router.get("/capabilities")
    def capabilities(user=Depends(current_user)):
        _ = user
        return {
            "merchant": {"provider": "razorpay", "mode": "TEST_ONLY", "configured": bool(test_credentials()),
                         "catalog": [{"sku": k, **v} for k, v in CATALOG.items()]},
            "p2p_upi": {"status": "PARTNERSHIP_REQUIRED", "transfers_enabled": False,
                        "reason": "Requires a sponsoring PSP bank and relevant NPCI approval"},
            "live_payments_enabled": False,
        }

    @router.post("/merchant/orders", status_code=201)
    def merchant_order(body: OrderRequest, user=Depends(current_user)):
        if not test_credentials():
            raise HTTPException(503, "Razorpay test keys and test webhook secret not configured")
        user_id = int(user["id"])
        item = CATALOG[body.sku]
        with closing(connect()) as db:
            row = db.execute("SELECT * FROM payment_test_orders WHERE user_id=? AND idempotency_key=?",
                             (user_id, body.idempotency_key)).fetchone()
            if row:
                if row["sku"] != body.sku:
                    raise HTTPException(409, "Idempotency key already used for a different item")
                return view(row)
        now = time.monotonic()
        with lock:
            attempts = [t for t in rate.get(user_id, []) if now - t < 60]
            if len(attempts) >= 10:
                raise HTTPException(429, "Too many test orders, retry shortly")
            attempts.append(now)
            rate[user_id] = attempts
        order_id = "vtest_" + secrets.token_hex(12)
        with closing(connect()) as db:
            try:
                with db:
                    db.execute("""INSERT INTO payment_test_orders
                        (id,user_id,idempotency_key,sku,amount_paise,currency,status)
                        VALUES (?,?,?,?,?,'INR','creating')""",
                        (order_id, user_id, body.idempotency_key, body.sku, item["amount_paise"]))
            except sqlite3.IntegrityError:
                row = db.execute("SELECT * FROM payment_test_orders WHERE user_id=? AND idempotency_key=?",
                                 (user_id, body.idempotency_key)).fetchone()
                if row and row["sku"] == body.sku:
                    return view(row)
                raise HTTPException(409, "Idempotency key collision")
        try:
            remote_id = create_order(os.environ["VYRA_RAZORPAY_TEST_KEY_ID"],
                                     os.environ["VYRA_RAZORPAY_TEST_KEY_SECRET"],
                                     item["amount_paise"], order_id)
        except (RuntimeError, ValueError, KeyError) as exc:
            # Retain the unique key; the provider might have accepted the request.
            with closing(connect()) as db:
                with db:
                    db.execute("UPDATE payment_test_orders SET status='provider_unknown' WHERE id=?", (order_id,))
            raise HTTPException(502, "Test provider order creation unconfirmed; do not retry with another key until reviewed") from exc
        with closing(connect()) as db:
            with db:
                db.execute("""UPDATE payment_test_orders SET provider_order_id=?, status='created',
                        updated_at=CURRENT_TIMESTAMP WHERE id=?""", (remote_id, order_id))
            row = db.execute("SELECT * FROM payment_test_orders WHERE id=?", (order_id,)).fetchone()
        return view(row)

    @router.get("/merchant/orders/{order_id}")
    def get_order(order_id: str, user=Depends(current_user)):
        with closing(connect()) as db:
            row = db.execute("SELECT * FROM payment_test_orders WHERE id=? AND user_id=?",
                             (order_id, int(user["id"]))).fetchone()
        if row is None:
            raise HTTPException(404, "Test order not found")
        return view(row)

    @router.post("/merchant/webhook")
    async def test_webhook(request: Request):
        # This is a TEST-only inbound webhook. Do not expose to live payments.
        secret = os.environ.get("VYRA_RAZORPAY_TEST_WEBHOOK_SECRET", "")
        if not test_credentials():
            raise HTTPException(503, "Test webhook unavailable")
        raw = await request.body()
        if len(raw) > 128 * 1024:
            raise HTTPException(413, "Webhook payload too large")
        sent = request.headers.get("X-Razorpay-Signature", "")
        expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sent, expected):
            raise HTTPException(401, "Invalid webhook signature")
        event_id = request.headers.get("x-razorpay-event-id", "")
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", event_id):
            raise HTTPException(400, "Missing valid provider event id")
        try:
            data = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            raise HTTPException(400, "Invalid JSON")
        if not isinstance(data, dict):
            raise HTTPException(400, "Invalid event")
        if data.get("event") != "payment.captured":
            return {"received": True}
        payment = (((data.get("payload") or {}).get("payment") or {}).get("entity") or {})
        if not isinstance(payment, dict):
            raise HTTPException(400, "Invalid payment payload")
        provider_order = payment.get("order_id")
        payment_id = payment.get("id")
        if not (isinstance(provider_order, str) and isinstance(payment_id, str)
                and payment_id.startswith("pay_") and payment.get("status") == "captured"
                and type(payment.get("amount")) is int and payment.get("currency") == "INR"):
            raise HTTPException(400, "Invalid captured payment")
        with closing(connect()) as db:
            with db:
                row = db.execute("SELECT * FROM payment_test_orders WHERE provider_order_id=?",
                                 (provider_order,)).fetchone()
                if row is None or row["amount_paise"] != payment["amount"]:
                    return {"received": True}
                if db.execute("SELECT 1 FROM payment_test_events WHERE event_id=?", (event_id,)).fetchone():
                    return {"received": True}
                db.execute("INSERT INTO payment_test_events(event_id,order_id,event_type) VALUES (?,?,?)",
                           (event_id, row["id"], "payment.captured"))
                db.execute("""UPDATE payment_test_orders SET status='captured_test', payment_id=?,
                             updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='created'""",
                           (payment_id, row["id"]))
        return {"received": True}

    @router.post("/upi/send")
    def p2p_send_blocked(user=Depends(current_user)):
        _ = user
        raise HTTPException(503, "UPI P2P transfers disabled: PSP bank partnership and NPCI approval required")

    return router