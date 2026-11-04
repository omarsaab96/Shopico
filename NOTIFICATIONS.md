# Notifications

The backend captures notifications for order creation and status changes, initial and later payment confirmation, driver assignment/reassignment/removal, completed refunds and total reductions, wallet top-up requests/results, admin wallet credits, points earned, unlocked rewards, membership changes, and scheduled announcements.

## Delivery and access

- Staff receive order events only with `orders:view` and branch membership; wallet events require `wallet:topups:view`. Inbox queries, streams, read actions and queued pushes recheck access.
- Customers receive their own events. Assigned drivers receive order changes; a removed driver receives a removal alert. Driver location updates and internal notes do not generate alerts.
- Source document saves atomically append an embedded outbox event. A worker checks every two seconds, creates durable inbox records, and removes acknowledged events. Unique event/recipient and notification/device indexes make retries safe across server instances.
- Driver and staff delivery completion use the same points/reward path. Saving the same order status again does not generate another status alert or repeat completion rewards.
- Refund alerts wait for `COMPLETED` settlement. Top-up approval alerts wait for the wallet credit ledger entry. Recovery works after server restarts.
- A persisted activation timestamp prevents existing historical refunds/announcements from generating a burst of alerts on first deployment. New scheduled announcements are broadcast once when enabled and within their active window. Editing an already announced item does not broadcast it again.
- English and Arabic notification content is saved together. Each device's language controls push text; the inbox follows the current app/panel language.
- Inbox read state is shared across devices for each user. Disabling push retains the inbox. Promotional opt-out suppresses announcement pushes while keeping inbox content.

## Admin

### Session settings and testing

Set these in `backend/.env` (and the production backend environment before deployment):

```dotenv
JWT_EXPIRES_IN=24h
SESSION_EXPIRY_WARNING_MINUTES=10
```

Defaults live in `backend/src/config/env.ts`; a template is in `backend/.env.example`. `JWT_EXPIRES_IN` accepts JWT duration strings such as `24h`, `2m` or `30s`. The warning value is a number of minutes. For a quick test use `JWT_EXPIRES_IN=2m` and `SESSION_EXPIRY_WARNING_MINUTES=1`, restart the backend, and log in again. Existing tokens keep their originally issued expiry. Restore `24h` and `10` after testing.

The **admin panel only** obtains the signed access-token deadline and warning window from `/api/auth/session`. It shows a countdown popup before expiry and checks again on resume. **OK, understood** minimizes the warning to a live timer beside the dark-mode toggle without extending the session. Clicking the small timer reopens the popup; it turns red during the final minute. The minimized state survives page reloads for that session. **Refresh session** signs out and opens login so the user authenticates again. Admin expiry also signs out automatically.

The **mobile app renews silently** and has no expiry-warning popup. It rotates its access/refresh tokens on opening/resuming, hourly while foregrounded during long visits, and when an authenticated request returns an expired access token. Successful renewal restarts the refresh-token window, configured with `JWT_REFRESH_EXPIRES_IN=7d` in `backend/.env`. Returning after seven days without opening the app requires login. Background tasks and push receipt alone do not proactively renew the session. Offline/server failures preserve stored credentials for retry; a rejected/expired refresh token requires login. Concurrent expiry requests share one renewal, and late refresh responses cannot restore a logged-out session or overwrite a different login.

Logout clears the refresh cookie and removes the app's device binding. Mobile push-device bindings follow the rolling refresh-token expiry, with renewal extending only the current device's binding. Devices are not cut off just because a 24-hour access token expires. After the seven-day window expires, the binding stops receiving new pushes; a new login registers the device again.

The global header includes a notification bell, unread count, paginated inbox, read-all action, connection state, dismissible toast and optional new-order sound. Clicking a notification opens its order or wallet page. Sound must be enabled through a browser interaction.

The panel consumes an authenticated fetch/SSE stream. It reconnects with a cursor and refreshes the inbox after each handshake. Events refresh the open orders list and matching order detail. A sixty-second fallback refresh remains on the orders page. The stream queries MongoDB every two seconds, so typical local capture-to-panel latency is up to about four seconds; no Redis or replica set is required.

Reverse proxies must allow `/api/notifications/stream` to remain open and unbuffered. The response sets `X-Accel-Buffering: no`, `Cache-Control: no-cache, no-transform`, and sends heartbeats. Configure the proxy read timeout above the heartbeat interval. Access tokens are sent in headers, not URLs, and expired sessions close the stream.

## App

Driver assignment notifications open `/driver-orders/:id`, showing the assigned order's customer contact, address and items. Removed assignments display an explicit message without exposing the current order's private details; cancelled orders show a cancellation message with delivery actions disabled. Active driver directions refresh on notifications, resume and polling, and stop tracking cancelled/removed orders. Drivers can read/update only their own assignments. **Start delivery** saves `SHIPPING` immediately, independently of whether location permission is granted. **Delivered** completes the order using the existing final status `DELIVERED`, displayed as **Completed** in the driver flow. A driver cannot complete an unstarted, cancelled or removed delivery.

