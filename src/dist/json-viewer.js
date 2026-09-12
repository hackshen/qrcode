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
        theme: 'coy', // 浅色默认；深色模式下运行时切换为 monokai（见下方启动逻辑）
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
                var rawJsonText = pre.textContent;
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
            this.editor = CodeMirror(document.body, this.getEditorOptions());
            this.preventDefaultSearch();
            if (this.isReadOnly()) this.getDOMEditor().className += ' read-only';
            this.bindRenderLine();
            this.bindMousedown();
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
    var SVG_GEAR = '<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="128pt" height="128pt" viewBox="0 0 128 128" preserveAspectRatio="xMidYMid meet"><g transform="translate(0.000000,128.000000) scale(0.100000,-0.100000)" stroke="none"><path d="M588 1069 c-10 -5 -18 -19 -18 -29 0 -28 -39 -65 -89 -84 -39 -15 -46 -15 -67 -1 -33 21 -67 19 -91 -7 -33 -37 -34 -45 -17 -81 28 -59 -10 -167 -59 -167 -35 0 -47 -19 -47 -72 0 -38 4 -50 18 -54 64 -21 71 -27 93 -80 21 -54 21 -56 3 -89 -21 -40 -11 -73 31 -101 25 -16 28 -16 55 -1 38 23 67 21 119 -5 33 -17 47 -32 55 -58 11 -34 12 -35 65 -35 52 0 55 1 65 32 14 40 29 54 85 78 41 18 45 18 73 2 41 -24 60 -21 91 11 32 33 32 38 11 82 -14 27 -15 38 -4 72 13 47 51 88 78 88 30 0 44 24 40 72 -3 37 -7 45 -33 56 -55 24 -60 29 -82 83 -19 48 -20 56 -7 81 21 40 17 61 -14 91 -32 30 -48 33 -76 12 -27 -20 -48 -19 -107 6 -37 16 -51 28 -55 48 -4 14 -14 34 -22 44 -17 19 -67 22 -94 6z m108 -288 c155 -71 114 -301 -54 -301 -87 0 -150 53 -159 135 -10 82 28 143 104 170 50 18 60 18 109 -4z"/></g></svg>';
    var SVG_RAW = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 128 128" enable-background="new 0 0 128 128" xml:space="preserve"><g><g><path fill-rule="evenodd" clip-rule="evenodd" d="M103.199,39.9907 L98.8771,35.6692 L81.5177,18.3098 L77.1115,13.9036 L77.0491,13.8412 L77.0491,13.9036 L35.6369,13.9036 C29.6178,13.9036 24.739,18.7835 24.739,24.8015 L24.739,103.261 C24.739,109.28 29.6178,114.159 35.6369,114.159 L92.3007,114.159 C98.3198,114.159 103.199,109.28 103.199,103.261 L103.199,101.172 L98.8771,101.172 L98.8771,103.292 C98.8771,106.904 95.95,109.831 92.3386,109.831 L35.6257,109.831 C32.0143,109.831 29.0872,106.902 29.0872,103.292 L29.0872,24.8483 C29.0872,21.2368 32.0143,18.3098 35.6257,18.3098 L77.0491,18.3098 L77.0491,29.1552 C77.0491,35.1743 81.9279,40.0531 87.9469,40.0531 L98.8771,40.0531 L98.8771,61.9078 L103.199,61.9078 L103.199,40.0531 L103.261,40.0531 L103.199,39.9907 M77.0379,96.7905 L77.0379,66.2783 L72.6797,66.2783 L72.6797,66.3452 L68.3203,66.3452 L68.3203,66.2783 L63.961,66.2783 L63.961,96.7905 L68.3203,96.7905 L68.3203,83.6455 L72.6797,83.6455 L72.6797,96.7916 L77.0379,96.7916 L77.0379,96.7905 M68.3203,79.4222 L68.3203,70.5686 L72.6797,70.5686 L72.6797,79.4222 L68.3203,79.4222 M46.5247,66.2761 L46.5247,96.7927 L50.884,96.7927 L50.884,83.6478 L55.2434,83.6478 L55.2434,79.4244 L50.884,79.4244 L50.884,70.5708 L55.2434,70.5708 L55.2434,66.3452 L50.884,66.3452 L50.884,66.2772 L46.5247,66.2772 L46.5247,66.2761 M55.2434,79.3531 L59.6027,79.3531 L59.6027,70.6355 L55.2434,70.6355 L55.2434,79.3531 M59.6027,83.7146 L55.2434,83.7146 L55.2434,96.7916 L59.6027,96.7916 L59.6027,83.7146 M98.8347,96.7225 L98.8347,92.4322 L103.194,92.4322 L103.194,66.275 L98.8347,66.275 L98.8347,92.362 L94.4754,92.362 L94.4754,66.275 L90.116,66.275 L90.116,92.362 L85.7578,92.362 L85.7578,66.275 L81.3984,66.275 L81.3984,92.4311 L85.7366,92.4311 L85.7366,96.7214 L90.116,96.7214 L90.116,92.4311 L94.4553,92.4311 L94.4553,96.7214 L98.8347,96.7214 L98.8347,96.7225 Z"/></g></g>';
    var SVG_UNFOLD = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 128 128" enable-background="new 0 0 128 128" xml:space="preserve"><g fill-rule="evenodd" stroke="none" stroke-width="1"><g transform="translate(-511.000000, -465.000000)"><g transform="translate(511.500000, 465.000000)"><path d="M66.7414,31.6694 L83.4281,48.3562 L90.7286,41.0557 L66.7414,17.0685 L42.7542,41.0557 L50.0546,48.3562 L66.7414,31.6694 M66.7414,96.3306 L50.0546,79.6438 L42.7542,86.9443 L66.7414,110.931 L90.7286,86.9443 L83.4281,79.6438 L66.7414,96.3306 Z"/></g></g></g>';
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

    // ============ 工具条（移植自 render-extras.js：设置/复制/raw 切换/展开全部） ============
    function renderExtras(pre, options, highlighter) {
        var extras = document.createElement('div');
        extras.className = 'extras';

        var optionsLink = document.createElement('a');
        optionsLink.className = 'json_viewer icon gear';
        optionsLink.href = chrome.runtime.getURL('options.html');
        optionsLink.target = '_blank';
        optionsLink.title = 'Options';
        optionsLink.innerHTML = SVG_GEAR;

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

        var unfoldLink = document.createElement('a');
        unfoldLink.className = 'json_viewer icon unfold';
        unfoldLink.href = '#';
        unfoldLink.title = 'Fold/Unfold all toggle';
        unfoldLink.innerHTML = SVG_UNFOLD;
        unfoldLink.onclick = function (e) {
            e.preventDefault();
            var value = pre.getAttribute('data-folded');
            if (value === 'true' || value === true) {
                highlighter.unfoldAll();
                pre.setAttribute('data-folded', false);
            } else {
                highlighter.fold();
                pre.setAttribute('data-folded', true);
            }
        };

        pre.setAttribute('data-folded', options.addons.alwaysFold);

        extras.appendChild(optionsLink);
        extras.appendChild(copyLink);
        extras.appendChild(rawLink);
        extras.appendChild(unfoldLink);
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
        // 深色模式联动：系统深色时切 monokai，图标/工具条同步换色
        try {
            if (typeof window.matchMedia === 'function' &&
                window.matchMedia('(prefers-color-scheme: dark)').matches) {
                INTERNAL_OPTIONS.theme = 'monokai';
                document.body.classList.add('json-viewer-dark');
            }
        } catch (e) { /* matchMedia 不可用时保持 coy */ }

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
