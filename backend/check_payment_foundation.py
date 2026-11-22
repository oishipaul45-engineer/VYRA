"""Isolated VYRA payment foundation tests. No real providers, money or account data."""
import hashlib
import hmac
import json
import os
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI, Header
import asyncio
from dataclasses import dataclass
from payment_foundation import build_payment_router, test_credentials


@dataclass
class Response:
    status_code: int
    text: str
    def json(self):
        return json.loads(self.text)

class ASGIClient:
    """Tiny standard-library HTTP test harness; avoids optional httpx dependency."""
    def __init__(self, app):
        self.app = app
    def __enter__(self):
        return self
    def __exit__(self, *_):
        return False
    def get(self, path, headers=None):
        return self._call('GET', path, None, headers)
    def post(self, path, json=None, data=None, headers=None):
        body = (globals()['json'].dumps(json).encode() if json is not None else data or b'')
        headers = dict(headers or {})
        if json is not None: headers['Content-Type'] = 'application/json'
        return self._call('POST', path, body, headers)
    def _call(self, method, path, body, headers):
        async def exercise():
            messages = []
            sent = False
            async def receive():
                nonlocal sent
                if not sent:
                    sent = True
                    return {'type':'http.request','body':body or b'','more_body':False}
                return {'type':'http.disconnect'}
            async def send(message):
                messages.append(message)
            scope = {'type':'http','asgi':{'version':'3.0'},'http_version':'1.1',
                     'method':method,'path':path,'raw_path':path.encode(),'query_string':b'',
                     'scheme':'http','root_path':'','client':('127.0.0.1',1234),'server':('test',80),
                     'headers':[(k.lower().encode(),v.encode()) for k,v in (headers or {}).items()]}
            await self.app(scope, receive, send)
            status = next(m['status'] for m in messages if m['type']=='http.response.start')
            content = b''.join(m.get('body', b'') for m in messages if m['type']=='http.response.body')
            return Response(status, content.decode())
        return asyncio.run(exercise())


def run():
    with tempfile.TemporaryDirectory(prefix="vyra-pay-test-") as dirname:
        db_path = Path(dirname) / "payments.sqlite3"
        def connect():
            db = sqlite3.connect(db_path, timeout=5)
            db.row_factory = sqlite3.Row
            return db
        def fake_user(x_test_user: int = Header(default=1)):
            return {"id": x_test_user}
        requests = []
        def fake_provider(key, secret, amount, receipt):
            assert key == "rzp_test_local_mock" and secret == "test-only-secret"
            requests.append((amount, receipt))
            return "order_mock_" + str(len(requests))
        env = {
            "VYRA_RAZORPAY_TEST_ENABLED": "1",
            "VYRA_RAZORPAY_TEST_KEY_ID": "rzp_test_local_mock",
            "VYRA_RAZORPAY_TEST_KEY_SECRET": "test-only-secret",
            "VYRA_RAZORPAY_TEST_WEBHOOK_SECRET": "test-only-webhook",
        }
        with patch.dict(os.environ, env):
            assert test_credentials()
            app = FastAPI()
            app.include_router(build_payment_router(connect, fake_user, provider_create=fake_provider))
            with ASGIClient(app) as client:
                capabilities = client.get("/payments/capabilities")
                assert capabilities.status_code == 200
                assert capabilities.json()["p2p_upi"]["transfers_enabled"] is False
                assert capabilities.json()["live_payments_enabled"] is False
                print("PASS: merchant TEST only, P2P explicitly disabled")
                payload = {"sku": "demo_pass", "idempotency_key": "request-one-123"}
                res = client.post("/payments/merchant/orders", json=payload)
                assert res.status_code == 201, res.text
                order = res.json()
                assert order["amount_paise"] == 4900 and order["status"] == "created"
                assert len(requests) == 1
                again = client.post("/payments/merchant/orders", json=payload)
                assert again.status_code == 201 and again.json()["id"] == order["id"]
                assert len(requests) == 1
                conflict = client.post("/payments/merchant/orders", json={"sku":"demo_support", "idempotency_key":"request-one-123"})
                assert conflict.status_code == 409
                print("PASS: server-controlled amount, idempotency, conflict protection")
                assert client.get("/payments/merchant/orders/" + order["id"], headers={"x-test-user":"2"}).status_code == 404
                assert client.get("/payments/merchant/orders/" + order["id"]).status_code == 200
                assert client.post("/payments/upi/send").status_code == 503
                print("PASS: account isolation and blocked P2P transfer")
                body = {"event": "payment.captured", "payload": {"payment": {"entity": {
                    "id":"pay_mock_1", "order_id":order["provider_order_id"], "amount":4900,
                    "currency":"INR", "status":"captured"
                }}}}
                raw = json.dumps(body).encode()
                sig = hmac.new(b"test-only-webhook", raw, hashlib.sha256).hexdigest()
                headers={"X-Razorpay-Signature":sig,"x-razorpay-event-id":"event_001"}
                assert client.post("/payments/merchant/webhook", data=raw, headers={"X-Razorpay-Signature":"wrong", "x-razorpay-event-id":"event_001"}).status_code == 401
                assert client.get("/payments/merchant/orders/" + order["id"]).json()["status"] == "created"
                assert client.post("/payments/merchant/webhook", data=raw, headers=headers).status_code == 200
                assert client.get("/payments/merchant/orders/" + order["id"]).json()["status"] == "captured_test"
                assert client.post("/payments/merchant/webhook", data=raw, headers=headers).status_code == 200
                with closing(connect()) as db:
                    assert db.execute("SELECT count(*) FROM payment_test_events").fetchone()[0] == 1
                print("PASS: verified raw-body HMAC, duplicate event ignored, TEST capture recorded")
                # Distinct order; a valid signed event with an incorrect amount cannot affect it.
                second = client.post("/payments/merchant/orders", json={"sku":"demo_support","idempotency_key":"request-two-123"}).json()
                invalid = {"event":"payment.captured", "payload":{"payment":{"entity":{
                    "id":"pay_mock_2", "order_id":second["provider_order_id"], "amount":1,
                    "currency":"INR", "status":"captured"}}}}
                wire = json.dumps(invalid).encode()
                headers_bad={"X-Razorpay-Signature":hmac.new(b"test-only-webhook",wire,hashlib.sha256).hexdigest(), "x-razorpay-event-id":"event_002"}
                assert client.post("/payments/merchant/webhook", data=wire, headers=headers_bad).status_code == 200
                assert client.get("/payments/merchant/orders/" + second["id"]).json()["status"] == "created"
                print("PASS: mismatched payment amount rejected")
    print("SUCCESS: all isolated payment foundation tests passed; no live payment attempted")

if __name__ == "__main__":
    run()