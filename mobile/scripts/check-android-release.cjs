const { execFileSync } = require('node:child_process');
const path = require('node:path');
if (process.env.EAS_BUILD_PLATFORM === 'android' && process.env.EAS_BUILD_PROFILE === 'production') {
  execFileSync(process.execPath, [path.join(__dirname, 'check-android-policy.cjs'), '--merged-only'], { stdio: 'inherit' });
}
