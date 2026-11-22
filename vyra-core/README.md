# VYRA Core 1.0 — local merchant sandbox foundation

**Not a bank. No live payments, wallet or P2P transfers.** This is a separate test-only backend. The existing VYRA Experimental frontend (5178), API (8001) and user database are unchanged.

## Start

From project root after running installer:

```powershell
cd "$HOME\OneDrive\Desktop\VYRA-Experimental"
.\backend\.venv\Scripts\python.exe -m uvicorn app:app --app-dir vyra-core --host 127.0.0.1 --port 8002
```

Open http://127.0.0.1:8002/docs and GET `/core/health`.

## Merchant order testing

Edit `vyra-core/.env` **locally** with Razorpay **test** API key ID and secret, separately set the **test webhook** secret. Restart Core. Protect `.env` and `data/*.sqlite3` from Git. `POST /core/orders` and `GET /core/orders/{id}` need the generated `X-Vyra-Core-Key` header and are local-only. For order creation send `{"sku":"vyra-test-pass","idempotency_key":"random-unique-string-123"}`. Prices are fixed on the server in paise. Real Razorpay test calls require actual test credentials. Webhook verification uses raw bytes + HMAC-SHA256 + `X-Razorpay-Event-Id`. No frontend checkout is wired yet.

* Do not expose the admin key to browser JavaScript.
* Do not port-forward the local admin API or run publicly. A production architecture needs a separately authenticated backend-to-backend integration, stable durable event/outbox handling, provider reconciliation, monitoring, security assessment, and formal review.
* `payment_events` is an **append-only event journal**, not a double-entry accounting ledger. The Orders API call cannot guarantee idempotency against concurrent/ambiguous provider timeouts without provider-side reconciliation. This foundation does **not** solve that; it must be addressed before production.
* UPI P2P remains disabled pending PSP-bank/NPCI onboarding.

## Run tests

```powershell
.\backend\.venv\Scripts\python.exe .\vyra-core\tests.py
```

These run on a temporary SQLite DB; no real provider calls.
