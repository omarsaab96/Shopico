const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setup({ permission = 'granted', visible = false, focused = false } = {}) {
  const notifications = [], contexts = [], tones = [];
  class AudioContext {
    state = 'suspended'; currentTime = 0; destination = {};
    constructor() { contexts.push(this); }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
    createOscillator() {
      const tone = { frequency: {}, connect() {}, disconnect() {}, start(at) { this.startAt = at; }, stop(at) { this.stopAt = at; } };
      tones.push(tone); return tone;
    }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  class Notification {
    static permission = permission;
    constructor(title, options) { this.title = title; this.options = options; notifications.push(this); }
    close() { this.closed = true; this.onclose?.(); }
  }
  let focusCalls = 0;
  const sandbox = { exports: {}, AudioContext, Notification,
    window: { Notification, focus() { focusCalls++; } },
    document: { visibilityState: visible ? 'visible' : 'hidden', hasFocus: () => focused },
  };
  const source = fs.readFileSync(require('node:path').join(__dirname, '../src/utils/notificationAlerts.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
  return { alerts: new sandbox.exports.NotificationAlerts(), notifications, contexts, tones, focusCalls: () => focusCalls };
}
const item = { _id: 'one', title: { en: 'New order', ar: 'Arabic title' }, body: { en: 'Order received', ar: 'Arabic body' } };

test('audio resumes after interaction and plays a two-note chime', async () => {
  const { alerts, contexts, tones } = setup();
  await alerts.unlock();
  assert.equal(contexts[0].state, 'running');
  await alerts.play();
  assert.equal(contexts.length, 1);
  assert.deepEqual(tones.map(t => t.frequency.value), [880, 1174]);
  assert.ok(tones.every(t => t.stopAt > t.startAt));
  alerts.dispose();
  assert.equal(contexts[0].state, 'closed');
});
test('inactive tab gets a localized desktop alert that opens the order on click', () => {
  const { alerts, notifications, focusCalls } = setup();
  let clicked = false;
  alerts.show(item, 'ar', () => { clicked = true; });
  assert.equal(notifications[0].title, item.title.ar);
  assert.equal(notifications[0].options.tag, item._id);
  notifications[0].onclick();
  assert.equal(clicked, true);
  assert.equal(focusCalls(), 1);
  assert.equal(notifications[0].closed, true);
});
test('active focused tab does not get a desktop alert', () => {
  const { alerts, notifications } = setup({ visible: true, focused: true });
  alerts.show(item, 'en', () => {});
  assert.equal(notifications.length, 0);
});
test('unfocused window gets desktop alerts even while the page is visible', () => {
  const { alerts, notifications } = setup({ visible: true, focused: false });
  alerts.show(item, 'en', () => {});
  assert.equal(notifications.length, 1);
});
test('denied permission does not attempt a desktop alert', () => {
  const { alerts, notifications } = setup({ permission: 'denied' });
  alerts.show(item, 'en', () => {});
  assert.equal(notifications.length, 0);
});
test('changing branch or signing out clears desktop notifications', () => {
  const { alerts, notifications } = setup();
  alerts.show(item, 'en', () => {});
  alerts.clearDesktop();
  assert.equal(notifications[0].closed, true);
});
