// ============ JSON Viewer（JSON 页面高亮渲染）============
// 移植自 json-viewer (MIT, https://github.com/tulios/json-viewer)
// 核心链路：检测 JSON/JSONP → 大数精度保护解析 → 格式化 → CodeMirror 高亮渲染
// 配套：raw 切换 / 展开全部 / 可点击 URL / 行号 / 时间戳头部 / Ctrl-F 搜索 / 超大 JSON 保护
//
// CodeMirror 5 为懒加载：检测到 JSON 后经 background 的 chrome.scripting
// 注入（ISOLATED world 与本 content script 同世界，页面 CSP 无关），
// vendor 文件见 src/dist/vendor/codemirror/，样式见 src/dist/json-viewer.css
//
// 开关：options → features.jsonViewer（默认开启，关闭后需刷新页面）

(function () {
    'use strict';

    console.log('[JSON Viewer] ✅ 已注入:', window.location.href);

    // ============ 内置选项（按共识：硬编码全开，仅保留总开关） ============
    var INTERNAL_OPTIONS = {
        theme: 'coy',
        addons: {
            prependHeader: true,      // 时间戳头部
            maxJsonSize: 400,         // KB，超过则不自动高亮
            clickableUrls: true,      // 可点击 URL
            openLinksInNewWindow: true,
            autoHighlight: true,
            alwaysFold: false,
            sortKeys: false,
        },
        structure: {
            readOnly: true,
            lineNumbers: true,        // 行号
            firstLineNumber: 1,
            lineWrapping: true,
            foldGutter: true,         // 折叠槽
            tabSize: 2,
            indentCStyle: false,
            showArraySize: false,
        },
    };

    // ============ URL 识别（移植自 url-pattern.js, Diego Perini MIT） ============
    var URL_PATTERN = (function () {
        var relative = '(?:[/?#]\\S*)?';
        var absolute = '(?:(?:https?|ftp)://)' +      // protocol
            '(?:\\S+(?::\\S*)?@)?' +                  // user:pass
            '(?:' +
            '(?:\\[[a-f0-9.:]+\\])' +                 // IPv6
            '|' +
            '(?:[a-z0-9\\u00a1-\\uffff.-]+)' +        // hostname / IPv4
            ')(?::\\d{2,5})?' +                       // port
            relative;                                 // path
        return new RegExp('^(' + absolute + '|' + relative + ')$', 'i');
    }());

    // ============ JSON 检测（移植自 check-if-json.js / extract-json.js） ============
    function extractJSON(rawJson) {
        return rawJson
            .replace(/\s*while\((1|true)\)\s*;?/, '')
            .replace(/\s*for\(;;\)\s*;?/, '')
            .replace(/^[^{\[].+\(\s*?{/, '{')
            .replace(/}\s*?\);?\s*$/, '}');
    }

    function isJSON(jsonStr) {
        var str = jsonStr;
        if (!str || str.length === 0) return false;
        str = str.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@');
        str = str.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']');
        str = str.replace(/(?:^|:|,)(?:\s*\[)+/g, '');
        return (/^[\],:{}\s]*$/).test(str);
    }

    function isJSONP(jsonStr) {
        return isJSON(extractJSON(jsonStr));
    }

    // NDJSON/JSONL：每非空行都是独立合法 JSON（至少 2 行），整体作为数组渲染
    function isNDJSON(text) {
        if (!text || text.indexOf('\n') < 0) return false;
        var lines = text.split('\n');
        var count = 0;
        for (var i = 0; i < lines.length; i++) {
            var l = lines[i].trim();
            if (!l) continue;
            count++;
            try { JSON.parse(l); } catch (e) { return false; }
        }
        return count >= 2;
    }

    // 取真实源文本：常规/JSONP 原样；NDJSON 包装成数组（tulios 的宽松正则会放行多行文档，
    // 故以 JSON.parse 失败作为 NDJSON 分流条件）
    function getSourceText(pre) {
        var raw = pre.textContent;
        try {
            JSON.parse(extractJSON(raw));
            return raw;
        } catch (e) { /* 落到 NDJSON 判断 */ }
        if (isNDJSON(raw)) {
            var entries = raw.split('\n')
                .map(function (l) { return l.trim(); })
                .filter(function (l) { return l; });
            return '[' + entries.join(',\n') + ']';
        }
        return raw;
    }

    var bodyModified = false;

    function allTextNodes(nodes) {
        return !Object.keys(nodes).some(function (key) {
            return nodes[key].nodeName !== '#text';
        });
    }

    function getPreWithSource() {
        var childNodes = document.body.childNodes;
        if (childNodes.length === 0) return null;

        if (childNodes.length > 1 && allTextNodes(childNodes)) {
            document.body.normalize(); // 合并相邻文本节点
        }

        var childNode = childNodes[0];
        var nodeName = childNode.nodeName;
        var textContent = childNode.textContent;

        if (nodeName === 'PRE') return childNode;

        // Content-Type 为 text/html 时，body 首子节点是纯文本
        if (nodeName === '#text' && textContent.trim().length > 0) {
            var pre = document.createElement('pre');
            pre.textContent = textContent;
            document.body.removeChild(childNode);
            document.body.appendChild(pre);
            bodyModified = true;
            return pre;
        }

        return null;
    }

    function restoreNonJSONBody() {
        var artificialPre = document.body.lastChild;
        var removedChildNode = document.createElement('text');
        removedChildNode.textContent = artificialPre.textContent;
        document.body.insertBefore(removedChildNode, document.body.firstChild);
        document.body.removeChild(artificialPre);
    }

    function checkIfJson(successCallback, element) {
        var pre = element || getPreWithSource();
        if (pre !== null && pre !== undefined &&
            (isJSON(pre.textContent) || isJSONP(pre.textContent))) {
            successCallback(pre);
        } else if (bodyModified) {
            restoreNonJSONBody();
        }
    }

    // ============ 格式化（移植自 jsl-format.js，字符级容错重排） ============
    function formatJson(json, options) {
        options = options || {};
        var tabSize = options.tabSize || 2;
        var indentCStyle = options.indentCStyle || false;
        var showArraySize = options.showArraySize || false;
        var tab = '';
        for (var ts = 0; ts < tabSize; ts++) tab += ' ';

        function repeat(s, count) { return new Array(count + 1).join(s); }
        function getSizeOfArray(jsonString, startingPosition) {
            var currentPosition = startingPosition + 1;
            var inString = false;
            var numOpened = 1;
            try {
                while (numOpened > 0 && currentPosition < jsonString.length) {
                    var currentChar = jsonString.charAt(currentPosition);
                    switch (currentChar) {
                        case '[': if (!inString) numOpened++; break;
                        case ']': if (!inString) numOpened--; break;
                        case '"': inString = !inString; break;
                    }
                    currentPosition++;
                }
                return JSON.parse(jsonString.substring(startingPosition, currentPosition)).length;
            } catch (err) {
                return null;
            }
        }

        var i, il = json.length, newJson = '', indentLevel = 0, inString = false, currentChar = null;
        for (i = 0; i < il; i += 1) {
            currentChar = json.charAt(i);
            switch (currentChar) {
                case '{':
                case '[':
                    if (!inString) {
                        if (indentCStyle) newJson += '\n' + repeat(tab, indentLevel);
                        if (currentChar === '[' && showArraySize) {
                            var arraySize = getSizeOfArray(json, i);
                            if (arraySize !== null) newJson += 'Array[' + arraySize + ']';
                        }
                        newJson += currentChar;
                        newJson += '\n' + repeat(tab, indentLevel + 1);
                        indentLevel += 1;
                    } else {
                        newJson += currentChar;
                    }
                    break;
                case '}':
                case ']':
                    if (!inString) {
                        indentLevel -= 1;
                        newJson += '\n' + repeat(tab, indentLevel) + currentChar;
                    } else {
                        newJson += currentChar;
                    }
                    break;
                case ',':
                    if (!inString) newJson += ',\n' + repeat(tab, indentLevel);
                    else newJson += currentChar;
                    break;
                case ':':
                    if (!inString) newJson += ': ';
                    else newJson += currentChar;
                    break;
                case ' ':
                case '\n':
                case '\t':
                    if (inString) newJson += currentChar;
                    break;
                case '"':
                    if (i === 0) {
                        inString = true;
                    } else if (json.charAt(i - 1) !== '\\' ||
                        (json.charAt(i - 1) == '\\' && json.charAt(i - 2) == '\\')) {
                        inString = !inString;
                    }
                    newJson += currentChar;
                    break;
                default:
                    newJson += currentChar;
            }
        }
        return newJson;
    }

    // ============ 内容提取（移植自 content-extractor.js，含大数精度保护） ============
    var TOKEN = (Math.random() + 1).toString(36).slice(2, 7);
    var WRAP_START = '<wrap_' + TOKEN + '>';
    var WRAP_END = '</wrap_' + TOKEN + '>';
    var NUM_REGEX = /^-?\d+\.?\d*([eE]\+)?\d*$/g;
    var ESCAPED_REGEX = '(-?\\d+\\.?\\d*([eE]\\+)?\\d*)';
    var WRAP_REGEX = new RegExp('^' + WRAP_START + ESCAPED_REGEX + WRAP_END + '$', 'g');
    var REPLACE_WRAP_REGEX = new RegExp('"' + WRAP_START + ESCAPED_REGEX + WRAP_END + '"', 'g');

    function normalize(json) { return json.replace(/\$/g, '$$$$'); }

    function sortByKeys(obj) {
        if (typeof obj !== 'object' || !obj) return obj;
        var sorted;
        if (Array.isArray(obj)) {
            sorted = [];
            obj.forEach(function (val, idx) { sorted[idx] = sortByKeys(val); });
        } else {
            sorted = {};
            Object.keys(obj).sort().forEach(function (key) { sorted[key] = sortByKeys(obj[key]); });
        }
        return sorted;
    }

    // 把所有数字以字符串形式送入 JSON.parse 以保住精度，之后再去引号还原
    function wrapNumbers(text) {
        var buffer = '';
        var numberBuffer = '';
        var isInString = false;
        var charIsEscaped = false;
        var isInNumber = false;
        var previous = '';

        for (var i = 0, len = text.length; i < len; i++) {
            var char = text[i];

            if (char == '"' && !charIsEscaped) isInString = !isInString;

            if (!isInString && !isInNumber && isCharInNumber(char, previous)) isInNumber = true;

            if (!isInString && isInNumber && isCharInString(char, previous)) {
                isInNumber = false;
                if (numberBuffer.match(NUM_REGEX)) {
                    buffer += '"' + WRAP_START + numberBuffer + WRAP_END + '"';
                } else {
                    buffer += numberBuffer;
                }
                numberBuffer = '';
            }

            charIsEscaped = (char == '\\') ? !charIsEscaped : false;

            if (isInNumber) {
                numberBuffer += char;
            } else {
                buffer += char;
                previous = char;
            }
        }
        return buffer;
    }

    function isCharInNumber(char, previous) {
        return ('0' <= char && char <= '9') ||
            ('0' <= previous && previous <= '9' && (char == 'e' || char == 'E')) ||
            (('e' == previous || 'E' == previous) && char == '+') ||
            char == '.' ||
            char == '-';
    }

    function isCharInString(char, previous) {
        return ('0' > char || char > '9') &&
            char != 'e' && char != 'E' && char != '+' && char != '.' && char != '-';
    }

    function contentExtractor(pre, options) {
        return new Promise(function (resolve, reject) {
            try {
                var rawJsonText = getSourceText(pre);
                var jsonExtracted = extractJSON(rawJsonText);
                var wrappedText = wrapNumbers(jsonExtracted);

                var jsonParsed = JSON.parse(wrappedText);
                if (options.addons.sortKeys) jsonParsed = sortByKeys(jsonParsed);

                var decodedJson = JSON.stringify(jsonParsed);
                decodedJson = decodedJson.replace(REPLACE_WRAP_REGEX, '$1');

                var jsonFormatted = normalize(formatJson(decodedJson, options.structure));
                var jsonText = normalize(rawJsonText).replace(normalize(jsonExtracted), jsonFormatted);
                resolve({ jsonText: jsonText, jsonExtracted: decodedJson });
            } catch (e) {
                reject(new Error('contentExtractor: ' + e.message));
            }
        });
    }

    // ============ 时间（头部用，可读格式 YYYY-MM-DD HH:mm:ss） ============
    function twoDigits(number) {
        var str = number + '';
        return str.length === 1 ? '0' + str : str;
    }

    function getNow() {
        var date = new Date();
        return date.getFullYear() + '-' + twoDigits(date.getMonth() + 1) + '-' + twoDigits(date.getDate()) +
            ' ' + twoDigits(date.getHours()) + ':' + twoDigits(date.getMinutes()) + ':' + twoDigits(date.getSeconds());
    }

    // ============ Highlighter（移植自 highlighter.js，CodeMirror 封装） ============
    var F_LETTER = 70;

    function Highlighter(jsonText, options) {
        this.options = options || {};
        this.text = jsonText;
        this.defaultSearch = false;
        this.theme = this.options.theme || 'default';
    }

    Highlighter.prototype = {
        highlight: function () {
            this.linesCache = this.text.split('\n'); // 只读文本，路径/预览共用
            this.editor = CodeMirror(document.body, this.getEditorOptions());
            this.preventDefaultSearch();
            if (this.isReadOnly()) this.getDOMEditor().className += ' read-only';
            this.bindRenderLine();
            this.bindMousedown();
            this.bindPathTooltip();
            this.editor.refresh();
            this.editor.focus();
        },

        hide: function () {
            this.getDOMEditor().hidden = true;
            this.defaultSearch = true;
        },

        show: function () {
            this.getDOMEditor().hidden = false;
            this.defaultSearch = false;
        },

        getDOMEditor: function () {
            return document.getElementsByClassName('CodeMirror')[0];
        },

        fold: function () {
            var skippedRoot = false;
            var firstLine = this.editor.firstLine();
            var lastLine = this.editor.lastLine();
            for (var line = firstLine; line <= lastLine; line++) {
                if (!skippedRoot) {
                    if (/(\[|\{)/.test(this.editor.getLine(line).trim())) skippedRoot = true;
                } else {
                    this.editor.foldCode({ line: line, ch: 0 }, null, 'fold');
                }
            }
        },

        unfoldAll: function () {
            for (var line = 0; line < this.editor.lineCount(); line++) {
                this.editor.foldCode({ line: line, ch: 0 }, null, 'unfold');
            }
        },

        // URL 字符串加下划线可点击
        bindRenderLine: function () {
            var self = this;
            this.editor.off('renderLine');
            this.editor.on('renderLine', function (cm, line, element) {
                var elementsNode = element.getElementsByClassName('cm-string');
                if (!elementsNode || elementsNode.length === 0) return;

                var elements = [];
                for (var i = 0; i < elementsNode.length; i++) elements.push(elementsNode[i]);

                var textContent = elements.reduce(function (str, node) {
                    return str += node.textContent;
                }, '');

                var text = self.removeQuotes(textContent);

                if (text.match(URL_PATTERN) && self.clickableUrls()) {
                    var decodedText = self.decodeText(text);
                    elements.forEach(function (node) {
                        node.classList.add('cm-string-link');
                        node.setAttribute('data-url', decodedText);
                    });
                }
            });
        },

        bindMousedown: function () {
            var self = this;
            this.editor.off('mousedown');
            this.editor.on('mousedown', function (cm, event) {
                var element = event.target;
                if (element.classList.contains('cm-string-link')) {
                    var url = element.getAttribute('data-url');
                    var target = self.openLinksInNewWindow() ? '_blank' : '_self';
                    window.open(url, target);
                }
            });
        },

        removeQuotes: function (text) {
            return text.replace(/^"+/, '').replace(/"+$/, '');
        },

        // ============ Key 路径提示与复制 + 智能值预览 ============
        // 基于 jsl-format 的确定性输出（一行一元素）做栈式行扫描：
        // 属性行 "key": { → 压栈；裸 {/[ 行 → 数组元素计数；}/] 行 → 出栈
        bindPathTooltip: function () {
            var self = this;
            var lines = this.linesCache || this.text.split('\n'); // 只读文本，缓存安全
            var tip = null;
            var showTimer = null;
            var hideTimer = null;
            var KEY_LINE = /^"((?:[^"\\]|\\.)*)"\s*:\s*/;
            var OPEN_TAIL = /^[{[][,]?\s*$/;
            var CLOSE_LINE = /^[}\]]/;

            function fmtKey(key) {
                return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
                    ? '.' + key
                    : '[' + JSON.stringify(key) + ']';
            }

            // own=true 时最顶层数组框架不附加元素下标（用于容器自身的路径）
            function pathOf(stack, own) {
                var path = '';
                for (var i = 0; i < stack.length; i++) {
                    var f = stack[i];
                    if (f.type === 'arr') {
                        if (f.key != null) path += fmtKey(f.key);
                        if (!(own && i === stack.length - 1)) path += '[' + Math.max(f.index, 0) + ']';
                    } else if (f.key != null) {
                        path += fmtKey(f.key);
                    }
                }
                return path;
            }

            function computePath(targetLine) {
                var stack = [];
                var i, line, m, key, rest;
                for (i = 0; i <= targetLine && i < lines.length; i++) {
                    line = lines[i].trim();
                    if (!line) continue;
                    if (stack.length === 0 && line.indexOf('//') === 0) continue; // 头部两行

                    m = line.match(KEY_LINE);
                    if (m) {
                        key = JSON.parse('"' + m[1] + '"');
                        rest = line.slice(m[0].length).trim();
                        if (OPEN_TAIL.test(rest)) {
                            // 值为对象/数组：压栈（key 归属新框架）；悬停本行 = 容器自身路径
                            if (i === targetLine) return pathOf(stack) + fmtKey(key);
                            stack.push({ type: rest.charAt(0) === '{' ? 'obj' : 'arr', key: key, index: -1 });
                        } else if (i === targetLine) {
                            // 标量值行：路径 = 栈 + key
                            return pathOf(stack) + fmtKey(key);
                        }
                        continue;
                    }

                    if (CLOSE_LINE.test(line)) {
                        if (i === targetLine) return pathOf(stack, true); // 收尾括号：容器自身路径（数组不带下标）
                        stack.pop();
                        continue;
                    }

                    if (line.charAt(0) === '{' || line.charAt(0) === '[') {
                        // 裸开容器：数组元素或根
                        if (stack.length && stack[stack.length - 1].type === 'arr') stack[stack.length - 1].index++;
                        if (i === targetLine) return pathOf(stack);
                        stack.push({ type: line.charAt(0) === '{' ? 'obj' : 'arr', key: null, index: -1 });
                        continue;
                    }

                    // 数组标量元素
                    if (stack.length && stack[stack.length - 1].type === 'arr') stack[stack.length - 1].index++;
                    if (i === targetLine) return pathOf(stack);
                }
                return '';
            }

            window.__jsonViewerComputePath = computePath; // 调试/测试钩子

            // ============ 智能值预览（时间/颜色/图片，参考 JSON Hero Content Previews） ============
            function fmtDate(d) {
                function p(n) { return (n < 10 ? '0' : '') + n; }
                return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
                    ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
            }

            function relativeTime(d) {
                var diff = Date.now() - d.getTime();
                var future = diff < 0;
                diff = Math.abs(diff);
                var s = Math.floor(diff / 1000);
                var text;
                if (s < 60) text = '刚刚';
                else if (s < 3600) text = Math.floor(s / 60) + ' 分钟';
                else if (s < 86400) text = Math.floor(s / 3600) + ' 小时';
                else if (s < 2592000) text = Math.floor(s / 86400) + ' 天';
                else if (s < 31536000) text = Math.floor(s / 2592000) + ' 个月';
                else text = Math.floor(s / 31536000) + ' 年';
                if (text === '刚刚') return text;
                return future ? text + '后' : text + '前';
            }

            function previewValue(lineNo) {
                var line = (lines[lineNo] || '').trim();
                if (!line || line.indexOf('//') === 0) return null;
                var v = line;
                var m = line.match(/^"(?:[^"\\]|\\.)*"\s*:\s*(.+?),?\s*$/);
                if (m) v = m[1];
                else v = v.replace(/,$/, '');
                var isStr = v.charAt(0) === '"';
                if (isStr) {
                    try { v = JSON.parse(v); } catch (e) { return null; }
                } else if (!/^-?[\w.+:]+$/.test(v)) {
                    return null; // 非简单标量不预览
                }

                // 时间：10 位秒级 / 13 位毫秒级时间戳，或 ISO 日期
                var t = null;
                if (/^-?\d{10}$/.test(v)) t = new Date(+v * 1000);
                else if (/^-?\d{13}$/.test(v)) t = new Date(+v);
                else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v)) {
                    var tt = new Date(v.replace(' ', 'T'));
                    if (!isNaN(tt)) t = tt;
                }
                if (t && !isNaN(t)) return { type: 'time', text: fmtDate(t) + '（' + relativeTime(t) + '）' };

                // 颜色：#hex / rgb() / rgba() / hsl()
                if (isStr && /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d\s,.]+\)|hsla?\(\s*[\d\s,.%]+\))$/.test(v)) {
                    return { type: 'color', value: v };
                }

                // 图片 URL
                if (isStr && /^https?:\/\/\S+\.(jpe?g|png|gif|webp|svg|ico|bmp)([?#]\S*)?$/i.test(v)) {
                    return { type: 'image', url: v };
                }
                return null;
            }

            window.__jsonViewerPreviewValue = previewValue; // 调试/测试钩子

            function ensureTip() {
                if (tip) return tip;
                tip = document.createElement('div');
                tip.title = '点击复制路径';
                tip.style.cssText = 'position:fixed;z-index:99999;max-width:70vw;padding:5px 10px;display:none;' +
                    'background:#2d2d2d;color:#f0f0f0;border-radius:6px;white-space:nowrap;cursor:pointer;' +
                    'font:12px/1.6 Consolas,monaco,monospace;box-shadow:0 2px 8px rgba(0,0,0,.35);';
                tip.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
                tip.addEventListener('mouseleave', function () {
                    clearTimeout(hideTimer);
                    hideTimer = setTimeout(hideTip, 120);
                });
                tip.addEventListener('mousedown', function (e) { e.preventDefault(); }); // 不抢编辑器焦点
                tip.addEventListener('click', function () {
                    var path = tip.getAttribute('data-path') || '';
                    copyText(path).then(function () {
                        var old = tip.textContent;
                        tip.textContent = '✓ 已复制 ' + old;
                        setTimeout(function () { tip.textContent = old; }, 800);
                    }).catch(function (err) {
                        console.error('[JSON Viewer] 复制路径失败:', err);
                    });
                });
                document.body.appendChild(tip);
                return tip;
            }

            function hideTip() {
                if (tip) tip.style.display = 'none';
            }

            function show(e, lineNo) {
                var path = computePath(lineNo);
                if (!path) return;
                var el = ensureTip();
                el.innerHTML = '';
                var pathSpan = document.createElement('span');
                pathSpan.textContent = path;
                el.appendChild(pathSpan);

                var pv = previewValue(lineNo);
                if (pv) {
                    el.appendChild(document.createElement('br'));
                    if (pv.type === 'time') {
                        var ts = document.createElement('span');
                        ts.textContent = '🕐 ' + pv.text;
                        ts.style.color = '#9ecbff';
                        el.appendChild(ts);
                    } else if (pv.type === 'color') {
                        var sw = document.createElement('span');
                        sw.style.cssText = 'display:inline-block;width:12px;height:12px;margin-right:4px;' +
                            'vertical-align:-2px;border:1px solid #888;border-radius:2px;background:' + pv.value + ';';
                        var ct = document.createElement('span');
                        ct.textContent = pv.value;
                        ct.style.color = '#9ecbff';
                        el.appendChild(sw);
                        el.appendChild(ct);
                    } else if (pv.type === 'image') {
                        var im = document.createElement('img');
                        im.src = pv.url;
                        im.style.cssText = 'display:block;max-height:96px;max-width:200px;margin-top:4px;border-radius:4px;';
                        el.appendChild(im);
                    }
                }

                el.setAttribute('data-path', path);
                el.style.display = 'block';
                var x = Math.min(e.clientX + 14, (window.innerWidth || 1200) - el.offsetWidth - 8);
                var y = e.clientY + 18;
                if (y + el.offsetHeight > (window.innerHeight || 800) - 8) y = e.clientY - el.offsetHeight - 8;
                el.style.left = x + 'px';
                el.style.top = y + 'px';
            }

            var wrapper = this.editor.getWrapperElement();
            wrapper.addEventListener('mouseover', function (e) {
                var t = e.target;
                if (!t || !t.classList) return;
                var isKey = t.classList.contains('cm-property');
                var isValue = t.classList.contains('cm-string') ||
                    t.classList.contains('cm-number') || t.classList.contains('cm-atom');
                if (!isKey && !isValue) {
                    clearTimeout(showTimer);
                    return;
                }
                var pos;
                try { pos = self.editor.coordsChar({ left: e.clientX, top: e.clientY }); } catch (err) { return; }
                if (!pos || pos.line == null || pos.line < 0) return;
                clearTimeout(hideTimer);
                clearTimeout(showTimer);
                if (tip && tip.style.display !== 'none') {
                    show(e, pos.line); // 已可见则立即更新位置/内容
                } else {
                    showTimer = setTimeout(function () { show(e, pos.line); }, 180);
                }
            });
            wrapper.addEventListener('mouseout', function () {
                clearTimeout(showTimer);
                clearTimeout(hideTimer);
                hideTimer = setTimeout(hideTip, 120);
            });
            this.editor.on('scroll', hideTip);
        },

        decodeText: function (text) {
            var div = document.createElement('div');
            div.innerHTML = text;
            return div.firstChild ? div.firstChild.nodeValue : '';
        },

        getEditorOptions: function () {
            var obligatory = {
                value: this.text,
                theme: this.theme,
                readOnly: this.isReadOnly() ? true : false,
                mode: 'application/ld+json',
                indentUnit: 2,
                tabSize: 2,
                gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
                extraKeys: this.getExtraKeysMap(),
            };
            return Object.assign({}, this.options.structure, obligatory);
        },

        getExtraKeysMap: function () {
            var extraKeyMap = {
                'Esc': function (cm) {
                    CodeMirror.commands.clearSearch(cm);
                    cm.setSelection(cm.getCursor());
                    cm.focus();
                },
            };

            if (this.options.structure.readOnly) {
                extraKeyMap['Enter'] = function (cm) { CodeMirror.commands.findNext(cm); };
                extraKeyMap['Shift-Enter'] = function (cm) { CodeMirror.commands.findPrev(cm); };
                extraKeyMap['Ctrl-V'] = extraKeyMap['Cmd-V'] = function (cm) {};
            }

            extraKeyMap['Ctrl-F'] = this.openSearchDialog;
            extraKeyMap['Cmd-F'] = this.openSearchDialog;
            return extraKeyMap;
        },

        preventDefaultSearch: function () {
            document.addEventListener('keydown', function (e) {
                var metaKey = navigator.platform.match('Mac') ? e.metaKey : e.ctrlKey;
                if (!this.defaultSearch && e.keyCode === F_LETTER && metaKey) {
                    e.preventDefault();
                }
            }.bind(this), false);
        },

        openSearchDialog: function (cm) {
            cm.setCursor({ line: 0, ch: 0 });
            CodeMirror.commands.find(cm);
        },

        clickableUrls: function () { return this.options.addons.clickableUrls; },
        openLinksInNewWindow: function () { return this.options.addons.openLinksInNewWindow; },
        isReadOnly: function () { return this.options.structure.readOnly; },
    };

    // ============ 图标（移植自 viewer/svg-*.js） ============
    var SVG_RAW = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 128 128" enable-background="new 0 0 128 128" xml:space="preserve"><g><g><path fill-rule="evenodd" clip-rule="evenodd" d="M103.199,39.9907 L98.8771,35.6692 L81.5177,18.3098 L77.1115,13.9036 L77.0491,13.8412 L77.0491,13.9036 L35.6369,13.9036 C29.6178,13.9036 24.739,18.7835 24.739,24.8015 L24.739,103.261 C24.739,109.28 29.6178,114.159 35.6369,114.159 L92.3007,114.159 C98.3198,114.159 103.199,109.28 103.199,103.261 L103.199,101.172 L98.8771,101.172 L98.8771,103.292 C98.8771,106.904 95.95,109.831 92.3386,109.831 L35.6257,109.831 C32.0143,109.831 29.0872,106.902 29.0872,103.292 L29.0872,24.8483 C29.0872,21.2368 32.0143,18.3098 35.6257,18.3098 L77.0491,18.3098 L77.0491,29.1552 C77.0491,35.1743 81.9279,40.0531 87.9469,40.0531 L98.8771,40.0531 L98.8771,61.9078 L103.199,61.9078 L103.199,40.0531 L103.261,40.0531 L103.199,39.9907 M77.0379,96.7905 L77.0379,66.2783 L72.6797,66.2783 L72.6797,66.3452 L68.3203,66.3452 L68.3203,66.2783 L63.961,66.2783 L63.961,96.7905 L68.3203,96.7905 L68.3203,83.6455 L72.6797,83.6455 L72.6797,96.7916 L77.0379,96.7916 L77.0379,96.7905 M68.3203,79.4222 L68.3203,70.5686 L72.6797,70.5686 L72.6797,79.4222 L68.3203,79.4222 M46.5247,66.2761 L46.5247,96.7927 L50.884,96.7927 L50.884,83.6478 L55.2434,83.6478 L55.2434,79.4244 L50.884,79.4244 L50.884,70.5708 L55.2434,70.5708 L55.2434,66.3452 L50.884,66.3452 L50.884,66.2772 L46.5247,66.2772 L46.5247,66.2761 M55.2434,79.3531 L59.6027,79.3531 L59.6027,70.6355 L55.2434,70.6355 L55.2434,79.3531 M59.6027,83.7146 L55.2434,83.7146 L55.2434,96.7916 L59.6027,96.7916 L59.6027,83.7146 M98.8347,96.7225 L98.8347,92.4322 L103.194,92.4322 L103.194,66.275 L98.8347,66.275 L98.8347,92.362 L94.4754,92.362 L94.4754,66.275 L90.116,66.275 L90.116,92.362 L85.7578,92.362 L85.7578,66.275 L81.3984,66.275 L81.3984,92.4311 L85.7366,92.4311 L85.7366,96.7214 L90.116,96.7214 L90.116,92.4311 L94.4553,92.4311 L94.4553,96.7214 L98.8347,96.7214 L98.8347,96.7225 Z"/></g></g>';
    var SVG_COPY = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px" y="0px" viewBox="0 0 128 128" xml:space="preserve"><path fill-rule="evenodd" clip-rule="evenodd" d="M104 24H48c-4.4 0-8 3.6-8 8v8h-8c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8v-8h8c4.4 0 8-3.6 8-8V32c0-4.4-3.6-8-8-8z M88 104H32V48h8v48c0 .3 0 .6 0 .8.4 3.9 3.6 7.2 7.6 7.2.1 0 .3 0 .4 0v0H88V104z M104 88H48V32h56V88z"/></svg>';

    // ============ 剪贴板（优先 Clipboard API，降级 execCommand） ============
    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px;';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
            } catch (err) {
                reject(err);
            } finally {
                document.body.removeChild(ta);
            }
        });
    }

    // ============ 工具条（复制/raw 切换；原版另有设置齿轮，因网页无法导航扩展 URL 已移除） ============
    function renderExtras(pre, options, highlighter) {
        var extras = document.createElement('div');
        extras.className = 'extras';

        var copyLink = document.createElement('a');
        copyLink.className = 'json_viewer icon copy';
        copyLink.href = '#';
        copyLink.title = 'Copy formatted JSON';
        copyLink.innerHTML = SVG_COPY;
        copyLink.style.cssText = 'text-align:center;line-height:40px;';
        copyLink.onclick = function (e) {
            e.preventDefault();
            var pretty = highlighter.prettyJson || '';
            copyText(pretty).then(function () {
                copyLink.innerHTML = '✓';
                copyLink.title = 'Copied!';
                setTimeout(function () {
                    copyLink.innerHTML = SVG_COPY;
                    copyLink.title = 'Copy formatted JSON';
                }, 1000);
            }).catch(function (err) {
                console.error('[JSON Viewer] 复制失败:', err);
            });
        };

        var rawLink = document.createElement('a');
        rawLink.className = 'json_viewer icon raw';
        rawLink.href = '#';
        rawLink.title = 'Original JSON toggle';
        rawLink.innerHTML = SVG_RAW;
        rawLink.onclick = function (e) {
            e.preventDefault();
            if (pre.hidden) {
                // 显示原始 JSON
                highlighter.hide();
                pre.hidden = false;
                extras.className += ' auto-highlight-off';
            } else {
                // 显示高亮
                highlighter.show();
                pre.hidden = true;
                extras.className = extras.className.replace(/\s+auto-highlight-off/, '');
            }
        };

        extras.appendChild(copyLink);
        extras.appendChild(rawLink);
        document.body.appendChild(extras);
    }

    // ============ window.json 暴露（移植自 expose-json.js） ============
    function exposeJson(text) {
        console.info('[JSON Viewer] Your json was stored into \'window.json\', enjoy!');
        var script = document.createElement('script');
        script.innerHTML = 'window.json = ' + text + ';';
        document.head.appendChild(script);
    }

    // ============ 超大 JSON 提示（移植自 highlight-content.js，样式内联避免依赖 CSS 加载） ============
    function isOversized(pre) {
        var jsonSize = pre.textContent.length;
        var maxJsonSize = INTERNAL_OPTIONS.addons.maxJsonSize * 1024;
        return jsonSize > maxJsonSize;
    }

    function renderOversizeAlert(pre) {
        console.warn(
            '[JSON Viewer] Content not highlighted due to oversize. Accepted: ' +
            INTERNAL_OPTIONS.addons.maxJsonSize + ' kbytes, received: ' +
            Math.round(pre.textContent.length / 1024) + ' kbytes.'
        );

        var container = document.createElement('div');
        container.style.cssText = 'position:fixed;top:0;right:0;margin:10px;padding:10px 20px 10px 10px;' +
            'border:1px solid #faebcc;border-radius:4px;max-width:380px;color:#8a6d3b;' +
            'background-color:#fcf8e3;z-index:99999;';

        var message = document.createElement('div');
        message.innerHTML = '[JSON Viewer] Content not highlighted due to oversize.';
        container.appendChild(message);

        var highlightAnyway = document.createElement('a');
        highlightAnyway.href = '#';
        highlightAnyway.title = 'Highlight anyway!';
        highlightAnyway.innerHTML = 'Highlight anyway!';
        highlightAnyway.onclick = function (e) {
            e.preventDefault();
            container.parentNode.removeChild(container);
            pre.hidden = true;
            loadAssets().then(function () {
                highlightContent(pre, true);
            }).catch(function (err) {
                pre.hidden = false;
                console.error('[JSON Viewer] 加载资源失败:', err);
            });
        };
        container.appendChild(highlightAnyway);

        var closeBtn = document.createElement('a');
        closeBtn.href = '#';
        closeBtn.title = 'Close';
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = 'position:absolute;right:10px;font-size:30px;font-weight:700;' +
            'color:#000;opacity:0.2;text-decoration:none;';
        closeBtn.onclick = function (e) {
            e.preventDefault();
            container.parentNode.removeChild(container);
        };
        container.appendChild(closeBtn);

        document.body.appendChild(container);
    }

    // ============ 时间头部（原版为紧凑时间戳，改为可读时间） ============
    function prependHeader(jsonText) {
        INTERNAL_OPTIONS.structure.firstLineNumber = INTERNAL_OPTIONS.structure.firstLineNumber - 3;
        var header = '// ' + getNow() + '\n';
        header += '// ' + document.location.href + '\n\n';
        return header + jsonText;
    }

    // ============ 解析失败提示条（正则判过但 JSON.parse 挂掉时） ============
    function renderErrorBanner(message) {
        var container = document.createElement('div');
        container.style.cssText = 'position:fixed;top:0;right:0;margin:10px;padding:10px 20px 10px 10px;' +
            'border:1px solid #ebccd1;border-radius:4px;max-width:380px;color:#a94442;' +
            'background-color:#f2dede;z-index:99999;';

        var messageEl = document.createElement('div');
        messageEl.innerHTML = '[JSON Viewer] JSON 解析失败，已显示原文：<br><small>' + message + '</small>';
        container.appendChild(messageEl);

        var closeBtn = document.createElement('a');
        closeBtn.href = '#';
        closeBtn.title = 'Close';
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = 'position:absolute;right:10px;font-size:30px;font-weight:700;' +
            'color:#000;opacity:0.2;text-decoration:none;';
        closeBtn.onclick = function (e) {
            e.preventDefault();
            container.parentNode.removeChild(container);
        };
        container.appendChild(closeBtn);

        document.body.appendChild(container);
    }

    // ============ 渲染主流程（移植自 highlight-content.js） ============
    function highlightContent(pre, ignoreLimit) {
        contentExtractor(pre, INTERNAL_OPTIONS)
            .then(function (value) {
                if (!ignoreLimit && isOversized(pre)) {
                    pre.hidden = false;
                    return;
                }

                var formatted = prependHeader(value.jsonText);
                var highlighter = new Highlighter(formatted, INTERNAL_OPTIONS);
                highlighter.prettyJson = value.jsonText; // 供「复制」按钮用（不带头部）
                highlighter.highlight();

                if (INTERNAL_OPTIONS.addons.alwaysFold) highlighter.fold();

                exposeJson(value.jsonExtracted);
                renderExtras(pre, INTERNAL_OPTIONS, highlighter);
            })
            .catch(function (e) {
                pre.hidden = false;
                console.error('[JSON Viewer] error: ' + e.message, e);
                renderErrorBanner(e.message);
            });
    }

    // ============ CodeMirror 懒加载（经 background scripting 注入，同隔离世界） ============
    function loadAssets() {
        return new Promise(function (resolve, reject) {
            chrome.runtime.sendMessage({ action: 'jsonViewerLoadAssets' }, function (response) {
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                if (!response || !response.success) {
                    return reject(new Error((response && response.error) || 'load assets failed'));
                }
                resolve();
            });
        });
    }

    function start(pre) {
        if (isOversized(pre)) {
            // 超大 JSON：保持原文，弹提示可手动强高亮
            renderOversizeAlert(pre);
            return;
        }

        pre.hidden = true; // 防闪烁
        loadAssets()
            .then(function () { highlightContent(pre, false); })
            .catch(function (err) {
                pre.hidden = false;
                console.error('[JSON Viewer] 加载 CodeMirror 失败，显示原始 JSON:', err);
            });
    }

    // ============ 启动：配置读取(document_start 即发起) + DOM 就绪 双等待 ============
    var configReady = (async function () {
        try {
            var result = await chrome.storage.sync.get('extensionConfig');
            return result.extensionConfig;
        } catch (error) {
            console.error('[JSON Viewer] 读取配置失败:', error);
            return null;
        }
    })();

    var domReady = new Promise(function (resolve) {
        if (document.readyState !== 'loading') {
            resolve();
        } else {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        }
    });

    Promise.all([configReady, domReady]).then(function (results) {
        var config = results[0];
        // 总开关：默认开启，仅显式 false 时禁用（与 autoLogin 开关同语义）
        if (config && config.features && config.features.jsonViewer === false) {
            console.log('[JSON Viewer] 功能已关闭');
            return;
        }
        checkIfJson(start);
    });
})();
