# LONG GIA HUY Cloud Phone API (starter)

This is a secure-ish starter API for account registration/login, server-side roles,
subscription expiry, and admin plan grants. It does **not** create Android VMs yet.

## Run locally
1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and set a long random `SESSION_SECRET`.
3. Set `ADMIN_USER_IDS` only after creating the admin account and confirming its user ID.
4. Run `npm install`, then `npm start`.
5. API listens on port 3000 by default.

## Endpoints
- GET /api/health
- GET /api/plans
- POST /api/register { username, password }
- POST /api/login { username, password }
- GET /api/me (Bearer token)
- POST /api/admin/grant-plan { userId, days } (admin only; days 1,2,3,7,30)
- GET /api/admin/overview (admin only)
- POST /api/devices (returns an explicit not-configured response until a real provider adapter is added)

## Important
- This starter uses SQLite; use persistent disk storage in production.
- Put the API behind HTTPS and configure rate limiting, backups, monitoring, and account recovery before public launch.
- The admin allowlist must be set on the server. Never grant admin from frontend/localStorage.
- Plan grants are manual; no real payment gateway or webhook is connected.
- Android provisioning, streaming, touch input, Google Play/GMS licensing, and provider secrets are not implemented.
- Do not put secrets in frontend code or commit a real `.env`.
