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
- GET /api/admin/provider/status (admin only; read-only Alibaba Cloud connectivity and instance inventory check)
- POST /api/devices (still disabled until instance assignment and remote-session delivery are implemented)

## Important
- This starter uses SQLite; use persistent disk storage in production.
- Put the API behind HTTPS and configure rate limiting, backups, monitoring, and account recovery before public launch.
- The admin allowlist must be set on the server. Never grant admin from frontend/localStorage.
- Plan grants are manual; no real payment gateway or webhook is connected.
- The official Alibaba Cloud EDS-AIC Node.js SDK is included. Configure `ALIBABA_CLOUD_ACCESS_KEY_ID`, `ALIBABA_CLOUD_ACCESS_KEY_SECRET`, and `ALIBABA_CLOUD_REGION` as hosting secrets to enable the admin-only read-only provider check. `ALIBABA_CLOUD_ENDPOINT` is an optional endpoint override.
- Use a dedicated RAM user with least-privilege permissions. Never use root-account keys or put credentials in GitHub, browser code, screenshots, or chat.
- The provider adapter currently only lists existing cloud-phone instances. It does not purchase, create, assign, start, or stop devices.
- Customer provisioning, connection-ticket/session delivery, browser streaming/touch input, Google Play/GMS compatibility tests, payment webhooks, and production hardening are not implemented. Do not advertise the service as live yet.
- Do not put secrets in frontend code or commit a real `.env`.


## Serve the website and API together
Deploy the repository with the service working directory set to `cloud-api` and build command `npm install`, start command `npm start`. The API serves the repository-root `index.html` at `/`, so browser requests to `/api/*` use the same origin. Use a host with a persistent disk and mount it where `DB_PATH` points (for example `./cloudphone.sqlite`); otherwise SQLite data may be lost on redeploy/restart.

## First admin bootstrap
1. Open the deployed site and register your own account.
2. Copy the account ID shown after login (or from the account panel).
3. In the hosting service's environment settings, set `ADMIN_USER_IDS` to that exact ID, then redeploy/restart.
4. Log out and log in again. The server will now identify that account as admin.
Never put admin IDs, secrets, or provider credentials in frontend JavaScript.

The site is not live until this API is deployed with its environment variables and persistent storage. GitHub Pages alone cannot run this Node API.
