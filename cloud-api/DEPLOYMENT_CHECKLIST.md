# LONG GIA HUY CLOUD PHONE — Production connection checklist

This repository now includes the account API, an Alibaba Cloud EDS-AIC SDK adapter, admin instance assignment, subscription-gated ticket issuance, and a Web SDK client integration point. It is not live until the external cloud resources and licensed SDK assets are configured.

## 1. Deploy the Node API

- Use Node.js 20+.
- Working directory: `cloud-api`.
- Build: `npm install`.
- Start: `npm start`.
- Attach persistent storage and set `DB_PATH` to a file on that disk.
- Serve over HTTPS.
- The API includes baseline in-memory rate limits for general API traffic, authentication, and ticket requests. Use a shared Redis-compatible rate-limit store before scaling to multiple replicas.
- Set `SESSION_SECRET` to a cryptographically random value of at least 32 characters.
- Initially leave `ADMIN_USER_IDS` empty. Register the owner's account, copy the account ID, set `ADMIN_USER_IDS` to that exact ID in hosting secrets, then restart and sign in again.

## 1A. Optional Docker deployment

- Build from the repository root: `docker build -f cloud-api/Dockerfile -t long-gia-huy-cloud-phone .`.
- Run with a persistent named volume mounted at `/data`; the image defaults to `DB_PATH=/data/cloudphone.sqlite`.
- Set `SESSION_SECRET` and the Alibaba credentials as runtime secrets/environment variables. Do not bake secrets into the image.
- Publish container port `3000` behind an HTTPS reverse proxy.
- Mount the licensed Alibaba SDK directory read-only at `/app/cloud-sdk` in the container. The Docker build intentionally excludes vendor SDK assets.
- The image runs as the unprivileged `node` user and includes a `/api/health` container health check.
- Back up the persistent database volume before upgrades. This container does not configure backups or a payment service.
## 1B. Docker Compose deployment

- Create a private deployment `.env` file from `cloud-api/.env.example`; set a unique `SESSION_SECRET` and the required Alibaba credentials. Never commit this file.
- Put the official, licensed Alibaba Web SDK files in the local `cloud-sdk/` folder, preserving vendor subdirectories. This folder is intentionally excluded from the image build and mounted read-only at runtime.
- From the repository root, run `docker compose up -d --build`.
- Check startup with `docker compose ps` and `docker compose logs -f cloud-phone-api`; verify `https://your-domain/api/health` through an HTTPS reverse proxy.
- Persistent SQLite data is stored in the named `cloudphone-data` volume. Back it up before replacing containers; do not delete the volume during routine updates.
- The Compose file publishes the API port directly. For public production use, put it behind HTTPS and restrict direct network access to the container port.
## 2. Configure Alibaba Cloud credentials safely

- Create/verify the Alibaba Cloud account and complete billing setup.
- Create a dedicated RAM user and AccessKey for server API access. Do not use root-account AccessKeys.
- Grant only the EDS-AIC read/connection permissions needed by the adapter. Expand permissions only after reviewing exact API RAM authorization requirements.
- Set these hosting secrets: `ALIBABA_CLOUD_ACCESS_KEY_ID`, `ALIBABA_CLOUD_ACCESS_KEY_SECRET`, `ALIBABA_CLOUD_REGION=ap-southeast-1`.
- Optional: set `ALIBABA_CLOUD_ENDPOINT` only if the official endpoint for the chosen region differs.
- Never commit secrets, paste them into chat, or expose them in browser JavaScript.

## 3. Purchase and assign the first cloud phone

- In the Alibaba Cloud console, create and pay for one Cloud Phone instance group in Singapore. This is a billable action and must be performed by the account owner.
- Enable authorization-free ticket login for the Alibaba Cloud account. Alibaba's integration guide says this feature must be enabled by submitting a support ticket and providing the account UID.
- Wait until the instance is in a connectable/running state.
- Sign into LONG GIA HUY as admin. Use the provider status button to verify API connectivity and list existing instances.
- Assign the existing `acp-...` instance ID to a registered customer using the admin assignment panel. Assignment in this app does not create or purchase resources.

## 4. Install Alibaba's licensed Web SDK assets

