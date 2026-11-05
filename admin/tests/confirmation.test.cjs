const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function compile(source, context = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, ...context });
  return exports;
}
function setup(overrides = {}) {
  const confirmation = compile(fs.readFileSync(path.join(root, 'src/utils/confirmation.ts'), 'utf8'));
  const requests = [], state = { calls: 0, refreshed: 0, result: null, error: '', busy: false };
  confirmation.registerConfirmationHost(request => requests.push(request));
  const file = path.join(root, 'src/pages/Products.tsx');
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let action;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'unpublishWithoutImages') action = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(action, 'Use the real product action in this regression test');
  const currentBranchId = { current: 'branch-a' }, unpublishPending = { current: false };
  const code = compile(`export const run = ${action}`, {
    ...confirmation, canManage: true, selectedBranchId: 'branch-a', currentBranchId,
    unpublishing: false, unpublishPending, t: key => key,
    setUnpublishing: value => { state.busy = value; },
    setUnpublishResult: value => { state.result = value; },
    setUnpublishError: value => { state.error = value; },
    setSelectedProductsById: () => {},
    unpublishProductsWithoutImages: async () => { state.calls++; return { modifiedCount: 3 }; },
    loadProducts: async () => { state.refreshed++; }, getFilterParams: () => ({}), limit: 20,
    ...overrides,
  });
  return { run: code.run, requests, state, currentBranchId, unpublishPending };
}
test('unpublishing waits for confirmation and cancellation makes no API request', async () => {
  const { run, requests, state, unpublishPending } = setup();
  const pending = run();
  assert.equal(requests.length, 1); assert.equal(state.calls, 0);
  requests[0].resolve(false); await pending;
  assert.equal(state.calls, 0); assert.equal(state.refreshed, 0); assert.equal(unpublishPending.current, false);
});
test('confirming unpublishes once and refreshes the product list', async () => {
  const { run, requests, state } = setup();
  const pending = run(); requests[0].resolve(true); await pending;
  assert.equal(state.calls, 1); assert.equal(state.refreshed, 1); assert.equal(state.result, 3); assert.equal(state.busy, false);
});
test('double clicking cannot queue duplicate bulk actions', async () => {
  const { run, requests, state } = setup();
  const pending = run(); await run();
  assert.equal(requests.length, 1);
  requests[0].resolve(true); await pending;
  assert.equal(state.calls, 1);
});
test('changing branch while confirmation is open cancels the bulk action', async () => {
  const { run, requests, state, currentBranchId } = setup();
  const pending = run(); currentBranchId.current = 'branch-b'; requests[0].resolve(true); await pending;
  assert.equal(state.calls, 0);
});
test('missing permissions prevent even opening confirmation', async () => {
  const { run, requests, state } = setup({ canManage: false });
  await run(); assert.equal(requests.length, 0); assert.equal(state.calls, 0);
});
test('confirmation fails closed when its dialog host is unavailable', async () => {
  const { confirmAction } = compile(fs.readFileSync(path.join(root, 'src/utils/confirmation.ts'), 'utf8'));
  assert.equal(await confirmAction({ title: 'Delete', message: 'Delete?', confirmLabel: 'Delete' }), false);
});
