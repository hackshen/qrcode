/**
 * E2E 冒烟测试：无头 Chrome 真实加载 build/ 扩展
 * 覆盖：background 启动 / JSON 高亮（含 contentType 防闪屏路径）/ options 渲染 /
 *       HTTP 规则一次性迁移 / sidepanel 渲染 / DNR 动态规则
 * 运行：npm run test:e2e
 */
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD = resolve(__dirname, '../build');
// 注意：branded Chrome 137+ 移除了 --load-extension，需用 Chrome for Testing（保留该能力）
const CHROME =
    process.env.E2E_CHROME ||
    '/Users/hshen/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
};

// 本地 JSON 服务：application/json + 足够大的响应（验证流式防闪屏路径）
const JSON_BODY = JSON.stringify({
    ok: true,
    items: Array.from({ length: 50 }, (_, i) => ({
        id: i,
        name: `item-${i}`,
        link: `https://example.com/${i}`,
        nested: { ts: 1758000000000, color: '#096dd9' },
    })),
});
const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON_BODY);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const jsonUrl = `http://127.0.0.1:${server.address().port}/api/data`;

const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [
        `--disable-extensions-except=${BUILD}`,
        `--load-extension=${BUILD}`,
        '--no-first-run',
        '--disable-gpu',
    ],
});

try {
    // ---- 扩展 ID（来自 background service worker target）----
    const swTarget = await browser.waitForTarget(
        (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
        { timeout: 10000 }
    );
    const extId = new URL(swTarget.url()).host;
    check('background service worker 已启动', true, extId);

    const extPage = async (path) => {
        const page = await browser.newPage();
        await page.goto(`chrome-extension://${extId}/${path}`, { waitUntil: 'networkidle0' });
        return page;
    };

    // ---- 1. JSON 高亮（application/json，走防闪屏的 contentType 分支）----
    {
        const page = await browser.newPage();
        await page.goto(jsonUrl, { waitUntil: 'domcontentloaded' });
        try {
            await page.waitForSelector('.CodeMirror', { timeout: 8000 });
            const rowCount = await page.$$eval('.CodeMirror-code .CodeMirror-line', (els) => els.length);
            check('JSON 高亮渲染（CodeMirror）', rowCount > 0, `${rowCount} 行`);
        } catch {
            check('JSON 高亮渲染（CodeMirror）', false);
        }
        await page.close();
    }

    // ---- 2. HTTP 规则一次性迁移 ----
    {
        const page = await extPage('options.html');
        // 预置旧结构
        await page.evaluate(async () => {
            await chrome.storage.sync.set({
                extensionConfig: {
                    features: { jsonViewer: true },
                    httpRules: [{ id: 'legacy', enabled: true, name: '旧规则', urlFilter: '*://a.b/*', headerType: 'request', headerName: 'X-Test', headerValue: '1' }],
                },
            });
            await chrome.storage.sync.remove('extensionHttpRules');
        });
        await page.reload({ waitUntil: 'networkidle0' });
        await new Promise((r) => setTimeout(r, 800)); // 等自动保存 effect
        const migrated = await page.evaluate(async () => {
            const r = await chrome.storage.sync.get(['extensionHttpRules', 'extensionConfig']);
            return {
                rules: r.extensionHttpRules,
                legacyLeft: !!(r.extensionConfig && 'httpRules' in r.extensionConfig),
            };
        });
        check(
            'HTTP 规则一次性迁移（旧结构 → extensionHttpRules）',
            Array.isArray(migrated.rules) && migrated.rules[0]?.id === 'legacy' && migrated.legacyLeft === false,
            `rules=${migrated.rules?.length}, 残留 httpRules=${migrated.legacyLeft}`
        );

        // ---- 3. options 页渲染各板块（以 h2 标题为准，样式类名不稳定）----
        const bodyText = await page.evaluate(() => document.body.innerText);
        for (const [name, text] of [
            ['options 渲染：HTTP 头规则板块', 'HTTP 头规则'],
            ['options 渲染：代理管理板块', '代理管理'],
            ['options 渲染：SourceMap 注入板块', 'SourceMap 注入'],
            ['options 渲染：功能开关板块', '功能开关'],
        ]) {
            check(name, bodyText.includes(text), text);
        }

        // ---- 4. 添加规则 → 自动落盘 + DNR 动态规则 ----
        await page.evaluate(async () => {
            const r = await chrome.storage.sync.get('extensionHttpRules');
            const rules = [...(r.extensionHttpRules || [])];
            rules.push({ id: 'e2e', enabled: true, name: 'E2E', urlFilter: '*://e2e.test/*', headerType: 'response', operation: 'set', headerName: 'X-E2E', headerValue: 'ok' });
            await chrome.storage.sync.set({ extensionHttpRules: rules });
            // 触发与 UI 相同的存储监听路径
            chrome.runtime.sendMessage('ping').catch(() => {});
        });
        await new Promise((r) => setTimeout(r, 600));
        const dnr = await page.evaluate(() => chrome.declarativeNetRequest.getDynamicRules());
        const e2eRule = dnr.find((r) => r.condition?.urlFilter === '*://e2e.test/*');
        check('DNR 动态规则生成（storage 变化 → 规则应用）', !!e2eRule, e2eRule ? `id=${e2eRule.id}` : '未找到');
        await page.close();
    }

    // ---- 5. sidepanel 页渲染 ----
    {
        const page = await extPage('sidepanel.html');
        await page.waitForSelector('.sidepanel-container', { timeout: 8000 });
        for (const [name, text] of [
            ['sidepanel 渲染：二维码板块', '二维码'],
            ['sidepanel 渲染：账号列表', '账号列表'],
            ['sidepanel 渲染：快捷操作', '快捷操作'],
        ]) {
            const found = await page.evaluate((t) => document.body.innerText.includes(t), text);
            check(name, found);
        }
        await page.close();
    }
} catch (err) {
    check('测试执行中断', false, err.message);
} finally {
    await browser.close();
    server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? '🎉 E2E 全部通过' : `💥 ${failed.length} 项失败`}（共 ${results.length} 项）`);
process.exit(failed.length === 0 ? 0 : 1);
