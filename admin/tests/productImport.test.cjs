const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

test('product import opens empty, displays a selected file, and returns to upload after removal', () => {
  const file = path.resolve(__dirname, '../src/pages/Products.tsx');
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let upload;
  const visit = node => {
    if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(prop =>
      ts.isJsxAttribute(prop) && prop.name.getText(ast) === 'className' && prop.initializer?.text === 'import-upload')) upload = node;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(upload);
  const noop = () => {};
  const context = {
    exports: {}, React, importFile: null, importPreviewLoading: false, importDragActive: false,
    t: key => key, formatFileSize: size => `${size} bytes`,
    handleImportDragOver: noop, handleImportDragLeave: noop, handleImportDrop: noop,
    handleImportFile: noop, importPreviewAbortRef: { current: null },
    setImportFile: value => { context.importFile = value; },
    setImportPreview: noop, setImportResult: noop, setImportError: noop,
    setImportPreviewProgress: noop, setImportPreviewLoaded: noop, setImportPreviewTotal: noop,
    setImportPreviewStage: noop,
  };
  const code = ts.transpileModule(`export const render = () => (${upload.getText(ast)});`, {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS }, fileName: 'import.tsx',
  }).outputText;
  vm.runInNewContext(code, context);
  const render = context.exports.render;
  assert.match(renderToStaticMarkup(render()), /type="file"/);
  context.importFile = { name: 'products.xlsx', size: 123 };
  const selected = render();
  assert.match(renderToStaticMarkup(selected), /products.xlsx/);
  let remove;
  const findButton = element => {
    if (!React.isValidElement(element)) return;
    if (element.type === 'button') remove = element;
    React.Children.forEach(element.props.children, findButton);
  };
  findButton(selected);
  assert.ok(remove);
  remove.props.onClick();
  assert.equal(context.importFile, null);
  assert.match(renderToStaticMarkup(render()), /type="file"/);
});
