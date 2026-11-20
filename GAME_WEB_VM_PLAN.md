# GAME + WEB CLOUD PHONE: BUILD PRIORITIES

## Product target

This project is a persistent Android cloud phone for running Android games and a browser. The browser page is only a remote-control client. The Android instance, installed apps, game data, and browser profile must live on the cloud instance.

## Non-negotiable behavior

1. **Persistent instance:** closing the website, closing the browser, or turning off the user's physical phone must disconnect only the viewer. It must not call a provider stop/release/delete operation. The cloud Android instance must remain in its configured running state.
2. **Reconnect:** after sign-in, request a fresh provider connection ticket and reconnect to the same assigned instance. Never create a second instance just because a viewer reconnects.
3. **Persistent storage:** install games, game updates, browser downloads, cookies, and user data on provider-persistent storage. Verify that data survives viewer disconnects and a provider-approved instance restart.
4. **Real Android session:** the UI must show a connected state only after the official Web SDK reports its connected event. A mock phone frame is not a device.
5. **Game readiness:** validate touch input, keyboard mapping where supported, audio, frame rate, resolution, network stability, and game compatibility on the actual Android image and instance type.
6. **Web readiness:** test Chrome or the provider-supported browser on the cloud Android device. Opening a website in the user's local browser is not a substitute for opening it inside the cloud phone.
7. **Honest status:** distinguish API available, provider credentials configured, instance found, instance running, SDK loaded, and viewer connected. Do not collapse these into one green "online" label.

## Current implementation status

- Account and rental API, admin assignment of an already-purchased Alibaba Cloud Android instance, and connection-ticket request exist in the repository.
- The provider adapter currently lists instances and requests connection tickets. It does **not** provision, purchase, start, stop, or delete instances.
- The browser client expects the licensed Alibaba Wuying Web SDK at `/cloud-sdk/WuyingWebSDK.js` plus its companion `sdk/` assets. These vendor files are not included in this repository.
- A real provider instance, valid provider credentials, a deployed HTTPS API, and a tested Android image are still required before the game/web experience can be verified.
- GitHub Pages is a static preview and cannot host the API or Android instance.

## Deployment and validation sequence

1. Deploy the Node API with persistent database storage and HTTPS.
2. Configure a least-privilege Alibaba RAM AccessKey in server-side environment variables; never put credentials in browser code or source control.
3. Obtain and install the licensed Web SDK distribution and verify all referenced assets load over HTTPS.
4. Create or purchase one Android Cloud Phone instance in the target region using the provider console. Confirm its billing and idle/stop policy before enabling it.
5. Verify that the selected Android image includes the required browser and, if games require it, Google Mobile Services / Play Store. Do not assume Play Store or a game's anti-cheat will work.
6. Assign that existing instance to a test account and verify inventory, status, ticket issuance, SDK connection, touch controls, and reconnect.
7. Install one lightweight browser-based workload and one Android game. Test data persistence after closing the viewer and reconnecting, then after an approved instance restart.
8. Only after measured tests, choose a production instance size based on CPU, RAM, GPU/graphics acceleration, network latency, and the target games.

## Acceptance tests before calling it ready

- [ ] Close the website while a game is running; the cloud instance remains running.
- [ ] Reopen the website and reconnect to the same instance without creating another one.
- [ ] Confirm the game is still installed and its local data remains.
- [ ] Confirm browser profile/download data remains.
- [ ] Confirm touch, keyboard, audio, and frame delivery are usable on a real Android device.
- [ ] Confirm provider-side idle policy will not suspend the instance unexpectedly.
- [ ] Confirm a provider restart behavior and clearly document any game process that cannot survive a restart.
- [ ] Confirm the user can intentionally disconnect the viewer without stopping the cloud instance.

## Cost and safety

Cloud phone instances and persistent disks may incur ongoing charges even when nobody is viewing them. Do not create, resize, start, stop, or delete billable resources automatically without the account owner's explicit authorization. Prefer a manually created test instance first; report the provider's actual price and lifecycle policy before production rollout.
