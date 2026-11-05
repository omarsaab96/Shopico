const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function measure(height) {
  const file = path.resolve(__dirname, '../src/components/ModalSurface.tsx');
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let source;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'measure') source = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(source);
  // A previous animation frame left a 16px scrollbar beside the 422px content.
  const surface = { offsetWidth: 440, clientWidth: 422, style: {} };
  vm.runInNewContext(`(${source})()`, {
    surface, inner: { getBoundingClientRect: () => ({ width: 422, height }) },
    window: { innerWidth: 1200, innerHeight: 900 },
    getComputedStyle: () => ({ borderLeftWidth: '1px', borderRightWidth: '1px', borderTopWidth: '1px', borderBottomWidth: '1px', maxHeight: '868px' }),
  });
  return surface.style;
}

test('a popup that fits drops a stale scrollbar gutter instead of leaving empty space', () => {
  assert.deepEqual(measure(288), { width: '424px', height: '290px' });
});

test('an overflowing popup keeps room for the scrollbar and stays inside the viewport', () => {
  assert.deepEqual(measure(1000), { width: '440px', height: '868px' });
});
