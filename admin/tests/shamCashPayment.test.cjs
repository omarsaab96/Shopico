const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup(confirmed = true) {
  const file = path.resolve(__dirname, '../src/pages/Orders.tsx');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let action;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'update') action = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(action);
  const state = { confirmations: [], calls: [], driverRequired: null, orders: [] };
  const exports = {};
  const code = ts.transpileModule(`export const run = ${action}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    exports, console, mutatingRef: { current: false }, t: key => key, tStatus: status => status,
    formatOrderMoney: value => `${value} SYP`, getDriverIdValue: value => typeof value === 'string' ? value : value?._id || '',
    confirmAction: async request => { state.confirmations.push(request); return confirmed; },
    setDriverRequiredOrder: value => { state.driverRequired = value; },
    setOrders: updater => { state.orders = updater(state.orders); },
    updateOrderStatus: async (...args) => { state.calls.push(args); return { ...state.orders[0], status: args[1], paymentStatus: args[2] }; },
  });
  return { run: exports.run, state };
}
const order = { _id: 'order-1', status: 'PENDING', paymentMethod: 'SHAM_CASH', paymentStatus: 'PENDING', total: 100, driverId: 'driver-1' };

test('cancelling Sham Cash confirmation does not move or approve an order', async () => {
  const { run, state } = setup(false); state.orders = [order];
  assert.equal(await run(order, 'PROCESSING'), false);
  assert.equal(state.confirmations.length, 1);
  assert.equal(state.calls.length, 0);
  assert.equal(state.orders[0].paymentStatus, 'PENDING');
});
test('approval accompanies the requested status update', async () => {
  const { run, state } = setup(); state.orders = [order];
  assert.equal(await run(order, 'PROCESSING'), true);
  assert.equal(state.confirmations.length, 1);
  assert.equal(state.calls[0][2], 'CONFIRMED');
  assert.equal(state.orders[0].paymentStatus, 'CONFIRMED');
});
test('driver selection preserves payment approval without saving a partial change', async () => {
  const { run, state } = setup(); const unassigned = { ...order, driverId: null }; state.orders = [unassigned];
  assert.equal(await run(unassigned, 'PROCESSING'), false);
  assert.equal(state.driverRequired.paymentStatus, 'CONFIRMED');
  assert.equal(state.calls.length, 0);
  assert.equal(state.orders[0].paymentStatus, 'PENDING');
  assert.equal(await run(state.driverRequired.order, state.driverRequired.status, state.driverRequired.paymentStatus, 'driver-1'), true);
  assert.equal(state.confirmations.length, 1);
  assert.equal(state.calls[0][3], 'driver-1');
});
test('already approved Sham Cash and other payment methods need no payment popup', async () => {
  for (const ready of [{ ...order, paymentStatus: 'CONFIRMED' }, { ...order, paymentMethod: 'CASH_ON_DELIVERY' }]) {
    const { run, state } = setup(); state.orders = [ready];
    assert.equal(await run(ready, 'PROCESSING'), true);
    assert.equal(state.confirmations.length, 0);
  }
});
