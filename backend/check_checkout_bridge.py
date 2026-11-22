"""Isolated unit checks; no user database or external provider requests."""
import hashlib
import hmac
import importlib.util
import tempfile
import unittest
from pathlib import Path
from fastapi import HTTPException

SPEC = importlib.util.spec_from_file_location('vyra_checkout_bridge', Path(__file__).with_name('vyra_checkout_bridge.py'))
b = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(b)

class CheckoutTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='vyra-core11-')
        b.DB_FILE = Path(self.temp.name) / 'test.sqlite3'
        b.settings = lambda: {'VYRA_CORE_ADMIN_KEY':'a'*40,
                              'VYRA_CORE_RZP_TEST_KEY_ID':'rzp_test_123456',
                              'VYRA_CORE_RZP_TEST_KEY_SECRET':'testsecret'}
        self.events = []
        def fake_core(method, path, body=None):
            if method == 'POST':
                self.events.append((method,path,body))
                return {'id':'vcore_testid', 'provider_order_id':'order_testid',
                        'sku':body['sku'],'amount_paise':19900,'currency':'INR', 'status':'created'}
            return {'id':'vcore_testid','provider_order_id':'order_testid', 'status':'created'}
        b.core_request = fake_core
        router = b.build_router(lambda: {'id':1})
        self.endpoints = {route.path: route.endpoint for route in router.routes}

    def tearDown(self): self.temp.cleanup()

    def test_catalog_configuration_does_not_expose_secret(self):
        x = self.endpoints['/merchant/test/config'](user={'id':1})
        self.assertTrue(x['ready'])
        self.assertNotIn('testsecret', str(x))

    def test_creating_order_uses_core_and_same_nonce_reuses(self):
        fn = self.endpoints['/merchant/test/orders']
        item = b.StartOrder(sku='vyra-test-pass',idempotency_key='uniqueorderkey1234')
        x = fn(body=item,user={'id':1})
        y = fn(body=item,user={'id':1})
        self.assertEqual(x['id'], y['id'])
        self.assertEqual(len(self.events),1)
        self.assertEqual(self.events[0][2]['sku'],'vyra-test-pass')
        self.assertNotEqual(self.events[0][2]['idempotency_key'],'uniqueorderkey1234')

    def test_user_cannot_read_another_users_order(self):
        self.endpoints['/merchant/test/orders'](body=b.StartOrder(sku='vyra-test-pass', idempotency_key='uniqueorderkey1234'),user={'id':1})
        with self.assertRaises(HTTPException) as caught:
            self.endpoints['/merchant/test/orders/{order_id}'](order_id='vcore_testid',user={'id':2})
        self.assertEqual(caught.exception.status_code,404)

    def test_signature_verification_does_not_claim_capture(self):
        self.endpoints['/merchant/test/orders'](body=b.StartOrder(sku='vyra-test-pass', idempotency_key='uniqueorderkey1234'),user={'id':1})
        sig = hmac.new(b'testsecret', b'order_testid|pay_testpayment', hashlib.sha256).hexdigest()
        result = self.endpoints['/merchant/test/verify'](body=b.VerifyCheckout(core_order_id='vcore_testid', razorpay_order_id='order_testid',razorpay_payment_id='pay_testpayment',razorpay_signature=sig),user={'id':1})
        self.assertTrue(result['signature_verified'])
        self.assertEqual(result['status'],'created')
        with self.assertRaises(HTTPException) as caught:
            self.endpoints['/merchant/test/verify'](body=b.VerifyCheckout(core_order_id='vcore_testid',razorpay_order_id='order_testid',razorpay_payment_id='pay_testpayment',razorpay_signature='0'*64),user={'id':1})
        self.assertEqual(caught.exception.status_code,401)

    def test_bogus_product_rejected_without_core_call(self):
        with self.assertRaises(HTTPException) as caught:
            self.endpoints['/merchant/test/orders'](body=b.StartOrder(sku='badproduct', idempotency_key='uniqueorderkey1234'),user={'id':1})
        self.assertEqual(caught.exception.status_code,422)
        self.assertEqual(len(self.events),0)

if __name__ == '__main__': unittest.main(verbosity=2)
