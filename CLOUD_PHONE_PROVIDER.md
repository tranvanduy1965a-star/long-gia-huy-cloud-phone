# LONG GIA HUY CLOUD PHONE — Cloud provider decision

Updated: 2026-11-20

## Decision for the first real device

Use **Alibaba Cloud Workspace Cloud Phone, Singapore region** as the first provider candidate. This is a native Android cloud-phone service running on ARM-based cloud infrastructure, not a browser mockup. The Singapore region is listed as supported for the Instance Edition.

Official references:
- Product overview: https://www.alibabacloud.com/help/en/ecp/what-is-cloud-phone
- Regional limits: https://www.alibabacloud.com/help/en/ecp/limits
- Current billing: https://www.alibabacloud.com/help/en/ecp/billing-of-cloud-phone
- Create/manage/connect: https://www.alibabacloud.com/help/en/ecp/create-and-manage-instances
- API overview: https://www.alibabacloud.com/help/en/ecp/api-eds-aic-2023-09-30-overview
- Regional API endpoints: https://www.alibabacloud.com/help/en/ecp/api-eds-user-2021-03-08-endpoint-cloudphone

## Why this candidate

- Singapore is an available region, geographically reasonable for users in Vietnam.
- Cloud Phone runs native Android and supports remote interaction from client devices.
- Instance Edition includes persistent 32 GiB device storage in the published specifications.
- It exposes APIs/SDKs for resource management and supports remote connection through the provider's console/client.
- It is a closer match to a persistent cloud phone than a disposable Android test emulator.

## Initial sizing and published list price

For video-oriented apps such as TikTok and YouTube, use the **Standard** profile for the first test, not the smallest profile.

| Profile | Published hardware | Singapore / other-region subscription |
|---|---:|---:|
| Lightweight | 2 vCPU / 4 GiB / 32 GiB | USD 15.3538 / month |
| General Purpose | 4 vCPU / 4 GiB / 32 GiB | USD 21.4953 / month |
| Balanced | 3 vCPU / 6 GiB / 32 GiB | USD 23.1488 / month |
| Standard | 4 vCPU / 8 GiB / 32 GiB | USD 33.0697 / month |
| Performance | 8 vCPU / 16 GiB / 32 GiB | USD 56.4546 / month |

The provider's guidance identifies Standard as suitable for low-resolution video streaming. These are published compute subscription prices, not a complete bill. Network bandwidth, taxes, NAT/EIP, backup storage, and other add-ons may cost extra. Confirm the checkout quote before purchase. The provider currently lists Singapore standard network bandwidth at USD 2.95/Mbps/month.

**Billing note (checked 2026-11-20):** the current official billing page lists both subscription and pay-as-you-go for Instance Edition outside mainland China. For Standard in regions outside mainland China, the listed rates are USD 33.0697/month subscription or USD 0.1252/hour pay-as-you-go. The console and checkout for the actual account are authoritative; verify availability, minimum billing cycle, taxes, network charges, and any account-specific restrictions before purchase.

## Product architecture

1. The existing website remains the customer portal.
2. The existing Node API remains the only place that handles passwords, subscription authorization, and provider credentials.
3. The API creates or assigns one provider cloud-phone instance to an eligible customer.
4. The API stores the provider instance ID and lifecycle state in the local database.
5. The customer receives a short-lived, scoped remote-access session through a supported provider client/SDK flow.
6. When a rental expires, the API revokes access and follows the configured stop/reset/retention policy.
7. Admin actions and provider errors are audited.

## Security requirements before production

- Never put Alibaba AccessKey ID/Secret in browser JavaScript or GitHub.
- Configure provider credentials only as protected environment secrets on the server.
- Use a RAM sub-user/role with the smallest permissions required; do not use the account root key.
- Do not expose raw ADB, SSH, or provider management credentials to customers.
- Enforce one active device assignment per user unless an admin explicitly grants more.
- Validate subscription expiry on every device-session request, not just at login.
- Add rate limiting, CSRF/origin protection where applicable, audit logging, backup/restore, and account recovery before public launch.
- Keep a per-device cost ceiling and a manual kill switch to prevent runaway cloud charges.

## Google Play and app compatibility

The provider describes the cloud phone as native Android, but the exact Android build, Google Play availability/certification, TikTok compatibility, video decoding, microphone/camera behavior, and remote input latency must be tested on a paid pilot device before promising them to customers. Do not advertise Google Play or a particular app as working until the test passes.

## What is not deployed yet

The repository currently contains the customer portal and account/subscription API starter. It does **not** yet have an Alibaba Cloud account, purchased cloud-phone instance, provider AccessKey, provider API adapter, browser-streaming integration, or a live Android device. Therefore the current site must continue to show the device as unavailable rather than pretending a virtual phone exists.

## Required owner action before live provisioning

The owner must create/verify an Alibaba Cloud account, complete any required identity and payment setup, and purchase/authorize the first Singapore test instance. Do not ask the owner to paste secrets into chat. Store AccessKey credentials only in the hosting service's secret/environment-variable settings after the backend adapter is ready.
