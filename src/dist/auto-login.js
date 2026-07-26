// ============ Auto-Login（自动登录填充）============
// 任意网页注入悬浮球：已配置站点点击列凭证→选中填账号密码并提交；
// 未配置站点点击进入"捕获"流程，手动点选登录页各框后复用。
// 领域语言见 /CONTEXT.md；明文存储取舍见 /docs/adr/0001-plaintext-credential-storage.md
// 作为 content script 与 inject.js 共享 window（manifest content_scripts 按序加载，inject.js 在前）

(function () {
    'use strict';

    // 仅顶层框架出球，避免每个 iframe 都挂一个
    if (window.top !== window) return;

    const AL = window.DevKitAutoLogin || (window.DevKitAutoLogin = {});
    const TAG = '[Auto Login]';

    // ============ 常量 ============
    const STORAGE_PROFILES = 'autoLoginProfiles';
    const STORAGE_BALL = 'autoLoginBallPrefs';
    const SCORE_THRESHOLD = 0.5;     // 指纹匹配最低分
    const DRAG_THRESHOLD = 5;        // px，小于此位移视为点击
    const HOST_ID = 'devkit-al-host';

    // ============ eTLD+1 提取 ============
    // 内置常见多段有效后缀；其余按"最后两段"兜底。
    // 注意：src/options.js 内有一份同样实现（classic script 与 React module 跨环境共享代价高），
    // 改动需同步，两处函数头注释互指。
    const EFFECTIVE_SUFFIXES = new Set([
        'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk',
        'com.cn', 'org.cn', 'net.cn', 'gov.cn', 'edu.cn', 'ac.cn',
        'com.hk', 'org.hk', 'net.hk', 'edu.hk', 'gov.hk',
        'com.tw', 'org.tw', 'net.tw',
        'com.au', 'net.au', 'org.au', 'edu.au',
        'co.jp', 'co.kr', 'or.kr', 'ne.jp', 'or.jp', 'ac.jp',
        'co.in', 'net.in', 'org.in', 'gen.in', 'firm.in', 'ind.in',
        'com.br', 'org.br', 'net.br', 'gov.br',
        'com.sg', 'edu.sg', 'gov.sg', 'com.mx', 'org.mx', 'net.mx', 'gob.mx',
        'co.nz', 'net.nz', 'org.nz', 'co.za', 'org.za', 'net.za',
        'com.tr', 'edu.tr', 'gov.tr', 'biz.tr', 'info.tr',
        'com.my', 'org.my', 'gov.my', 'edu.my', 'com.ph', 'com.vn', 'com.ar', 'com.pe', 'com.co',
        'github.io', 'gitlab.io', 'bitbucket.io', 'surge.sh', 'herokuapp.com',
    ]);

    function getETldPlus1(host) {
        host = String(host || '').toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');
        if (!host) return '';
        const parts = host.split('.');
        if (parts.length <= 2) return host;
        const last2 = parts.slice(-2).join('.');
        if (EFFECTIVE_SUFFIXES.has(last2)) return parts.slice(-3).join('.');
        return last2;
    }
    AL.getETldPlus1 = getETldPlus1;

    // ============ DOM 工具 ============

    function isVisible(el) {
        if (!el || !el.getClientRects) return false;
        const rects = el.getClientRects();
        if (!rects.length) return false;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    function cssEscape(s) {
        if (window.CSS && CSS.escape) return CSS.escape(s);
        return String(s).replace(/[^a-zA-Z0-9_-]/g, function (m) { return '\\' + m; });
    }
    function cssAttrEscape(s) {
        return String(s).replace(/["\\]/g, function (m) { return '\\' + m; });
    }

    // 生成稳定 CSS selector（仅作指纹失配时的兜底）
    function uniqueSelector(el) {
        if (el.id) {
            try {
                if (document.querySelectorAll('#' + cssEscape(el.id)).length === 1) return '#' + cssEscape(el.id);
            } catch (e) { /* id 含特殊字符，走兜底 */ }
        }
        if (el.name) return el.tagName.toLowerCase() + '[name="' + cssAttrEscape(el.name) + '"]';
        const parts = [];
        let cur = el;
        while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
            let part = cur.tagName.toLowerCase();
            if (cur.id) {
                try {
                    if (document.querySelectorAll('#' + cssEscape(cur.id)).length === 1) {
                        parts.unshift('#' + cssEscape(cur.id));
                        break;
                    }
                } catch (e) { /* ignore */ }
            }
            const parent = cur.parentElement;
            if (parent) {
                const sameTag = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === cur.tagName; });
                if (sameTag.length > 1) {
                    part += ':nth-child(' + (Array.prototype.indexOf.call(parent.children, cur) + 1) + ')';
                }
            }
            parts.unshift(part);
            cur = parent;
        }
        return parts.join(' > ');
    }

    // 递归收集元素（穿透 open shadow root）
    function collectAll(root, selector) {
        const out = [];
        function walk(node) {
            node.querySelectorAll(selector).forEach(function (n) {
                out.push(n);
                if (n.shadowRoot) walk(n.shadowRoot);
            });
            node.querySelectorAll('*').forEach(function (n) {
                if (n.shadowRoot) walk(n.shadowRoot);
            });
        }
        walk(root);
        return out;
    }

    function inputType(el) {
        return (el.type || '').toLowerCase();
    }

    function isInOurShadow(el) {
        return !!(el && el.closest && el.closest('#' + HOST_ID));
    }

    // ============ 语义指纹 ============

    function generateFingerprint(el) {
        const labelText = (document.querySelector('label[for="' + cssAttrEscape(el.id || '') + '"]') || {}).textContent
            || (el.closest('label') || {}).textContent || '';
        return {
            tag: el.tagName,
            type: inputType(el),
            name: el.name || '',
            id: el.id || '',
            placeholder: el.placeholder || '',
            autocomplete: (el.autocomplete || '').toLowerCase(),
            ariaLabel: el.getAttribute('aria-label') || '',
            role: el.getAttribute('role') || '',
            labelText: String(labelText).trim().slice(0, 40),
        };
    }

    const FP_WEIGHTS = { name: 3, id: 3, type: 2, autocomplete: 2, placeholder: 1, ariaLabel: 1, labelText: 1, role: 1 };

    function scoreFingerprint(cand, stored) {
        if (!stored) return 0;
        let earned = 0, total = 0;
        Object.keys(FP_WEIGHTS).forEach(function (k) {
            const w = FP_WEIGHTS[k];
            const s = (stored[k] || '').toLowerCase();
            if (s) {
                total += w;
                const c = (cand[k] || '').toLowerCase();
                if (c && (c === s || s.indexOf(c) > -1 || c.indexOf(s) > -1)) earned += w;
            }
        });
        return total === 0 ? 0 : earned / total;
    }

    // ============ 元素定位（填充时） ============

    // 按角色 + scope（密码框所在 form）收集候选
    function getCandidates(role, scope, anchorEl) {
        scope = scope || document;
        const allInputs = collectAll(scope, 'input, textarea');
        const visibleInputs = allInputs.filter(function (el) { return isVisible(el) && !isInOurShadow(el); });
        if (role === 'password') {
            return visibleInputs.filter(function (el) { return el.tagName === 'INPUT' && inputType(el) === 'password'; });
        }
        if (role === 'username') {
            return visibleInputs.filter(function (el) {
                if (el.tagName !== 'INPUT') return false;
                const t = inputType(el);
                return t === 'text' || t === 'email' || t === 'tel' || t === 'number' || t === 'search' || t === '';
            });
        }
        if (role === 'captcha') {
            return visibleInputs.filter(function (el) {
                if (el === anchorEl) return false;
                const sig = [el.name, el.id, el.placeholder, el.getAttribute('aria-label')].join(' ').toLowerCase();
                return /captcha|verify|code|验证|verif/.test(sig) || inputType(el) === 'text' || inputType(el) === '';
            });
        }
        if (role === 'submit') {
            const btns = collectAll(scope, 'button, input[type=submit], input[type=button], [role=button], a');
            return btns.filter(function (el) { return isVisible(el) && !isInOurShadow(el); });
        }
        return [];
    }

    function locateByBinding(part, scope, anchorEl) {
        if (!part) return null;
        // 1. selector 兜底
        if (part.selector) {
            try {
                const el = (scope || document).querySelector(part.selector);
                if (el && isVisible(el)) return el;
            } catch (e) { /* 非法 selector，忽略 */ }
        }
        // 2. 指纹匹配
        const candidates = getCandidates(part.role, scope, anchorEl);
        let best = null, bestScore = 0;
        candidates.forEach(function (c) {
            const score = scoreFingerprint(generateFingerprint(c), part.fingerprint || {});
            if (score > bestScore) { bestScore = score; best = c; }
        });
        if (best && bestScore >= SCORE_THRESHOLD) return best;
        return null;
    }

    // ============ 存储（chrome.storage.local）============

    function storageGet(key) {
        return new Promise(function (resolve) {
            chrome.storage.local.get(key, function (r) { resolve(r[key] || null); });
        });
    }
    function storageSet(obj) {
        return new Promise(function (resolve) { chrome.storage.local.set(obj, function () { resolve(); }); });
    }

    async function loadAllProfiles() {
        return (await storageGet(STORAGE_PROFILES)) || {};
    }
    async function loadProfile(eTld) {
        const all = await loadAllProfiles();
        return all[eTld] || null;
    }
    async function saveProfile(eTld, profile) {
        const all = await loadAllProfiles();
        all[eTld] = Object.assign({}, all[eTld], profile, { updatedAt: Date.now() });
        await storageSet({ [STORAGE_PROFILES]: all });
    }
    async function deleteProfile(eTld) {
        const all = await loadAllProfiles();
        delete all[eTld];
        await storageSet({ [STORAGE_PROFILES]: all });
    }
    async function upsertCredential(eTld, cred) {
        const profile = await loadProfile(eTld);
        if (!profile) return;
        const list = profile.credentials || [];
        const idx = list.findIndex(function (c) { return c.id === cred.id; });
        if (idx > -1) list[idx] = cred; else list.push(cred);
        profile.credentials = list;
        await saveProfile(eTld, profile);
    }
    async function removeCredential(eTld, credId) {
        const profile = await loadProfile(eTld);
        if (!profile) return;
        profile.credentials = (profile.credentials || []).filter(function (c) { return c.id !== credId; });
        await saveProfile(eTld, profile);
    }

    async function loadBallPrefs(eTld) {
        const all = (await storageGet(STORAGE_BALL)) || {};
        return all[eTld] || { hidden: false, pos: null };
    }
    async function saveBallPrefs(eTld, prefs) {
        const all = (await storageGet(STORAGE_BALL)) || {};
        all[eTld] = Object.assign({}, all[eTld], prefs);
        await storageSet({ [STORAGE_BALL]: all });
    }

    // 全局开关（存于 sync extensionConfig）
    async function getGlobalConfig() {
        return new Promise(function (resolve) {
            chrome.storage.sync.get('extensionConfig', function (r) {
                const cfg = (r && r.extensionConfig) || {};
                resolve({
                    enabled: !(cfg.features && cfg.features.autoLogin === false),
                    showBall: !(cfg.autoLogin && cfg.autoLogin.showBall === false),
                });
            });
        });
    }

    // ============ 运行时状态 ============
    const state = {
        currentETld: '',
        profile: null,        // 当前站点 Site Profile
        host: null,           // Shadow DOM host 元素
        shadow: null,
        ballEl: null,
        panelEl: null,
        toastEl: null,
        panelOpen: false,
        ballPrefs: { hidden: false, pos: null },
        global: { enabled: true, showBall: true },
        capture: null,        // 捕获状态机
    };

    // 复用 inject.js 的 fillInput（受控组件兼容）
    const fillInput = window.__devkitFillInput || function (input, text) {
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
    };

    // ============ Shadow DOM 样式 ============
    const STYLES = `
        :host { all: initial; }
        * { box-sizing: border-box; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
        #al-ball {
            position: fixed; z-index: 2147483646;
            width: 48px; height: 48px; border-radius: 50%;
            background: linear-gradient(135deg, #667eea, #764ba2);
            box-shadow: 0 4px 14px rgba(0,0,0,.3); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            color: #fff; font-size: 22px; user-select: none;
            transition: transform .15s; pointer-events: auto;
        }
        #al-ball:hover { transform: scale(1.08); }
        #al-ball.hidden { display: none; }
        #al-panel {
            position: fixed; z-index: 2147483646;
            min-width: 220px; max-width: 280px;
            background: #fff; border-radius: 10px;
            box-shadow: 0 8px 28px rgba(0,0,0,.22);
            padding: 10px; color: #333; font-size: 13px;
            pointer-events: auto; display: none;
        }
        #al-panel.show { display: block; }
        .al-title { font-weight: 600; font-size: 13px; margin: 2px 4px 8px; display:flex; justify-content:space-between; align-items:center; }
        .al-domain { color:#999; font-weight:400; font-size:11px; }
        .al-cred { padding: 8px 10px; border-radius: 8px; cursor: pointer; display:flex; align-items:center; gap:8px; }
        .al-cred:hover { background: #f3f4f9; }
        .al-cred .u { font-weight:500; }
        .al-cred .n { color:#999; font-size:11px; margin-left:auto; }
        .al-empty { padding: 16px 8px; text-align:center; color:#999; }
        .al-btn { width:100%; margin-top:8px; padding:8px; border:none; border-radius:8px; cursor:pointer; font-size:13px; }
        .al-btn-primary { background: linear-gradient(135deg,#667eea,#764ba2); color:#fff; }
        .al-btn-ghost { background:#f3f4f9; color:#555; }
        .al-link { background:none; border:none; color:#888; cursor:pointer; font-size:12px; padding:4px; }
        .al-row { display:flex; gap:6px; margin-top:8px; }
        .al-row .al-btn { margin-top:0; }
        #al-toast {
            position: fixed; z-index: 2147483647; left:50%; top:24px; transform: translateX(-50%);
            background: rgba(40,40,40,.92); color:#fff; padding:10px 16px; border-radius:8px;
            font-size:13px; pointer-events:none; opacity:0; transition: opacity .2s;
        }
        #al-toast.show { opacity:1; }
        #al-toast.error { background: rgba(180,40,40,.92); }
        #al-toast.success { background: rgba(40,130,60,.92); }
        #al-capture-mask {
            position: fixed; inset:0; z-index: 2147483645; cursor: crosshair;
            background: transparent; pointer-events: auto;
        }
        #al-capture-hint {
            position: fixed; top:0; left:0; right:0; z-index:2147483647;
            background: linear-gradient(135deg,#667eea,#764ba2); color:#fff;
            padding:10px 16px; font-size:14px; display:flex; align-items:center; gap:12px;
            justify-content:center; pointer-events:none;
        }
        #al-capture-hint .al-cap-actions { pointer-events:auto; display:flex; gap:8px; }
        #al-capture-hint button { background:rgba(255,255,255,.25); border:none; color:#fff; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:12px; }
        #al-capture-hint button.skip { background:rgba(0,0,0,.25); }
        #al-capture-highlight {
            position: fixed; z-index:2147483644; border:2px solid #667eea; background:rgba(102,126,234,.12);
            pointer-events:none; display:none;
        }
    `;

    // ============ UI：悬浮球与面板 ============

    function ensureBall() {
        if (state.host) return;
        const host = document.createElement('div');
        host.id = HOST_ID;
        host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483646;pointer-events:none;';
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = STYLES;
        shadow.appendChild(style);

        const ball = document.createElement('div');
        ball.id = 'al-ball';
        ball.textContent = '🔐';
        shadow.appendChild(ball);

        const panel = document.createElement('div');
        panel.id = 'al-panel';
        shadow.appendChild(panel);

        const toast = document.createElement('div');
        toast.id = 'al-toast';
        shadow.appendChild(toast);

        document.documentElement.appendChild(host);
        state.host = host; state.shadow = shadow;
        state.ballEl = ball; state.panelEl = panel; state.toastEl = toast;

        makeDraggable(ball);
        ball.addEventListener('click', function (e) {
            if (ball._dragged) { ball._dragged = false; return; }
            togglePanel();
        });

        // 点面板外关闭
        document.addEventListener('click', function (e) {
            if (!state.panelOpen) return;
            if (isInOurShadow(e.target)) return;
            hidePanel();
        }, true);
    }

    function makeDraggable(ball) {
        let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
        ball.addEventListener('pointerdown', function (e) {
            const r = ball.getBoundingClientRect();
            sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
            dragging = true; ball._dragged = false;
            ball.setPointerCapture(e.pointerId);
        });
        ball.addEventListener('pointermove', function (e) {
            if (!dragging) return;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
            ball._dragged = true;
            let nx = ox + dx, ny = oy + dy;
            const cw = window.innerWidth, ch = window.innerHeight;
            nx = Math.max(4, Math.min(cw - 52, nx));
            ny = Math.max(4, Math.min(ch - 52, ny));
            ball.style.left = nx + 'px';
            ball.style.top = ny + 'px';
            ball.style.right = 'auto'; ball.style.bottom = 'auto';
            if (state.panelEl && state.panelEl.classList.contains('show')) positionPanel();
        });
        ball.addEventListener('pointerup', function (e) {
            if (!dragging) return;
            dragging = false;
            try { ball.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            if (ball._dragged) {
                const r = ball.getBoundingClientRect();
                saveBallPrefs(state.currentETld, { pos: { x: Math.round(r.left), y: Math.round(r.top) } });
            }
        });
    }

    function applyBallPosition() {
        const ball = state.ballEl; if (!ball) return;
        const pos = state.ballPrefs.pos;
        if (pos && typeof pos.x === 'number') {
            ball.style.left = pos.x + 'px'; ball.style.top = pos.y + 'px';
            ball.style.right = 'auto'; ball.style.bottom = 'auto';
        } else {
            ball.style.right = '24px'; ball.style.bottom = '120px';
            ball.style.left = 'auto'; ball.style.top = 'auto';
        }
    }

    function positionPanel() {
        const ball = state.ballEl, panel = state.panelEl;
        if (!ball || !panel) return;
        const r = ball.getBoundingClientRect();
        const pw = panel.offsetWidth, ph = panel.offsetHeight;
        let left = r.left, top = r.top - ph - 10;
        if (top < 8) top = r.top + r.height + 10;
        if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
        if (left < 8) left = 8;
        panel.style.left = left + 'px'; panel.style.top = top + 'px';
    }

    function togglePanel() { state.panelOpen ? hidePanel() : showPanel(); }

    function showPanel() {
        if (!state.panelEl) return;
        renderPanel();
        state.panelEl.classList.add('show');
        state.panelOpen = true;
        positionPanel();
    }
    function hidePanel() {
        if (!state.panelEl) return;
        state.panelEl.classList.remove('show');
        state.panelOpen = false;
    }

    function renderPanel() {
        const panel = state.panelEl;
        const profile = state.profile;
        const domain = state.currentETld || '当前站点';
        let html = '<div class="al-title"><span>🔐 Auto-Login</span><span class="al-domain">' + esc(domain) + '</span></div>';
        if (profile && profile.credentials && profile.credentials.length) {
            const sorted = profile.credentials.slice().sort(function (a, b) { return (b.lastUsed || 0) - (a.lastUsed || 0); });
            sorted.forEach(function (c) {
                html += '<div class="al-cred" data-id="' + esc(c.id) + '"><span class="u">' + esc(c.username || '(空)') + '</span>'
                    + (c.note ? '<span class="n">' + esc(c.note) + '</span>' : '') + '</div>';
            });
        } else {
            html += '<div class="al-empty">本站尚未配置凭证<br>先「捕获登录框」再添加凭证</div>';
        }
        const hasBinding = !!(profile && profile.fieldBinding && profile.fieldBinding.submit);
        html += '<div class="al-row"><button class="al-btn al-btn-primary" data-act="capture">' + (hasBinding ? '⚙ 重新捕获' : '⚙ 捕获登录框') + '</button></div>';
        html += '<div class="al-row"><button class="al-btn al-btn-ghost" data-act="hide">在此站点隐藏</button></div>';
        panel.innerHTML = html;

        panel.querySelectorAll('.al-cred').forEach(function (el) {
            el.addEventListener('click', function () {
                const id = el.getAttribute('data-id');
                const cred = (profile.credentials || []).find(function (c) { return c.id === id; });
                if (cred) fillAndSubmit(cred);
            });
        });
        panel.querySelector('[data-act="capture"]').addEventListener('click', function () { hidePanel(); startCapture(); });
        panel.querySelector('[data-act="hide"]').addEventListener('click', function () {
            state.ballPrefs.hidden = true;
            saveBallPrefs(state.currentETld, { hidden: true });
            hideBall(); hidePanel();
        });
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
    }

    function showBall() { if (state.ballEl) state.ballEl.classList.remove('hidden'); }
    function hideBall() { if (state.ballEl) state.ballEl.classList.add('hidden'); }

    function toast(msg, type) {
        if (!state.toastEl) return;
        state.toastEl.textContent = msg;
        state.toastEl.className = 'show ' + (type || '');
        clearTimeout(state._toastTimer);
        state._toastTimer = setTimeout(function () { state.toastEl.className = ''; }, 2200);
    }
    AL.toast = toast;

    // ============ 捕获模式（状态机）============

    const CAPTURE_STEPS = [
        { role: 'username', label: '1/4 点击账号输入框', skippable: false },
        { role: 'password', label: '2/4 点击密码输入框', skippable: false, expectType: 'password' },
        { role: 'captcha', label: '3/4 点击验证码框（无验证码可跳过）', skippable: true },
        { role: 'submit', label: '4/4 点击登录按钮', skippable: false },
    ];

    function startCapture() {
        ensureCaptureOverlay();
        state.capture.stepIdx = 0;
        state.capture.picks = {};
        state.capture._active = true;
        updateCaptureHint();
        state.capture.mask.style.display = 'block';
        document.addEventListener('keydown', onCaptureKey, true);
        console.log(TAG, '进入捕获模式');
    }

    function ensureCaptureOverlay() {
        if (state.capture && state.capture.mask) return;
        const shadow = state.shadow;
        const mask = document.createElement('div'); mask.id = 'al-capture-mask'; mask.style.display = 'none';
        const hint = document.createElement('div'); hint.id = 'al-capture-hint';
        const highlight = document.createElement('div'); highlight.id = 'al-capture-highlight';
        shadow.appendChild(mask); shadow.appendChild(hint); shadow.appendChild(highlight);

        mask.addEventListener('mousemove', onCaptureHover);
        mask.addEventListener('click', onCaptureClick);

        state.capture = state.capture || {};
        state.capture.mask = mask; state.capture.hint = hint; state.capture.highlight = highlight;
    }

    function currentStep() { return CAPTURE_STEPS[state.capture.stepIdx]; }

    function updateCaptureHint() {
        const step = currentStep();
        const hint = state.capture.hint;
        let html = '<span>' + step.label + '</span><div class="al-cap-actions">';
        html += '<button class="skip" data-cap="cancel">✕ 取消(Esc)</button>';
        if (step.skippable) html += '<button data-cap="skip">跳过</button>';
        if (state.capture.stepIdx > 0) html += '<button data-cap="back">上一步</button>';
        html += '</div>';
        hint.innerHTML = html;
        hint.style.display = 'flex';
        hint.querySelector('[data-cap="cancel"]').addEventListener('click', function (e) { e.stopPropagation(); cancelCapture(); });
        if (step.skippable) hint.querySelector('[data-cap="skip"]').addEventListener('click', function (e) { e.stopPropagation(); skipCapture(); });
        if (state.capture.stepIdx > 0) hint.querySelector('[data-cap="back"]').addEventListener('click', function (e) { e.stopPropagation(); backCapture(); });
    }

    function elementAtPoint(x, y) {
        const els = document.elementsFromPoint(x, y);
        for (let i = 0; i < els.length; i++) {
            const el = els[i];
            if (isInOurShadow(el)) continue;
            return el;
        }
        return null;
    }

    function onCaptureHover(e) {
        const el = elementAtPoint(e.clientX, e.clientY);
        const hl = state.capture.highlight;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.tagName === 'A')) {
            const r = el.getBoundingClientRect();
            hl.style.display = 'block';
            hl.style.left = r.left + 'px'; hl.style.top = r.top + 'px';
            hl.style.width = r.width + 'px'; hl.style.height = r.height + 'px';
        } else {
            hl.style.display = 'none';
        }
    }

    function onCaptureClick(e) {
        const el = elementAtPoint(e.clientX, e.clientY);
        if (!el) return;
        const step = currentStep();
        // 基本校验
        if (step.expectType === 'password' && !(el.tagName === 'INPUT' && inputType(el) === 'password')) {
            if (!window.confirm('该元素不是密码输入框（type=password），确认选它？')) return;
        }
        state.capture.picks[step.role] = {
            role: step.role,
            fingerprint: generateFingerprint(el),
            selector: uniqueSelector(el),
            _el: el,
        };
        advanceCapture();
    }

    function advanceCapture() {
        if (state.capture.stepIdx >= CAPTURE_STEPS.length - 1) {
            finishCapture();
            return;
        }
        state.capture.stepIdx++;
        updateCaptureHint();
    }

    function skipCapture() {
        const step = currentStep();
        state.capture.picks[step.role] = null;
        advanceCapture();
    }

    function backCapture() {
        if (state.capture.stepIdx > 0) {
            state.capture.stepIdx--;
            updateCaptureHint();
        }
    }

    function onCaptureKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); cancelCapture(); }
    }

    async function finishCapture() {
        const picks = state.capture.picks;
        const binding = {
            username: picks.username,
            password: picks.password,
            captcha: picks.captcha || null,
            submit: picks.submit,
        };
        // 清理临时 _el
        Object.keys(binding).forEach(function (k) { if (binding[k]) delete binding[k]._el; });

        const eTld = state.currentETld;
        const existing = await loadProfile(eTld);
        const profile = Object.assign({ credentials: [] }, existing || {}, { fieldBinding: binding });
        await saveProfile(eTld, profile);
        state.profile = profile;

        exitCapture();
        toast('捕获成功！可在悬浮球或 options 添加凭证', 'success');
        console.log(TAG, '已保存字段绑定:', eTld, binding);
    }

    function cancelCapture() { exitCapture(); toast('已取消捕获', 'info'); }

    function exitCapture() {
        if (!state.capture) return;
        document.removeEventListener('keydown', onCaptureKey, true);
        state.capture.mask.style.display = 'none';
        state.capture.hint.style.display = 'none';
        state.capture.highlight.style.display = 'none';
        state.capture.stepIdx = 0;
        state.capture.picks = {};
        state.capture._active = false;
    }

    // ============ 填充 + 条件中止提交 ============

    async function fillAndSubmit(cred) {
        const profile = state.profile;
        if (!profile || !profile.fieldBinding) { toast('请先捕获登录框', 'error'); return; }
        const binding = profile.fieldBinding;

        const pwEl = locateByBinding(binding.password, document, null);
        if (!pwEl) { toast('未找到密码框，请重新捕获', 'error'); return; }
        const scope = pwEl.form || pwEl.closest('form') || document;

        const userEl = locateByBinding(binding.username, scope, pwEl);
        if (!userEl) { toast('未找到账号框，请重新捕获', 'error'); return; }
        const subEl = locateByBinding(binding.submit, scope, pwEl);
        if (!subEl) { toast('未找到登录按钮，请重新捕获', 'error'); return; }

        fillInput(userEl, cred.username || '');
        fillInput(pwEl, cred.password || '');

        // 条件中止：绑定了验证码框且为空 → 不提交
        if (binding.captcha) {
            const capEl = locateByBinding(binding.captcha, scope, pwEl);
            if (capEl && (capEl.value || '').trim() === '') {
                hidePanel();
                toast('已填账号密码，请填写验证码后手动提交', 'info');
                try { capEl.focus(); } catch (e) { /* ignore */ }
                await upsertCredential(state.currentETld, Object.assign({}, cred, { lastUsed: Date.now() }));
                return;
            }
        }

        hidePanel();
        try { subEl.click(); } catch (e) { console.error(TAG, '提交失败:', e); }
        toast('已提交登录', 'success');
        await upsertCredential(state.currentETld, Object.assign({}, cred, { lastUsed: Date.now() }));
        console.log(TAG, '已填充并提交:', cred.username);
    }
    AL.fillAndSubmit = fillAndSubmit;

    // ============ SPA 路由适配 ============

    function hookSpaRouting() {
        const fire = function () { window.dispatchEvent(new Event('devkit:al-route')); };
        ['pushState', 'replaceState'].forEach(function (k) {
            const orig = history[k];
            history[k] = function () {
                const r = orig.apply(this, arguments);
                try { fire(); } catch (e) { /* ignore */ }
                return r;
            };
        });
        window.addEventListener('popstate', fire);
        let t;
        window.addEventListener('devkit:al-route', function () {
            clearTimeout(t);
            t = setTimeout(onRouteChange, 300);
        });
    }

    function onRouteChange() {
        const eTld = getETldPlus1(location.hostname);
        if (eTld !== state.currentETld) {
            state.currentETld = eTld;
            hidePanel();
            refreshBall();
        }
    }

    // ============ 同步与刷新 ============

    async function refreshBall() {
        state.global = await getGlobalConfig();
        if (!state.global.enabled || !state.global.showBall) { hideBall(); return; }

        const eTld = getETldPlus1(location.hostname);
        state.currentETld = eTld;
        state.profile = await loadProfile(eTld);
        state.ballPrefs = await loadBallPrefs(eTld);

        ensureBall();
        applyBallPosition();
        if (state.ballPrefs.hidden) hideBall(); else showBall();
        if (state.panelOpen) renderPanel();
    }

    function onStorageChanged(changes, area) {
        if (area === 'local' && (changes[STORAGE_PROFILES] || changes[STORAGE_BALL])) {
            refreshBall();
        } else if (area === 'sync' && changes.extensionConfig) {
            refreshBall();
        }
    }

    // ============ 入口 ============

    function init() {
        if (window.__autoLoginInited) return;
        window.__autoLoginInited = true;
        try {
            hookSpaRouting();
            chrome.storage.onChanged.addListener(onStorageChanged);
            refreshBall();
            console.log(TAG, '已初始化 @', location.hostname);
        } catch (e) {
            console.error(TAG, '初始化失败:', e);
        }
    }

    // document_start 时 documentElement 已就绪
    if (document.documentElement) init();
    else document.addEventListener('readystatechange', function () { if (document.documentElement) init(); });
})();
