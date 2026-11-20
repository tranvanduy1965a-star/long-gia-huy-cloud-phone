# LONG GIA HUY CLOUD PHONE — Production connection checklist

This repository now includes the account API, an Alibaba Cloud EDS-AIC SDK adapter, admin instance assignment, subscription-gated ticket issuance, and a Web SDK client integration point. It is not live until the external cloud resources and licensed SDK assets are configured.

## 1. Deploy the Node API

- Use Node.js 20+.
- Working directory: `cloud-api`.
- Build: `npm install`.
- Start: `npm start`.
- Attach persistent storage and set `DB_PATH` to a file on that disk.
- Serve over HTTPS.
- Set `SESSION_SECRET` to a cryptographically random value of at least 32 characters.
- Initially leave `ADMIN_USER_IDS` empty. Register the owner's account, copy the account ID, set `ADMIN_USER_IDS` to that exact ID in hosting secrets, then restart and sign in again.

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

## 5. Customer connection flow

- Customer registers and signs in.
- Admin grants one of the 1, 2, 3, 7, or 30 day plans and assigns an already-purchased instance.
- Customer presses Connect. The API checks the subscription expiry and assignment, then calls `BatchGetAcpConnectionTicket` with the customer's stable internal user ID.
- The browser passes the one-time ticket and instance identifiers to `Wuying.WebSDK.createSession('appstream', ...)`, then starts the session.
- The ticket is returned only to the authenticated customer and is never stored in the database.

## 6. Important launch checks

- Alibaba authorization-free login must be enabled; otherwise ticket retrieval will fail.
- Confirm the provider's streaming mode and ticket rules. Instance Edition/preemptive mode may only issue tickets for the same EndUserId; this implementation uses the app's stable user UUID.
- Test the actual browser session on Android Chrome, desktop Chrome, and Firefox.
- Verify that the purchased Android image includes the needed Google services and that TikTok, YouTube, Play Store, audio/video decoding, and touch input work. Do not promise these until tested.
- Add payment gateway/webhooks, rate limits, CSRF/origin policy, audit logs, monitoring, backups, account recovery, concurrency limits, and expiry cleanup before public rental launch.
- Define whether customer data persists or is wiped between rentals. Do not recycle an instance between customers without an approved data-cleaning process.
- The app currently does not create, purchase, release, or automatically scale cloud phone resources. It only lists existing instances, assigns an existing instance, and requests connection tickets.

## Official references

- Quick start and manual purchase: https://www.alibabacloud.com/help/en/ecp/getting-started-for-cloud-phone
- API overview: https://www.alibabacloud.com/help/en/ecp/api-eds-aic-2023-09-30-overview
- Integration best practices: https://www.alibabacloud.com/help/en/ecp/best-practice-of-integration
- Batch connection ticket API: https://www.alibabacloud.com/help/en/ecp/api-eds-aic-2023-09-30-batchgetacpconnectionticket
- Web SDK: https://www.alibabacloud.com/help/en/ecp/web-sdk-of-cloudphone