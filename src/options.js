import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { DEFAULT_EXTENSION_CONFIG as DEFAULT_CONFIG } from './shared/default-config.js';
import { HTTP_RULES_KEY, DEFAULT_HTTP_RULES, migrateHttpRules } from './shared/http-rules.js';
import './options.css';

// ============ 拆分组件（按功能域，纯代码搬移） ============
import { HttpRulesManager } from './options/http-rules.js';
import { SiteProfileManager } from './options/auto-login.js';
import { OptionItem, SavedDataDisplay } from './options/common.js';
import { ProxyManager } from './options/proxy.js';
import { SourceMapManager } from './options/sourcemap.js';

// ============ React 组件 ============

function OptionsApp() {
    // State
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [httpRules, setHttpRules] = useState(DEFAULT_HTTP_RULES);
    // 规则自动保存签名：null = 初始加载未完成；非空 = 最近一次落盘的规则内容签名
    const rulesSavedSigRef = useRef(null);
    const [savedData, setSavedData] = useState(null);
    const [status, setStatus] = useState({ message: '', type: '' });
    const [loading, setLoading] = useState(true);

    // 加载配置
    useEffect(() => {
        loadConfig();
        loadSavedData();

        // 监听存储变化
        const listener = (changes, areaName) => {
            if (areaName === 'local') {
                loadSavedData();
            }
        };
        chrome.storage.onChanged.addListener(listener);

        return () => {
            chrome.storage.onChanged.removeListener(listener);
        };
    }, []);

    // 加载配置
    const loadConfig = async () => {
        try {
            const result = await chrome.storage.sync.get(['extensionConfig', HTTP_RULES_KEY]);

            // HTTP 头规则：独立 key 优先；旧结构（extensionConfig.httpRules）一次性迁移；
            // 无任何存储时回退到示例规则（仅存在干 UI，保存后才生效）
            const rules = (await migrateHttpRules(result)) ?? DEFAULT_HTTP_RULES;
            setHttpRules(rules);

            // 合并默认配置，确保所有字段都存在
            const loadedConfig = result.extensionConfig
                ? { ...DEFAULT_CONFIG, ...result.extensionConfig, ocr: { ...DEFAULT_CONFIG.ocr, ...result.extensionConfig.ocr } }
                : DEFAULT_CONFIG;
            // 防止迁移前的残留字段随下次保存写回
            delete loadedConfig.httpRules;
            setConfig(loadedConfig);
            rulesSavedSigRef.current = JSON.stringify([rules, loadedConfig.proxy?.rules ?? [], loadedConfig.sourcemap?.rules ?? []]);
            setLoading(false);
        } catch (error) {
            console.error('❌ 加载配置失败:', error);
            setConfig(DEFAULT_CONFIG);
            setLoading(false);
        }
    };

    // 加载保存的数据
    const loadSavedData = async () => {
        try {
            const data = await chrome.storage.local.get([
                'sessionid',
                'tyAuthToken',
                'savedTime',
                'savedUrl'
            ]);
            setSavedData(data);
        } catch (error) {
            console.error('❌ 读取数据失败:', error);
        }
    };

    // 显示状态消息
    const showStatus = (message, type = 'success') => {
        setStatus({ message, type });
        setTimeout(() => {
            setStatus({ message: '', type: '' });
        }, 3000);
    };

    // 保存配置
    const handleSave = async () => {
        try {
            // httpRules 独立存储，避免撑爆 extensionConfig 的 storage.sync 单项配额
            await chrome.storage.sync.set({ extensionConfig: config, [HTTP_RULES_KEY]: httpRules });
            console.log('✅ 配置已保存:', config);
            showStatus('✅ 设置已保存！刷新页面后生效', 'success');

            // 通知 content script
            const tabs = await chrome.tabs.query({});
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'configUpdated',
                    config: config
                }).catch(() => {});
            });
        } catch (error) {
            console.error('❌ 保存配置失败:', error);
            showStatus('❌ 保存失败，请重试', 'error');
        }
    };

    // —— 规则自动保存 ——
    // HTTP/代理/SourceMap 规则的增删改、启停、导入在弹窗“添加/更新”后只改内存 state，
    // 历史上必须再点页面底部“保存设置”才落盘，极易漏点导致“规则看似存在实则未保存”。
    // 此 effect 监听规则内容签名，变化后自动写 storage；其他配置项仍走手动保存按钮。
    useEffect(() => {
        const sig = JSON.stringify([httpRules, config.proxy?.rules ?? [], config.sourcemap?.rules ?? []]);
        if (rulesSavedSigRef.current === null) return; // 初始加载未完成
        if (sig === rulesSavedSigRef.current) return;  // 规则内容无变化（其他配置编辑会更换 config 对象，但签名不变）
        const timer = setTimeout(async () => {
            try {
                await chrome.storage.sync.set({ extensionConfig: config, [HTTP_RULES_KEY]: httpRules });
                rulesSavedSigRef.current = sig;
                showStatus('✅ 规则已自动保存', 'success');
                // 与手动保存保持一致：通知 content script
                const tabs = await chrome.tabs.query({});
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { action: 'configUpdated', config }).catch(() => {});
                });
            } catch (error) {
                console.error('❌ 规则自动保存失败:', error);
                showStatus('❌ 自动保存失败，请点击底部“保存设置”重试', 'error');
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [httpRules, config]);

    // 恢复默认
    const handleReset = async () => {
        if (confirm('确定要恢复默认设置吗？')) {
            // 重置交给规则自动保存 effect 落盘（规则签名变化触发）
            setConfig(DEFAULT_CONFIG);
            setHttpRules(DEFAULT_HTTP_RULES);
            showStatus('✅ 已恢复默认设置', 'success');
        }
    };

    // 清除数据
    const handleClearData = async () => {
        if (confirm('确定要清除所有保存的认证数据吗？此操作不可恢复！')) {
            try {
                await chrome.storage.local.remove([
                    'sessionid',
                    'tyAuthToken',
                    'savedTime',
                    'savedUrl',
                    'pageLocalStorage'
                ]);
                showStatus('✅ 数据已清除', 'success');
                loadSavedData();
            } catch (error) {
                console.error('❌ 清除数据失败:', error);
                showStatus('❌ 清除失败，请重试', 'error');
            }
        }
    };

    // 更新配置
    const updateConfig = (path, value) => {
        setConfig(prev => {
            const newConfig = JSON.parse(JSON.stringify(prev));
            const keys = path.split('.');
            let current = newConfig;

            // 确保路径上的所有父对象都存在
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }

            current[keys[keys.length - 1]] = value;
            return newConfig;
        });
    };

    if (loading) {
        return (
            <div className="container">
                <div style={{ textAlign: 'center', padding: '50px' }}>
                    <p>加载中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <header>
                <h1>⚙️ QRCode 扩展设置</h1>
                <p className="subtitle">自定义你的扩展行为</p>
            </header>

            <main>
                {/* 功能开关 */}
                <section className="section">
                    <h2>🎯 功能开关</h2>
                    <div className="option-group">
                        <OptionItem
                            title="双击复制"
                            description="双击页面任意文本即可复制到剪贴板"
                            checked={config.features.doubleCopyClick}
                            onChange={(checked) => updateConfig('features.doubleCopyClick', checked)}
                        />
                        <OptionItem
                            title="密码显示"
                            description="点击密码框自动显示密码内容"
                            checked={config.features.passwordReveal}
                            onChange={(checked) => updateConfig('features.passwordReveal', checked)}
                        />
                        <OptionItem
                            title="JSON 高亮"
                            description="自动格式化并高亮 JSON 页面，支持折叠、行号、时间戳头部与 Ctrl-F 搜索（需刷新页面生效）"
                            checked={config.features.jsonViewer !== false}
                            onChange={(checked) => updateConfig('features.jsonViewer', checked)}
                        />
                        {/* <OptionItem
                            title="全局错误监控"
                            description="监控页面 JavaScript 错误、Promise 异常和资源加载错误"
                            checked={config.features.globalErrorMonitor}
                            onChange={(checked) => updateConfig('features.globalErrorMonitor', checked)}
                        /> */}
                        {/* <OptionItem
                            title="SourceMap 监控"
                            description="监控指定域名的 JS 文件并自动注入 SourceMap 头（需刷新页面）"
                            checked={config.features.sourcemapMonitor}
                            onChange={(checked) => updateConfig('features.sourcemapMonitor', checked)}
                        /> */}
                    </div>
                </section>

                {/* API 配置 */}
                <section className="section">
                    <h2>🔗 API 配置</h2>
                    <div className="option-group">
                        <div className="form-item">
                            <label htmlFor="apiMessage">每日一句 API</label>
                            <input
                                type="url"
                                id="apiMessage"
                                value={config.api.message}
                                onChange={(e) => updateConfig('api.message', e.target.value)}
                                placeholder="https://api.hackshen.com/message"
                            />
                            <p className="hint">返回格式: {'[{"title": "文本内容"}]'}</p>
                        </div>

                        <div className="form-item">
                            <label htmlFor="jqueryCdn">jQuery CDN 地址</label>
                            <input
                                type="url"
                                id="jqueryCdn"
                                value={config.cdn.jquery}
                                onChange={(e) => updateConfig('cdn.jquery', e.target.value)}
                                placeholder="https://libs.baidu.com/jquery/2.0.0/jquery.min.js"
                            />
                        </div>
                    </div>
                </section>

                {/* SourceMap 域名配置 */}
                {/* <section className="section">
                    <h2>🗺️ SourceMap 监控域名</h2>
                    <div className="option-group">
                        <div className="form-item">
                            <label htmlFor="sourcemapDomains">域名列表（每行一个）</label>
                            <textarea
                                id="sourcemapDomains"
                                rows="5"
                                value={config.sourcemapDomains.join('\n')}
                                onChange={(e) => {
                                    const domains = e.target.value
                                        .split('\n')
                                        .map(d => d.trim())
                                        .filter(d => d.length > 0);
                                    updateConfig('sourcemapDomains', domains);
                                }}
                                placeholder="example.com&#10;api.example.com"
                            />
                            <p className="hint">
                                仅监控这些域名下的 JS 文件<br />
                                格式: example.com（不含 http://）<br />
                                当前配置: {config.sourcemapDomains.length === 0 ?
                                    <span style={{color: '#ff4d4f'}}>未配置（监控不会启动）</span> :
                                    <span style={{color: '#52c41a'}}>{config.sourcemapDomains.length} 个域名</span>
                                }
                            </p>
                        </div>
                    </div>
                </section> */}

                {/* HTTP 头规则管理 */}
                <section className="section">
                    <h2>🔧 HTTP 头规则</h2>
                    <HttpRulesManager
                        rules={httpRules}
                        onChange={setHttpRules}
                    />
                </section>

                {/* 验证码识别 */}
                <section className="section">
                    <h2>🔍 验证码自动识别</h2>
                    <div className="option-group">
                        <OptionItem
                            title="自动识别验证码"
                            description="自动识别网页中的验证码图片并填充到输入框"
                            checked={config.ocr?.autoRecognize || false}
                            onChange={(checked) => updateConfig('ocr.autoRecognize', checked)}
                        />
                        <div className="form-item">
                            <label>OCR API 地址</label>
                            <input
                                type="url"
                                value={config.ocr?.apiUrl || 'https://api.hackshen.com/ocr'}
                                onChange={(e) => updateConfig('ocr.apiUrl', e.target.value)}
                                placeholder="https://api.hackshen.com/ocr"
                            />
                            <p className="hint">
                                💡 开启后，将自动识别页面中的验证码图片<br />
                                支持常见的验证码输入框自动填充
                            </p>
                        </div>
                    </div>
                </section>

                {/* 代理管理 */}
                <section className="section">
                    <h2>🌐 代理管理</h2>
                    <ProxyManager
                        proxyConfig={config.proxy || DEFAULT_CONFIG.proxy}
                        onChange={(proxyConfig) => updateConfig('proxy', proxyConfig)}
                    />
                </section>

                {/* Auto-Login 凭证管理 */}
                <section className="section">
                    <h2>🔐 Auto-Login 凭证管理</h2>
                    <div className="option-group">
                        <OptionItem
                            title="启用 Auto-Login"
                            description="开启后页面显示悬浮球，可一键填充登录"
                            checked={config.features.autoLogin !== false}
                            onChange={(checked) => updateConfig('features.autoLogin', checked)}
                        />
                        <OptionItem
                            title="显示悬浮球"
                            description="在所有页面显示悬浮球（关闭后即便已配置站点也无法快速填充）"
                            checked={!(config.autoLogin && config.autoLogin.showBall === false)}
                            onChange={(checked) => updateConfig('autoLogin.showBall', checked)}
                        />
                    </div>
                    <SiteProfileManager />
                </section>

                {/* SourceMap 注入管理 */}
                <section className="section">
                    <h2>🗺️ SourceMap 注入</h2>
                    <SourceMapManager
                        sourcemapConfig={config.sourcemap || DEFAULT_CONFIG.sourcemap}
                        onChange={(sourcemapConfig) => updateConfig('sourcemap', sourcemapConfig)}
                    />
                </section>

                {/* 数据管理 */}
                <section className="section">
                    <h2>💾 数据管理</h2>
                    <div className="option-group">
                        <div className="data-info">
                            <p>💾 已保存的认证数据</p>
                            <SavedDataDisplay data={savedData} />
                        </div>
                        <button className="btn btn-danger" onClick={handleClearData}>
                            🗑️ 清除所有保存的数据
                        </button>
                    </div>
                </section>

                {/* 关于 */}
                <section className="section">
                    <h2>ℹ️ 关于</h2>
                    <div className="about">
                        <p><strong>版本:</strong> 1.0.0</p>
                        <p><strong>作者:</strong> Hshen</p>
                        <p><strong>博客:</strong> <a href="http://hackshen.com" target="_blank" rel="noopener noreferrer">hackshen.com</a></p>
                        <p><strong>工具库:</strong> <a href="https://tools.hackshen.com" target="_blank" rel="noopener noreferrer">tools.hackshen.com</a></p>
                    </div>
                </section>
            </main>

            <footer>
                <div className="actions">
                    <button className="btn btn-primary" onClick={handleSave}>
                        💾 保存设置
                    </button>
                    <button className="btn btn-secondary" onClick={handleReset}>
                        🔄 恢复默认
                    </button>
                </div>
                {status.message && (
                    <div className={`status ${status.type}`}>
                        {status.message}
                    </div>
                )}
            </footer>
        </div>
    );
}

// ============ 子组件 ============

// HTTP 规则管理组件

// ============ 拆分组件（按功能域） ============
import { HttpRulesManager } from './options/http-rules.js';
import { SiteProfileManager } from './options/auto-login.js';
import { OptionItem, SavedDataDisplay } from './options/common.js';
import { ProxyManager } from './options/proxy.js';
import { SourceMapManager } from './options/sourcemap.js';

// ============ 渲染应用 ============
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<OptionsApp />);
