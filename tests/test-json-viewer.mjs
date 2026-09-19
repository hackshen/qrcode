// JSON Viewer 冒烟测试：stub DOM/chrome/CodeMirror，跑通完整链路
// 场景：浅色(coy) / 深色(monokai) / 解析失败(红色提示条)
import fs from 'fs';
import vm from 'vm';

const source = fs.readFileSync('build/json-viewer.js', 'utf8');

function makeStubs({ json }) {
    const pre = {
        nodeName: 'PRE', textContent: json, hidden: false,
        setAttribute() {}, getAttribute() { return null; },
    };
    const cmCalls = [];
    const wrapperStub = { addEventListener() {} };
    const editorStub = {
        on() {}, off() {}, refresh() {}, focus() {}, foldCode() {},
        getWrapperElement: () => wrapperStub,
        firstLine: () => 0, lastLine: () => 3, getLine: () => '{}', lineCount: () => 4,
    };
    const CodeMirror = (target, opts) => { cmCalls.push(opts); return editorStub; };
    CodeMirror.commands = {};

    const fakeElement = () => ({
        style: { cssText: '' }, classList: { add() {} }, children: [],
        setAttribute() {}, getAttribute() { return null; },
        appendChild() {}, removeChild() {},
    });
    const editorHost = { className: '' };
    const bodyChildren = [];

    const document = {
        readyState: 'complete',
        addEventListener() {},
        getElementsByClassName: () => [editorHost],
        createElement: fakeElement,
        head: { appendChild() {} },
        body: {
            childNodes: [pre], normalize() {}, appendChild: (el) => bodyChildren.push(el),
            removeChild() {}, insertBefore() {}, classList: { add() {}, toggle() {} },
        },
        location: { href: 'https://api.test.com/data' },
    };

    const chromeStub = {
        storage: {
            sync: { get: async () => ({ extensionConfig: { features: { jsonViewer: true } } }) },
            local: { get: async () => ({}), set: async () => {} },
        },
        runtime: { getURL: (p) => '/' + p, sendMessage: (msg, cb) => cb({ success: true }) },
    };

    const window = {
        location: { href: 'https://api.test.com/data' },
    };

    const ctx = {
        console, document, chrome: chromeStub, CodeMirror, window, navigator: {},
        setTimeout, clearTimeout, setInterval, clearInterval,
        requestAnimationFrame: (cb) => setTimeout(cb, 0),
    };
    ctx.globalThis = ctx;
    return { ctx, cmCalls, bodyChildren, pre };
}

async function run(scenario) {
    const stubs = makeStubs(scenario);
    vm.createContext(stubs.ctx);
    vm.runInContext(source + '\n;undefined;', stubs.ctx, { filename: 'json-viewer.js' });
    await new Promise((r) => setTimeout(r, 100));
    return stubs;
}

// ============ 场景 1：主链路 + Key 路径推导 ============
{
    const { ctx, cmCalls, pre } = await run({
        json: '{"data":{"items":[{"id":1,"n":"a"},{"id":2}],"total":2},"big":123456789012345678901234567890}',
    });
    if (cmCalls.length === 0) throw new Error('❌ CodeMirror 未被调用');
    const opts = cmCalls[0];
    console.log('✅ [主链路] 主题 =', opts.theme, '| pre.hidden =', pre.hidden);
    console.log('✅ [主链路] 头部:', opts.value.split('\n').slice(0, 2).join(' | '));
    console.log('✅ [主链路] 大数精度:', opts.value.includes('123456789012345678901234567890'));
    if (opts.theme !== 'coy') throw new Error('主题应为 coy');
    if (!pre.hidden) throw new Error('pre 未隐藏');
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(opts.value.split('\n')[0].replace('// ', ''))) {
        throw new Error('头部时间格式应为 YYYY-MM-DD HH:mm:ss');
    }

    // Key 路径推导（computePath 以格式化文本行为单位，头部占 3 行）
    const computePath = ctx.window.__jsonViewerComputePath;
    if (typeof computePath !== 'function') throw new Error('未暴露 __jsonViewerComputePath');
    const valueLines = opts.value.split('\n');
    const lineOf = (substr) => valueLines.findIndex((l) => l.includes(substr));
    const cases = [
        ['"id": 1', '.data.items[0].id'],
        ['"n": "a"', '.data.items[0].n'],
        ['"id": 2', '.data.items[1].id'],
        ['"total": 2', '.data.total'],
        ['"big":', '.big'],
        ['"data": {', '.data'],        // 容器 key：值为对象，悬停本行 = 容器自身路径
        ['"items": [', '.data.items'], // 容器 key：值为数组
    ];
    for (const [substr, expected] of cases) {
        const got = computePath(lineOf(substr));
        console.log('✅ [路径]', substr, '→', got);
        if (got !== expected) throw new Error(`路径错误: ${substr} 应为 ${expected}，得到 ${got}`);
    }
    // 第三个裸 { 行（根、item0、item1）→ 第二个数组元素自身路径
    const bareBraceLines = valueLines
        .map((l, i) => (l.trim() === '{' ? i : -1))
        .filter((i) => i >= 0);
    const elemPath = computePath(bareBraceLines[2]);
    console.log('✅ [路径] 数组第2个元素 →', elemPath);
    if (elemPath !== '.data.items[1]') throw new Error(`数组元素路径错误: ${elemPath}`);

    // items 数组的收尾 ] 行 → 数组自身路径（不带元素下标）
    const itemsCloseLine = valueLines.findIndex((l, i) => i > bareBraceLines[0] && /^\s*\]/.test(l));
    const arrOwnPath = computePath(itemsCloseLine);
    console.log('✅ [路径] 数组收尾 ] →', arrOwnPath);
    if (arrOwnPath !== '.data.items') throw new Error(`数组收尾路径错误: ${arrOwnPath}`);
}

