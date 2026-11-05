const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup({ fail = false, uploading = null } = {}) {
  const file = path.resolve(__dirname, '../src/pages/Categories.tsx');
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let action;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'saveEdit') action = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const draft = { name: 'Updated category', description: 'New description', imageUrl: 'https://example.test/image.png' };
  const state = { calls: [], editingId: 'category-1', draft, busy: false, error: '', refreshed: false };
  const exports = {};
  const source = ts.transpileModule(`export const run = ${action}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, editingId: 'category-1', editDraft: draft, saving: false, editUploadingId: uploading,
    setSaving: value => { state.busy = value; }, setEditError: value => { state.error = value; },
    setEditingId: value => { state.editingId = value; }, setEditDraft: value => { state.draft = value; },
    getFilterParams: () => ({}), load: () => { state.refreshed = true; },
    api: { put: async (...args) => { state.calls.push(args); if (fail) throw { response: { data: { message: 'Could not save' } } }; } },
  });
  return { run: exports.run, state, draft };
}
test('category popup saves name, description and image, then closes and refreshes', async () => {
  const { run, state, draft } = setup(); await run();
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0][0], '/categories/category-1');
  assert.equal(state.calls[0][1], draft);
  assert.equal(state.editingId, null); assert.equal(state.refreshed, true); assert.equal(state.busy, false);
});
test('failed category save keeps the popup and draft open for retry', async () => {
  const { run, state, draft } = setup({ fail: true }); await run();
  assert.equal(state.editingId, 'category-1'); assert.equal(state.draft, draft);
  assert.equal(state.error, 'Could not save'); assert.equal(state.refreshed, false); assert.equal(state.busy, false);
});
test('category cannot save while its edited image is still uploading', async () => {
  const { run, state } = setup({ uploading: 'category-1' }); await run();
  assert.equal(state.calls.length, 0); assert.equal(state.editingId, 'category-1');
});
