# Deploy LONG GIA HUY account portal on Render

> **Mở nhanh:** [Deploy this Blueprint on Render](https://render.com/deploy?repo=https://github.com/tranvanduy1965a-star/long-gia-huy-cloud-phone). Đăng nhập, kiểm tra cấu hình và giá hiện tại trước khi bấm tạo dịch vụ. Thao tác này tạo tài nguyên tính phí nên chỉ chủ tài khoản mới xác nhận.

This repository includes a Render Blueprint at `render.yaml`. It deploys the
Node.js API and serves the website from the same HTTPS origin, so registration
and login no longer point at GitHub Pages without a backend.

## Important cost and safety note

The Blueprint uses a Render Starter web service and a 1 GB persistent disk.
Both are billable resources. Creating the Blueprint file in GitHub does not
create resources or charge an account. The repository owner must sign in to
Render, review the current price shown by Render, and explicitly approve the
deployment. Do not switch to an ephemeral free service for real user accounts:
the SQLite database could be lost when the service restarts or redeploys.

## Deploy

1. Sign in to Render and choose **New → Blueprint**.
2. Connect `tranvanduy1965a-star/long-gia-huy-cloud-phone`.
3. Review the service name, Singapore region, Starter plan, and persistent disk.
4. Review the generated `SESSION_SECRET`; Render creates it as a secret.
5. For the first deployment, leave both Alibaba AccessKey fields empty. Account
   registration/login do not require Alibaba credentials. Do not paste secrets
   into GitHub or this chat.
6. Create the resources only after reviewing and approving the displayed cost.
7. When the deployment is healthy, open the Render service's HTTPS URL. This is
   the working website URL; the GitHub Pages URL remains a static preview and
   cannot create accounts.

## Bootstrap the first admin

1. Open the Render HTTPS URL and register the owner account.
2. Sign in and copy the account ID shown on the account panel.
3. In Render → service → Environment, set `ADMIN_USER_IDS` to that exact ID.
4. Save/redeploy, then sign out and sign in again. The account should now have
   admin privileges.
5. Alibaba credentials and an already-purchased cloud-phone instance are only
   needed for Android streaming, not for account registration.

## Persistence and limitations

- SQLite is stored at `/var/data/cloudphone.sqlite` on the persistent disk.
- HTTPS and the health endpoint `/api/health` are provided by Render.
- The service does not purchase Android instances, payment plans, or Google Play
  access. Alibaba AccessKeys, a provisioned Android instance, authorization-free
  ticket support, and the licensed Web SDK remain separate requirements.
- The official vendor Web SDK must be supplied according to Alibaba's license
  and placed in the expected `cloud-sdk/` path in the deployed app. Do not add
  licensed vendor files to this public repository unless redistribution is allowed.