// ============ 场景 2：解析失败（正则通过但 JSON.parse 挂） ============
{
    const { cmCalls, bodyChildren, pre } = await run({
        json: '{"name":"hshen",}', // 尾逗号：过正则、parse 失败
    });
    console.log('✅ [解析失败] CM 调用次数 =', cmCalls.length, '| 提示条 =',
        bodyChildren.some((el) => (el.style || {}).cssText && el.style.cssText.includes('#f2dede')),
        '| pre.hidden =', pre.hidden);
    if (cmCalls.length !== 0) throw new Error('解析失败不应渲染 CM');
    if (!bodyChildren.some((el) => (el.style || {}).cssText && el.style.cssText.includes('#f2dede'))) {
        throw new Error('应显示红色解析失败提示条');
    }
    if (pre.hidden) throw new Error('解析失败应显示原文');
}

// ============ 场景 3：智能值预览 ============
{
    const { ctx, cmCalls } = await run({
        json: '{"ts":1736123456,"ms":1736123456789,"iso":"2026-09-12T10:00:00","color":"#ff5500","img":"https://a.com/b.png","plain":"hello"}',
    });
    const preview = ctx.window.__jsonViewerPreviewValue;
    const valueLines = cmCalls[0].value.split('\n');
    const lineOf = (s) => valueLines.findIndex((l) => l.includes(s));
    const cases = [
        ['"ts":', 'time'], ['"ms":', 'time'], ['"iso":', 'time'],
        ['"color":', 'color'], ['"img":', 'image'],
    ];
    for (const [substr, type] of cases) {
        const got = preview(lineOf(substr));
        console.log('✅ [预览]', substr, '→', got && got.type, got && (got.text || got.value || got.url || ''));
        if (!got || got.type !== type) throw new Error(`${substr} 预览类型应为 ${type}，得到 ${JSON.stringify(got)}`);
    }
    if (preview(lineOf('"plain":')) !== null) throw new Error('普通字符串不应有预览');
}

// ============ 场景 4：NDJSON（逐行 JSON 日志） ============
{
    const { ctx, cmCalls, pre } = await run({
        json: '{"a":1,"t":"x"}\n\n{"a":2,"t":"y"}\n{"a":3,"t":"z"}',
    });
    console.log('✅ [NDJSON] pre.hidden =', pre.hidden, '| 首行内容:', cmCalls[0].value.split('\n')[3]);
    if (!cmCalls.length) throw new Error('NDJSON 未渲染');
    if (!cmCalls[0].value.split('\n')[3].trim().startsWith('[')) throw new Error('NDJSON 应包装为数组');
    const computePath = ctx.window.__jsonViewerComputePath;
    const valueLines = cmCalls[0].value.split('\n');
    const aLines = valueLines.map((l, i) => (l.includes('"a":') ? i : -1)).filter((i) => i >= 0);
    const p0 = computePath(aLines[0]);
    const p2 = computePath(aLines[2]);
    console.log('✅ [NDJSON] 路径:', p0, p2);
    if (p0 !== '[0].a' || p2 !== '[2].a') throw new Error(`NDJSON 路径错误: ${p0}, ${p2}`);
}

console.log('\n🎉 全部通过');
