import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const script = readFileSync(new URL('../public/app-setup.js', import.meta.url), 'utf8');
const token = 'a'.repeat(64);
function load({ android = true, query = new URLSearchParams({ email: 'driver+test@example.com', setupToken: token }).toString(), language = 'en' } = {}) {
  const elements = new Map();
  const copied = [];
  const document = { documentElement: {}, getElementById(id) {
    if (!elements.has(id)) elements.set(id, { hidden: true, handlers: {}, addEventListener(event, handler) { this.handlers[event] = handler; } });
    return elements.get(id);
  } };
  vm.runInNewContext(script, { URL, URLSearchParams, document,
    navigator: { userAgent: android ? 'Android Chrome' : 'iPhone Safari', language, clipboard: { async writeText(value) { copied.push(value); } } },
    window: { location: { search: '?' + query, href: 'https://admin.example.com/app-setup.html?' + query } }
  });
  return { document, element: id => document.getElementById(id), copied };
}
test('Android button targets Shopico and preserves invitation credentials', () => {
  const page = load();
  const href = page.element('open-app').href;
  assert.ok(href.startsWith('intent://auth/login?'));
  assert.ok(href.includes('package=com.omarsaab96.shopico;'));
  const query = new URLSearchParams(href.split('?')[1].split('#')[0]);
  assert.equal(query.get('email'), 'driver+test@example.com');
  assert.equal(query.get('setupToken'), token);
  assert.equal(page.element('actions').hidden, false);
  assert.ok(href.includes('S.browser_fallback_url=https%3A%2F%2Fadmin.example.com'));
});
test('iOS button uses the registered app scheme', () => {
  const page = load({ android: false });
  assert.ok(page.element('open-app').href.startsWith('shopico://auth/login?'));
});
test('missing or injected credentials never enable launch actions', () => {
  for (const query of ['', 'email=driver%40example.com', new URLSearchParams({ email: 'driver@example.com', setupToken: token + ';scheme=evil' }).toString()]) {
    const page = load({ query });
    assert.equal(page.element('open-app').href, undefined);
    assert.equal(page.element('actions').hidden, true);
    assert.ok(page.element('status').textContent);
  }
});
test('copy fallback copies the actual setup code', async () => {
  const page = load();
  await page.element('copy-code').handlers.click();
  assert.deepEqual(page.copied, [token]);
  assert.match(page.element('status').textContent, /Copied/);
});
test('Arabic devices receive RTL instructions', () => {
  const page = load({ language: 'ar-SY' });
  assert.equal(page.document.documentElement.dir, 'rtl');
  assert.equal(page.document.documentElement.lang, 'ar');
});
