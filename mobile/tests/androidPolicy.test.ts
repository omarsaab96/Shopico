import { createRequire } from "node:module";
import { expect, test } from "vitest";
const require = createRequire(import.meta.url);
const { checkXml, checkManifest } = require("../scripts/check-android-policy.cjs");

test.each(['ACCESS_BACKGROUND_LOCATION', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION'])(
  'release guard rejects %s even when a library introduces it', permission => {
    const name = `android.permission.${permission}`;
    expect(() => checkXml(`<manifest><uses-permission android:name="${name}" /></manifest>`, 'release')).toThrow();
    expect(() => checkXml(`<manifest><uses-permission-sdk-23 android:name="${name}" /></manifest>`, 'release')).toThrow();
    expect(() => checkManifest({ 'uses-permission': [{ $: { 'android:name': name } }] }, 'release')).toThrow();
  }
);
test('release guard accepts foreground location and explicit merger removals', () => {
  expect(() => checkXml(`<manifest>
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" tools:node="remove" />
  </manifest>`, 'release')).not.toThrow();
});
