# Android release: background-location rejection

Google rejected Shopico's background-location declaration because the declared feature did not qualify as core functionality (Play Console issue 4986889167532646966). Android now shares driver location only while Shopico is active and visible. Sharing pauses when minimized or locked and resumes when reopened during the same delivery session. iOS keeps its separate existing tracking implementation.

## Before each Android release

Run commands from `mobile/`, not the monorepo root:

```sh
npm test
npm run check:android-policy
```

The policy check also runs automatically through `eas-build-post-install`. It verifies resolved Expo plugins, the generated manifest, any existing local native manifest, and Android source requests. For production Android builds, the `eas-build-on-success` hook checks the merged release manifests after compilation, including library permissions. Android explicitly blocks `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, and `FOREGROUND_SERVICE_LOCATION` to prevent manifest merging from restoring location outside the app.

If a local `android/` project is stale, regenerate it using `npx expo prebuild --platform android` and rerun the check. Do not restore these permissions to make an old tracking implementation work.

This fix changes native permissions: publish a **new Android App Bundle**, not just an EAS Update:

```sh
eas build --platform android --profile production
```

Before submitting, inspect the resulting bundle's permissions in Play Console's App bundle explorer. Confirm that background location and location foreground services are absent. Test starting a delivery, switching apps, locking/unlocking, returning to Shopico, completing/cancelling the delivery, and signing out. Location sharing must stop outside the app and after delivery/sign-out; addresses and delivery-distance lookup should still work with while-in-use location permission.

## Play Console cleanup required

- Replace/deactivate older noncompliant artifacts on **every active track**, including internal, closed, open testing and production. An old active APK/AAB can keep this rejection in effect.
- Update the location permission declaration to reflect that Android no longer requests background location. Check Data safety and the privacy policy against the actual foreground location collection/sharing; location is still collected and shared for delivery tracking.
- Submit the new native release for review. A code/config check cannot guarantee Google approval or correct old artifacts and declarations already in Play Console.

Google guidance: https://support.google.com/googleplay/android-developer/answer/9799150
Expo permissions: https://docs.expo.dev/guides/permissions/
