const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const blocked = ['ACCESS_BACKGROUND_LOCATION', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION'];

function checkXml(xml, label) {
  for (const tag of xml.matchAll(/<uses-permission(?:-sdk-\d+)?\b[^>]*>/g)) {
    if (/tools:node\s*=\s*["']remove["']/.test(tag[0])) continue;
    const permission = /android:name\s*=\s*["']([^"']+)["']/.exec(tag[0])?.[1];
    if (blocked.some(name => permission === `android.permission.${name}`)) {
      throw new Error(`${label} still enables location outside the app. Regenerate the native project and check permission merging.`);
    }
  }
}

function checkManifest(manifest, label) {
  for (const entry of [...(manifest['uses-permission'] || []), ...(manifest['uses-permission-sdk-23'] || [])]) {
    const attributes = entry.$ || {};
    if (attributes['tools:node'] === 'remove') continue;
    if (blocked.some(name => attributes['android:name'] === `android.permission.${name}`)) {
      throw new Error(`${label} includes ${attributes['android:name']}. Android must use in-app location only.`);
    }
  }
}

function main() {
  try {
    if (process.argv.includes('--merged-only')) {
      const intermediates = path.join(root, 'android/app/build/intermediates');
      let checked = 0;
      for (const folder of ['merged_manifest', 'merged_manifests', 'packaged_manifests']) {
        const directory = path.join(intermediates, folder);
        if (!fs.existsSync(directory)) continue;
        for (const file of fs.readdirSync(directory, { recursive: true })) {
          if (!/release/i.test(file) || path.basename(file) !== 'AndroidManifest.xml') continue;
          checkXml(fs.readFileSync(path.join(directory, file), 'utf8'), `Merged release manifest ${file}`);
          checked++;
        }
      }
      if (!checked) throw new Error('No merged release manifest found; build the release before verifying its permissions.');
      console.log(`Verified ${checked} merged Android release manifest(s): rejected location permissions absent.`);
      process.exit(0);
    }
    // Resolve plugins as well as app.json so a future dependency/config change cannot silently restore access.
    const output = execFileSync(process.execPath, [require.resolve('expo/bin/cli'), 'config', '--type', 'introspect', '--json'], {
      cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
    });
    const config = JSON.parse(output);
    const normalize = value => value.replace(/^android\.permission\./, '');
    const explicit = (config.android?.permissions || []).map(normalize);
    const denied = (config.android?.blockedPermissions || []).map(normalize);
    for (const permission of blocked) {
      if (explicit.includes(permission) || !denied.includes(permission)) throw new Error(`Keep ${permission} removed and blocked in app.json.`);
    }
    const manifest = config._internal?.modResults?.android?.manifest?.manifest;
    if (!manifest) throw new Error('Expo did not return an Android manifest; refusing an unverified release.');
    checkManifest(manifest, 'Expo generated manifest');
    // A local native project can override Expo config. Never silently approve a stale prebuild.
    const native = path.join(root, 'android/app/src/main/AndroidManifest.xml');
    if (fs.existsSync(native)) {
      checkXml(fs.readFileSync(native, 'utf8'), 'Local Android manifest');
    }
    // Android resolves .android/.native/.ts files; .ios files are intentionally separate.
    for (const folder of ['app', 'lib', 'components']) {
      for (const file of fs.readdirSync(path.join(root, folder), { recursive: true })) {
        if (!/\.tsx?$/.test(file) || /\.ios\.tsx?$/.test(file)) continue;
        const source = fs.readFileSync(path.join(root, folder, file), 'utf8');
        if (/\b(requestBackgroundPermissionsAsync|startLocationUpdatesAsync|startGeofencingAsync)\s*\(/.test(source)) {
          throw new Error(`Android source ${folder}/${file} requests location outside the app.`);
        }
      }
    }
    console.log('Android location policy check passed: no background location or location foreground service permissions/requests.');
  } catch (error) {
    console.error(`Android location policy check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
if (require.main === module) main();
module.exports = { checkXml, checkManifest };