- Download the official Cloud Phone Web SDK package and demo from the Alibaba Cloud documentation page: https://www.alibabacloud.com/help/en/ecp/web-sdk-of-cloudphone
- Follow the SDK license and distribution terms. Do not copy the vendor SDK into this public repository or redistribute it without Alibaba Cloud's permission.
- In the deployed web app's static asset root, create `/cloud-sdk/` and place the official `WuyingWebSDK.js` there. Preserve the vendor's required `sdk/ASP/` resource directory and relative paths.
- The website loads `/cloud-sdk/WuyingWebSDK.js` and expects `window.Wuying.WebSDK` to be available.
- The account page includes a system health panel. It refreshes when manually requested, when the browser tab becomes visible, and every 30 seconds while visible. The panel can check `/api/health`; signed-in admins can also run the read-only provider inventory check. A successful API health response or configured AccessKey does not prove that a cloud phone instance is running or that a Web SDK session can connect.

## 5. Customer connection flow

- Customer registers and signs in.
- Admin grants one of the 1, 2, 3, 7, or 30 day plans and assigns an already-purchased instance.
- Customer presses Connect. The API checks the subscription expiry and assignment, then calls `BatchGetAcpConnectionTicket` with the customer's stable internal user ID.
- The provider ticket response must include both `appInstanceId` (the `ai-...` runtime instance ID) and `persistentAppInstanceId` (the persistent app resource ID). The browser passes the ticket as `userInfo.ticket`, sets `appInfo.appId` to `persistentAppInstanceId`, sets `appInfo.appInstanceId` to `appInstanceId`, includes `regionId`, then starts `Wuying.WebSDK.createSession('appstream', ...)`.
- After the SDK fires `onConnected`, the client calls `session.setClipboardEnabled(true)`. This enables the SDK clipboard channel; actual copy/paste behavior still needs verification against a provisioned cloud phone and the vendor SDK assets.
- The ticket is returned only to the authenticated customer and is never stored in the database.

## 6. Important launch checks

- Alibaba authorization-free login must be enabled; otherwise ticket retrieval will fail.
- Confirm the provider's streaming mode and ticket rules. Instance Edition/preemptive mode may only issue tickets for the same EndUserId; this implementation uses the app's stable user UUID.
- In the Alibaba Cloud Phone policy for the assigned instance, enable Clipboard in both directions: Paste to Cloud Phone and Paste Data to Local Device (two-way transfer). The Web SDK `setClipboardEnabled(true)` only enables the client feature; it does not override a server-side policy that denies clipboard transfer.
- The client enables clipboard after `onConnected`. For SDK versions exposing `setClipboardModule`, the send button uses `sendClipboardDataToRemote` to push entered text directly to the cloud phone. Receiving copied text still depends on the instance policy and browser clipboard permission.
- Safari requires the documented custom-IME clipboard path (`readClipboardDataByUser` and `useCustomIme`); the client sets these connection options for Safari sessions.
- Test the actual browser session on Android Chrome, desktop Chrome, Safari, and Firefox.
- Verify that the purchased Android image includes the needed Google services and that TikTok, YouTube, Play Store, audio/video decoding, and touch input work. Do not promise these until tested.
- Add payment gateway/webhooks, a shared rate-limit store for multi-replica deployments, explicit origin policy, audit logs, monitoring, backups, account recovery, concurrency limits, and expiry cleanup before public rental launch.
- Define whether customer data persists or is wiped between rentals. Do not recycle an instance between customers without an approved data-cleaning process.
- The app currently does not create, purchase, release, or automatically scale cloud phone resources. It only lists existing instances, assigns an existing instance, and requests connection tickets.

## Official references

- Quick start and manual purchase: https://www.alibabacloud.com/help/en/ecp/getting-started-for-cloud-phone
- API overview: https://www.alibabacloud.com/help/en/ecp/api-eds-aic-2023-09-30-overview
- Integration best practices: https://www.alibabacloud.com/help/en/ecp/best-practice-of-integration
- Batch connection ticket API: https://www.alibabacloud.com/help/en/ecp/api-eds-aic-2023-09-30-batchgetacpconnectionticket
- Web SDK: https://www.alibabacloud.com/help/en/ecp/web-sdk-of-cloudphone