// JSON Viewer 冒烟测试：stub DOM/chrome/CodeMirror，跑通完整链路
// 场景：浅色(coy) / 深色(monokai) / 解析失败(红色提示条)
import fs from 'fs';
import vm from 'vm';

const source = fs.readFileSync('build/json-viewer.js', 'utf8');

function makeStubs({ json, dark = false }) {
    const pre = {
        nodeName: 'PRE', textContent: json, hidden: false,
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
            removeChild() {}, insertBefore() {}, classList: { add() {} },
        },
        location: { href: 'https://api.test.com/data' },
    };

    const chromeStub = {
        storage: { sync: { get: async () => ({ extensionConfig: { features: { jsonViewer: true } } }) } },
        runtime: { getURL: (p) => '/' + p, sendMessage: (msg, cb) => cb({ success: true }) },
    };

    const window = {
        location: { href: 'https://api.test.com/data' },
        matchMedia: () => ({ matches: dark }),
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

// ============ 场景 1：浅色 coy ============
{
    const { cmCalls, pre } = await run({
        json: '{"name":"hshen","big":123456789012345678901234567890,"url":"https://hackshen.com"}',
    });
    if (cmCalls.length === 0) throw new Error('❌ CodeMirror 未被调用');
    const opts = cmCalls[0];
    console.log('✅ [浅色] 主题 =', opts.theme, '| pre.hidden =', pre.hidden);
    console.log('✅ [浅色] 头部:', opts.value.split('\n').slice(0, 2).join(' | '));
    console.log('✅ [浅色] 大数精度:', opts.value.includes('123456789012345678901234567890'));
    const nameLine = opts.value.split('\n').find((l) => l.includes('hshen'));
    if (opts.theme !== 'coy') throw new Error('浅色主题应为 coy');
    if (!pre.hidden) throw new Error('pre 未隐藏');
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(opts.value.split('\n')[0].replace('// ', ''))) {
        throw new Error('头部时间格式应为 YYYY-MM-DD HH:mm:ss');
    }
    if (!nameLine.startsWith('  "name"')) throw new Error('缩进错误');
}

// ============ 场景 2：深色 monokai ============
{
    const { cmCalls, pre } = await run({
        json: '{"dark":true}', dark: true,
    });
    const opts = cmCalls[0];
    console.log('✅ [深色] 主题 =', opts.theme, '| pre.hidden =', pre.hidden);
    if (opts.theme !== 'monokai') throw new Error('深色主题应为 monokai');
}

// ============ 场景 3：解析失败（正则通过但 JSON.parse 挂） ============
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

console.log('\n🎉 全部通过');
