# VYRA controlled beta on Railway (one service)

This deployment serves the original 3D React frontend and existing FastAPI account API on the same HTTPS domain. **No real payments.** Payment Core / merchant endpoints are intentionally absent in `VYRA_PUBLIC_BETA=1` mode.

## Source safety
- Do not upload `backend/.env`, any SQLite DB, or payment Core admin keys.
- A fresh Railway database starts empty. Local users/data stay on your PC.
- Beta signups are restricted by `VYRA_ALLOWED_SIGNUP_EMAILS`.
- This is a **small, controlled beta**, not a public signup production launch.

## Railway setup
1. Run `prepare-vyra-railway-beta.ps1` locally and verify the frontend build.
2. Review `git diff`, stage **only** `Dockerfile.railway`, `.dockerignore`, `backend/requirements.railway.txt`, `DEPLOY_RAILWAY_BETA.md`, `src/App.tsx`, `backend/app.py`, `src/components/AuthGate.tsx`, `src/hooks/useWorkspace.ts`, and `src/components/PaymentsSandbox.tsx`; commit/push to the existing VYRA repo.
3. In Railway, New Project -> Deploy from GitHub repo -> select `oishipaul45-engineer/VYRA` and branch `main`. Root directory `/`.
4. Service Variables: `RAILWAY_DOCKERFILE_PATH=Dockerfile.railway`, `VYRA_PUBLIC_BETA=1`, `VYRA_DB_PATH=/data/vyra_users.sqlite3`, `VYRA_ALLOWED_SIGNUP_EMAILS=your-own-email@example.com`, `VYRA_JWT_SECRET=<unique 48+ character random secret>`; leave Razorpay/Core payment secrets UNSET.
5. Attach a **persistent volume** mounted to `/data` on the same service BEFORE allowing accounts. Use only **one replica** for the SQLite-backed beta. Confirm costs/limits on Railway.
6. Generate a Railway public domain for this service. It will expose both the website `/` and API `/health` on HTTPS. Set Healthcheck path `/health`. `PORT` is supplied by Railway.
7. Open `https://<your-domain>/health` then home page, signup with allowlisted email, create a simulated Vault update, refresh and test persistence.
8. Check your app's OpenAPI schema: `/payments/` and `/merchant/test/` payment routes must NOT exist in public beta.

## Limitations before broad public launch
- SQLite on a persistent volume is suitable for a tiny single-replica invite beta, not scalable/high-availability payments.
- Current authentication and process-local rate limiting are NOT production-grade. No account recovery or independent pen test.
- No real-person P2P transfers or live merchant collection, no payout/custody.
- Backend still stores simulated workspace data only.
- For a wide beta, add shared rate limiting, additional email verification, monitoring, backups, and PostgreSQL with migration.