The home bell and profile link open `/notifications`; its settings link opens `/settings`. The app supports persisted push and promotional preferences, OS permission handling, token registration/rotation, foreground notifications, background/cold-start tap handling, unread badges, pull-to-refresh, pagination, and read-all. Push taps fetch the authorized saved notification before navigating.

Signing out removes the current device binding before clearing authentication. Device registration follows the current account and is serialized with sign-out. Account deletion removes notification/device/preferences/push records. Invalid device tokens are removed when Expo reports `DeviceNotRegistered`.

The native app uses `expo-notifications` and `expo-device`, installed for Expo SDK 54. Web retains the inbox without loading native push APIs. Mobile inboxes refresh every thirty seconds while active, on resume, on push receipt, and when opened; affected order, driver, wallet and points screens refresh when a notification arrives.

The native app version is prepared as `1.0.1`. Its existing `runtimeVersion: appVersion` policy therefore separates these notification-capable binaries from older `1.0.0` binaries when publishing later OTA updates.

## Push credentials and release

1. The Firebase project's **FCM v1 service-account key** has been uploaded and assigned in EAS to `com.omarsaab96.shopico`. The key's project ID was verified as `shopico-83cde`, matching the app configuration. The private JSON remains outside the repository. For future replacement, run `eas credentials -p android`, select production, then Google Service Account > Push Notifications (FCM V1). `google-services.json` is app configuration and does not replace this private credential.
2. An existing Apple Push Notifications key from Shopico's matching Apple team has been assigned in EAS to `app.omarsaab96.shopico`. No new key is needed. Native push capability must still be present in the new provisioning profile/build; EAS may need Apple account access to regenerate that profile and validate the existing key.
3. If Expo enhanced push security is enabled, set `EXPO_ACCESS_TOKEN` on the backend. Otherwise this environment variable is optional. It must never be exposed in mobile or admin environment variables.
4. Deploy the rebuilt backend and admin together. MongoDB must permit creation of the notification collections and unique indexes. The worker starts with the backend server; no separate command is required.
5. Build and install fresh native binaries, for example `eas build --profile preview --platform android` and `eas build --profile preview --platform ios`. The existing development iOS profile targets the simulator; use a device-capable profile for push validation. An OTA JavaScript update alone cannot install the new native notification module.
6. Sign in on a physical device, allow notifications, and confirm registration. Test an order/status change in the foreground, background, and after closing the app; tap the alert, then verify the inbox and badge. Test a driver assignment, a settled refund and wallet approval, Arabic text, push opt-out, sign-out, and branch/permission removal. Confirm a new order alerts the admin from another page and after a reconnect.

Android FCM v1 and iOS APNs keys are now assigned in EAS. The owner generated the Firebase credential and it was uploaded directly from Downloads without copying it into the repository. An existing iOS key on the matching Apple team was assigned to Shopico. No production notifications were sent and no release was published during setup. Real-device delivery is still pending the deployment and fresh native builds below.

### What is needed from the owner

- Android credential generation/upload is complete. If device testing reports a Firebase permission/API error, verify that the Firebase Cloud Messaging API is enabled and that the service account has the Firebase Cloud Messaging API Admin role as described in Expo's setup guide. Keep the private JSON outside the repository.
- Apple account access if EAS requests it when adding push capability to the provisioning profile. The Apple push key assignment itself is already done.
- Backend/admin deployment access and fresh Android/iOS builds installed on physical devices for the final delivery/tap/background checks. The code, test results, or bundle exports alone do not confirm real-device push delivery.

See [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [FCM v1 credential setup](https://docs.expo.dev/push-notifications/fcm-credentials/), and [Expo sending and receipt handling](https://docs.expo.dev/push-notifications/sending-notifications/).

## Operations and validation

`NotificationPush` records store delivery state (`PENDING`, `RECEIPT`, `DONE`, `FAILED`), attempts, next attempt time and error. Workers use atomic leases, exponential retry, ten attempts, fifteen-minute receipt checks, and invalid-token cleanup. A successful receipt confirms handoff to Apple/Google, not that a person saw the notification. Network ambiguity can cause a repeated OS push; the saved inbox remains unique. Investigate failed jobs before resetting them to `PENDING` with a current `nextAttempt` and cleared lease.

Run `npm test` and `npm run build` in `backend`, `npm run build` in `admin`, and `npx tsc --noEmit` in `mobile`. Native bundle checks can use `npx expo export --platform android --platform ios --output-dir dist`. Integration tests use an isolated temporary MongoDB server and mock Expo delivery; they do not touch production data or send real pushes.
