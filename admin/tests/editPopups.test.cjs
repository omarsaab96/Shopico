const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function page(name) {
  const file = path.resolve(__dirname, `../src/pages/${name}.tsx`);
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function arrow(ast, name) {
  let result;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) result = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(result, `Missing ${name}`); return result;
}
function compile(source, values) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, ...values });
  return exports;
}
function setup(name, overrides = {}, fail = false) {
  const ast = page(name);
  const state = { calls: [], error: '', busy: false, editingId: 'record-1', refreshed: false };
  const saved = async payload => { state.calls.push(payload); if (fail) throw { response: { data: { message: 'Save failed' } } }; return { ...payload, _id: 'record-1' }; };
  const ctx = {
    editingId: 'record-1', editDraft: {}, saving: false, canManage: true, banners: false, editUploadingId: null,
    t: key => key, primaryCurrencyId: 'primary',
    toIso: value => value ? new Date(value).toISOString() : undefined,
    normalizeBoolean: value => value === false || value === 'false' ? false : true,
    setSaving: value => { state.busy = value; },
    setEditError: value => { state.error = value; }, setError: value => { state.error = value; },
    setEditingId: value => { state.editingId = value; }, setEditDraft: () => {},
    setAnnouncements: () => {}, setCoupons: () => {}, setBranches: () => {},
    saveItem: saved, saveCoupon: saved, saveBranch: saved, saveCurrency: saved,
    refreshBranches: async () => {},
    getFilterParams: () => ({}), load: async () => { state.refreshed = true; }, loadCoupons: () => { state.refreshed = true; },
    cancelEdit: () => { state.editingId = null; },
    ...overrides,
  };
  if (name === 'Currencies') ctx.normalizeDraft = compile(`export const normalize = ${arrow(ast, 'normalizeDraft')}`, {}).normalize;
  return { state, run: compile(`export const run = ${arrow(ast, 'saveEdit')}`, ctx).run };
}

const drafts = {
  Announcements: { title: 'Edited', image: { url: 'https://example.test/banner.png', fileId: 'image-1' }, startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-11-30T00:00:00Z' },
  Coupons: { code: 'sale', assignmentType: 'USERS', assignedUsers: ['user-1'], assignedProducts: ['product-1'], usageType: 'MULTIPLE', maxUsesPerUser: 2, discountType: 'PERCENT', discountValue: 10 },
  Branches: { name: 'Edited', lat: 33.5, lng: 36.3, address: 'Updated address', isActive: false, deliveryRadiusKm: 7 },
  Currencies: { symbol: { en: ' USD ', ar: 'دولار' }, exchangeRate: 12000, isActive: true, isPrimary: false },
};
for (const name of Object.keys(drafts)) {
  test(`${name} edit popup saves the existing record and closes on success`, async () => {
    const { state, run } = setup(name, { editDraft: drafts[name] }); await run();
    assert.equal(state.calls.length, 1); assert.equal(state.calls[0]._id, 'record-1');
    assert.equal(state.editingId, null); assert.equal(state.refreshed, true); assert.equal(state.busy, false);
    if (name === 'Announcements') assert.equal(state.calls[0].startsAt, '2026-11-01T00:00:00.000Z');
    if (name === 'Coupons') { assert.equal(state.calls[0].code, 'SALE'); assert.equal(state.calls[0].maxUsesPerUser, 2); }
    if (name === 'Branches') assert.equal(state.calls[0].isActive, false);
    if (name === 'Currencies') assert.equal(state.calls[0].symbol.en, 'USD');
  });
  test(`${name} edit popup stays open on save failure`, async () => {
    const { state, run } = setup(name, { editDraft: drafts[name] }, true); await run();
    assert.equal(state.editingId, 'record-1'); assert.equal(state.error, 'Save failed'); assert.equal(state.busy, false);
  });
  test(`${name} table is read-only and editing uses the shared popup`, () => {
    const ast = page(name); let fields = 0, editor = false;
    const fieldsIn = node => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ['input', 'select', 'DatePicker', 'BranchLocationPicker'].includes(node.tagName.getText(ast))) fields++;
      ts.forEachChild(node, fieldsIn);
    };
    const visit = node => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'tbody') fieldsIn(node);
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'ModalSurface' && node.getText(ast).includes('void saveEdit()')) editor = true;
      ts.forEachChild(node, visit);
    };
    visit(ast); assert.equal(fields, 0); assert.equal(editor, true);
  });
}
test('home banner edit still requires an image', async () => {
  const { state, run } = setup('Announcements', { banners: true, editDraft: { title: 'No image' } }); await run();
  assert.equal(state.calls.length, 0); assert.equal(state.error, 'bannerImageRequired'); assert.equal(state.editingId, 'record-1');
});
for (const [assignmentType, key] of [['USERS', 'assignedUsers'], ['PRODUCTS', 'assignedProducts'], ['LEVELS', 'assignedMembershipLevels']]) {
  test(`coupon popup retains ${assignmentType} assignments and clears unrelated assignments`, async () => {
    const editDraft = { ...drafts.Coupons, assignmentType, assignedUsers: ['user-1'], assignedProducts: ['product-1'], assignedMembershipLevels: ['gold'] };
    const { state, run } = setup('Coupons', { editDraft }); await run();
    for (const field of ['assignedUsers', 'assignedProducts', 'assignedMembershipLevels']) assert.equal(state.calls[0][field].length, field === key ? 1 : 0);
  });
}
test('branch popup still requires a map location before saving', async () => {
  const { state, run } = setup('Branches', { editDraft: { name: 'Missing coordinates' } }); await run();
  assert.equal(state.calls.length, 0); assert.equal(state.error, 'branches.selectLocationOnMap'); assert.equal(state.busy, false);
});
