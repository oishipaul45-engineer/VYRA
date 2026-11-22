"""VYRA Core isolated tests; no TestClient/httpx2 dependency, no external network.

All money amounts and events in this suite are synthetic. The actual Core API
runs separately and is not modified by these tests.
"""
import asyncio
import hashlib
import hmac
import json
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

_temp = tempfile.TemporaryDirectory(prefix='vyra-core-tests-')
os.environ['VYRA_CORE_DB'] = str(Path(_temp.name) / 'isolated.sqlite3')
os.environ['VYRA_CORE_ADMIN_KEY'] = 'test_admin_key_' + 'a' * 48
os.environ['VYRA_CORE_RZP_WEBHOOK_SECRET'] = 'local_test_secret_for_webhook'
os.environ.pop('VYRA_CORE_RZP_TEST_KEY_ID', None)
os.environ.pop('VYRA_CORE_RZP_TEST_KEY_SECRET', None)

import app as core
from fastapi import HTTPException
from starlette.requests import Request


def synthetic_request(body: bytes = b'') -> Request:
    scope = {
        'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1',
        'method': 'POST', 'scheme': 'http', 'path': '/core/webhooks/razorpay',
        'raw_path': b'/core/webhooks/razorpay', 'query_string': b'',
        'root_path': '', 'headers': [], 'client': ('127.0.0.1', 60000),
        'server': ('127.0.0.1', 8002),
    }
    sent = False

    async def receive():
        nonlocal sent
        if not sent:
            sent = True
            return {'type': 'http.request', 'body': body, 'more_body': False}
        return {'type': 'http.disconnect'}

    return Request(scope, receive)


class CoreTests(unittest.TestCase):
    def fake(self, amount, receipt):
        return {'id': 'order_' + receipt, 'amount': amount, 'currency': 'INR'}

    def test_catalog_and_auth(self):
        self.assertEqual(core.health()['mode'], 'test-only')
        request = synthetic_request()
        with self.assertRaises(HTTPException) as ctx:
            core.catalog(request, None)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn('vyra-test-pass', core.catalog(request, os.environ['VYRA_CORE_ADMIN_KEY']))

    def test_server_controls_amount_and_idempotency(self):
        key = 'unique-test-key-0001'
        result = core.create_order('vyra-test-pass', key, self.fake)
        self.assertEqual(result['amount_paise'], 19900)
        self.assertEqual(core.create_order('vyra-test-pass', key, self.fake)['id'], result['id'])
        with self.assertRaises(HTTPException) as ctx:
            core.create_order('vyra-test-bundle', key, self.fake)
        self.assertEqual(ctx.exception.status_code, 409)

    def test_reject_provider_amount(self):
        with self.assertRaises(HTTPException) as ctx:
            core.create_order('vyra-test-pass', 'unique-test-key-0002', lambda a, r: {
                'id': 'order_bad', 'amount': 1, 'currency': 'INR',
            })
        self.assertEqual(ctx.exception.status_code, 502)

    def sign(self, event):
        raw = json.dumps(event, separators=(',', ':')).encode()
        signature = hmac.new(os.environ['VYRA_CORE_RZP_WEBHOOK_SECRET'].encode(), raw, hashlib.sha256).hexdigest()
        return raw, signature

    def capture(self, order_id, amount=19900):
        return {'event': 'payment.captured', 'payload': {'payment': {'entity': {
            'id': 'pay_111', 'order_id': order_id, 'amount': amount,
            'currency': 'INR', 'status': 'captured',
        }}}}

    def invoke_webhook(self, raw, signature, event_id):
        return asyncio.run(core.webhook(synthetic_request(raw), signature, event_id))

    def test_webhook_replay_amount_and_append_only(self):
        order = core.create_order('vyra-test-pass', 'unique-test-key-0003', self.fake)
        raw, signature = self.sign(self.capture(order['provider_order_id']))
        with self.assertRaises(HTTPException) as ctx:
            self.invoke_webhook(raw, 'wrong', 'evt_1')
        self.assertEqual(ctx.exception.status_code, 401)

        wrong_raw, wrong_signature = self.sign(self.capture(order['provider_order_id'], amount=500))
        with self.assertRaises(HTTPException) as ctx:
            self.invoke_webhook(wrong_raw, wrong_signature, 'evt_2')
        self.assertEqual(ctx.exception.status_code, 409)

        self.assertEqual(self.invoke_webhook(raw, signature, 'evt_1')['action'], 'captured')
        self.assertEqual(self.invoke_webhook(raw, signature, 'evt_1')['action'], 'duplicate')
        with core.db_conn() as con:
            row = con.execute('SELECT * FROM orders WHERE id=?', (order['id'],)).fetchone()
            self.assertEqual(row['status'], 'captured')
            self.assertEqual(con.execute('SELECT count(*) FROM payment_events WHERE order_id=?', (order['id'],)).fetchone()[0], 2)
            with self.assertRaises(sqlite3.IntegrityError):
                con.execute('DELETE FROM payment_events WHERE order_id=?', (order['id'],))

    def test_live_keys_disabled(self):
        self.assertFalse(core.KEY_ID)
        self.assertEqual(core.health()['p2p_upi'], 'disabled_partner_required')


if __name__ == '__main__':
    try:
        result = unittest.main(exit=False, verbosity=2).result
        sys.exit(0 if result.wasSuccessful() else 1)
    finally:
        _temp.cleanup()
