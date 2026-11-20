# LONG GIA HUY Cloud Phone API (starter)

Node.js API for account registration/login, server-side roles, rental expiry,
admin assignment of an existing Alibaba Cloud Phone instance, and short-lived
connection-ticket delivery.

## Run locally
1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and set a random `SESSION_SECRET` (at least 32 characters).
3. Set `ADMIN_USER_IDS` only after creating the admin account and confirming its user ID.
4. Run `npm install`, then `npm start`.
5. Run `npm test` to execute the offline provider safety tests.
6. API listens on port 3000 by default.

## Tests

`npm test` runs offline tests confirming that provider inventory and ticket calls fail closed when Alibaba credentials are absent. These tests do not contact Alibaba Cloud or create billable resources. GitHub Actions runs the same checks on pushes and pull requests.

## Endpoints
- GET `/api/health`
- GET `/api/plans`
- POST `/api/register` { username, password }
- POST `/api/login` { username, password }
- GET `/api/me` (Bearer token)
- POST `/api/admin/grant-plan` { userId, days } (admin only; days 1,2,3,7,30)
- GET `/api/admin/overview` (admin only)
- GET `/api/admin/provider/status` (admin-only read-only provider inventory check)
- GET `/api/devices` (current user's device assignment)
- POST `/api/admin/assign-device` { userId, instanceId } (admin only; assigns an already-purchased `acp-...` instance)
- POST `/api/devices/session` (checks subscription and assignment, then returns a short-lived Alibaba ticket)

## Alibaba Cloud configuration
Set `ALIBABA_CLOUD_ACCESS_KEY_ID`, `ALIBABA_CLOUD_ACCESS_KEY_SECRET`,
and `ALIBABA_CLOUD_REGION` as hosting secrets. `ALIBABA_CLOUD_ENDPOINT`
is optional. Use a dedicated RAM user with least-privilege permissions.
Never use root-account keys or put credentials in GitHub, browser code, screenshots,
or chat. The provider adapter only lists existing instances and retrieves tickets;
it does not purchase, create, start, stop, release, or scale cloud phones.

Ticket generation can be asynchronous. The adapter now polls
`BatchGetAcpConnectionTicket` using its `TaskId` for a bounded period and returns
the ticket only when Alibaba reports it ready.

## Basic API protections

The API applies general request throttling, stricter limits to login/registration,
and a separate limit to connection-ticket requests. These limits use the default
in-memory store and reset when the process restarts; configure a shared store
such as Redis before running multiple API replicas. SQLite foreign-key enforcement
is enabled. Ticket responses are marked private/no-store. Device assignment
checks that the instance ID appears in the configured Alibaba Cloud inventory.

## Serve the website and SDK
Deploy the repository with working directory `cloud-api`, build command
`npm install`, and start command `npm start`. Use persistent disk storage
for SQLite and HTTPS for all public traffic.

The root website is served from the repository-root `index.html`. Place the
official Alibaba Web SDK at repository-root `cloud-sdk/WuyingWebSDK.js` and
its required `cloud-sdk/sdk/` resource directory. The API serves only that
`cloud-sdk` directory at `/cloud-sdk/`; it does not expose the rest of the
repository. Obtain the SDK from Alibaba's official documentation/package and
follow its redistribution terms.

## First admin bootstrap
1. Open the deployed site and register your account.
2. Copy the account ID shown after registration/login.
3. Set `ADMIN_USER_IDS` to that exact ID in the hosting service's environment secrets.
4. Redeploy/restart, then log out and log in again.

## Not production-ready yet
No cloud phone has been purchased or assigned in a live Alibaba account.
Alibaba's auth-free ticket login may need to be enabled by support. Google Play,
GMS, TikTok, browser streaming, touch, clipboard, audio/video, and Android Chrome
compatibility still require real-device testing. Payment gateway/webhooks, distributed rate-limit storage for multi-instance deployments,
origin policy, audit logs, monitoring, backups, account recovery,
concurrency controls, expiry cleanup, and data-wiping policy must be completed
before a public paid launch. Do not advertise the service as live yet.
