// JSON Viewer 冒烟测试：stub DOM/chrome/CodeMirror，跑通完整链路
import fs from 'fs';
import vm from 'vm';

const source = fs.readFileSync('build/json-viewer.js', 'utf8');

const pre = {
    nodeName: 'PRE',
    textContent: '{"name":"hshen","big":123456789012345678901234567890,"url":"https://hackshen.com"}',
    hidden: false,
    setAttribute() {}, getAttribute() { return null; },
};

const cmCalls = [];
const editorStub = {
    on() {}, off() {}, refresh() {}, focus() {}, foldCode() {},
    firstLine: () => 0, lastLine: () => 3, getLine: () => '{}', lineCount: () => 4,
};
const CodeMirror = (target, opts) => { cmCalls.push(opts); return editorStub; };
CodeMirror.commands = {};

const fakeElement = () => ({
    style: { cssText: '' }, classList: { add() {} },
    setAttribute() {}, getAttribute() { return null; },
    appendChild() {}, removeChild() {},
});

const editorHost = { className: '' };

const document = {
    readyState: 'complete',
    addEventListener() {},
    getElementsByClassName: () => [editorHost],
    createElement: fakeElement,
    head: { appendChild() {} },
    body: { childNodes: [pre], normalize() {}, appendChild() {}, removeChild() {}, insertBefore() {} },
    location: { href: 'https://api.test.com/data' },
};

const chromeStub = {
    storage: { sync: { get: async () => ({ extensionConfig: { features: { jsonViewer: true } } }) } },
    runtime: { getURL: (p) => '/' + p, sendMessage: (msg, cb) => cb({ success: true }) },
};

const ctx = {
    console, document, chrome: chromeStub, CodeMirror,
    window: { location: { href: 'https://api.test.com/data' } },
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
};
ctx.globalThis = ctx;

vm.createContext(ctx);
vm.runInContext(source + '\n;undefined;', ctx, { filename: 'json-viewer.js' });

await new Promise((r) => setTimeout(r, 100));

if (cmCalls.length === 0) throw new Error('❌ CodeMirror 未被调用');
const opts = cmCalls[0];

console.log('✅ pre.hidden =', pre.hidden);
console.log('✅ 行号 =', opts.lineNumbers, '| 折叠槽 =', opts.foldGutter, '| 只读 =', opts.readOnly, '| 主题 =', opts.theme);
console.log('✅ 时间戳头部:', opts.value.split('\n').slice(0, 2).join(' | '));
console.log('✅ 大数保留精度:', opts.value.includes('123456789012345678901234567890'));
console.log('✅ firstLineNumber 偏移(-3, 时间戳占3行):', opts.firstLineNumber);
const nameLine = opts.value.split('\n').find((l) => l.includes('hshen'));
console.log('✅ 格式化缩进:', JSON.stringify(nameLine));
if (!opts.lineNumbers) throw new Error('行号未开启');
if (!pre.hidden) throw new Error('pre 未隐藏');
if (!opts.value.startsWith('// 20')) throw new Error('时间戳头部缺失');
if (!nameLine.startsWith('  "name"')) throw new Error('缩进错误');
console.log('\n🎉 全部通过');
