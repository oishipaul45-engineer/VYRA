"""VYRA read-only HTTP smoke tests (no accounts or financial data changed)."""
import os
import sys
import urllib.error
import urllib.request

base = os.environ.get("VYRA_TEST_API", "http://127.0.0.1:8001").rstrip("/")
origin = os.environ.get("VYRA_TEST_ORIGIN", "http://localhost:5178")

def request(path, method="GET", headers=None):
    req = urllib.request.Request(base + path, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status, response.headers
    except urllib.error.HTTPError as err:
        return err.code, err.headers

try:
    status, headers = request("/health")
    assert status == 200, f"health returned {status}"
    print("PASS: backend health")

    status, headers = request("/auth/login", method="OPTIONS", headers={
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert status == 200 and headers.get("Access-Control-Allow-Origin") == origin, (
        f"CORS failed: status={status}, origin={headers.get('Access-Control-Allow-Origin')}"
    )
    print("PASS: browser CORS preflight")

    status, headers = request("/workspace/me")
    assert status in (401, 403), f"workspace anonymous access returned {status}"
    assert headers.get("Cache-Control") == "no-store", "account cache policy missing"
    assert headers.get("X-Content-Type-Options") == "nosniff", "security header missing"
    print("PASS: anonymous workspace blocked and security headers applied")

    print("PASS: read-only smoke tests completed")
except Exception as e:
    print("FAIL:", e)
    print("Make sure the UPDATED backend is running; restart port 8001 first.")
    sys.exit(1)