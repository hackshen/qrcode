import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './options.css';

// ============ 默认配置 ============
const DEFAULT_CONFIG = {
    // 功能开关
    features: {
        doubleCopyClick: false,
        passwordReveal: true,
        // globalErrorMonitor: false,
        // sourcemapMonitor: false,
    },
    // API 配置
    api: {
        message: 'https://api.hackshen.com/message',
    },
    // CDN 配置
    cdn: {
        jquery: 'https://libs.baidu.com/jquery/2.0.0/jquery.min.js',
    },
    // SourceMap 域名
    // sourcemapDomains: [],
    // HTTP 头规则
    httpRules: [
        {
            id: 'lotsmall',
            enabled: true,
            name: 'Lotsmall 防盗链',
            urlFilter: '*://statics.lotsmall.cn/*',
            headerType: 'request',
            headerName: 'Referer',
            headerValue: 'https://wap.lotsmall.cn/'
        },
        {
            id: 'juejin',
            enabled: true,
            name: '掘金图片防盗链',
            urlFilter: '*://p3-juejin.byteimg.com/*',
            headerType: 'request',
            headerName: 'Referer',
            headerValue: 'https://juejin.cn/'
        },
        {
            id: 'huangshan',
            enabled: true,
            name: '黄山 CORS',
            urlFilter: '*://statics.huangshan.com.cn/*',
            headerType: 'response',
            headerName: 'Access-Control-Allow-Origin',
            headerValue: '*'
        }
    ],
    // OCR 验证码识别
    ocr: {
        apiUrl: 'https://api.hackshen.com/ocr',
        autoRecognize: true  // 自动识别页面验证码
    },
    // 代理配置
    proxy: {
        enabled: false,
        mode: 'direct', // 'direct' | 'system' | 'auto_switch' | 'fixed'
        currentProfile: null, // 当前使用的代理配置 ID
        profiles: [], // 代理配置列表
        rules: [] // 自动切换规则
    }
};

// ============ React 组件 ============

function OptionsApp() {
    // State
    const [config, setConfig] = useState(DEFAULT_CONFIG);
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
            const result = await chrome.storage.sync.get('extensionConfig');
            // 合并默认配置，确保所有字段都存在
            const loadedConfig = result.extensionConfig
                ? { ...DEFAULT_CONFIG, ...result.extensionConfig, ocr: { ...DEFAULT_CONFIG.ocr, ...result.extensionConfig.ocr } }
                : DEFAULT_CONFIG;
            setConfig(loadedConfig);
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
            await chrome.storage.sync.set({ extensionConfig: config });
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

    // 恢复默认
    const handleReset = async () => {
        if (confirm('确定要恢复默认设置吗？')) {
            setConfig(DEFAULT_CONFIG);
            try {
                await chrome.storage.sync.set({ extensionConfig: DEFAULT_CONFIG });
                showStatus('✅ 已恢复默认设置', 'success');
            } catch (error) {
                showStatus('❌ 恢复失败，请重试', 'error');
            }
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
                        rules={config.httpRules || []}
                        onChange={(rules) => updateConfig('httpRules', rules)}
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
function HttpRulesManager({ rules, onChange }) {
    const [editingRule, setEditingRule] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const fileInputRef = useRef(null);

    // 切换规则启用状态
    const toggleRule = (id) => {
        const newRules = rules.map(rule =>
            rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
        );
        onChange(newRules);
    };

    // 删除规则
    const deleteRule = (id) => {
        if (confirm('确定要删除这条规则吗？')) {
            onChange(rules.filter(rule => rule.id !== id));
        }
    };

    // 添加规则
    const addRule = (newRule) => {
        onChange([...rules, { ...newRule, id: Date.now().toString() }]);
        setShowAddForm(false);
    };

    // 更新规则
    const updateRule = (updatedRule) => {
        onChange(rules.map(rule => rule.id === updatedRule.id ? updatedRule : rule));
        setEditingRule(null);
    };

    // 导出规则
    const handleExport = () => {
        try {
            const dataStr = JSON.stringify(rules, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `http-rules-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            alert('✅ 规则导出成功！');
        } catch (error) {
            console.error('导出失败:', error);
            alert('❌ 导出失败，请重试');
        }
    };

    // 导入规则
    const handleImport = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedRules = JSON.parse(e.target.result);

                // 验证数据格式
                if (!Array.isArray(importedRules)) {
                    throw new Error('导入的文件格式不正确');
                }

                // 验证每条规则的必填字段
                const isValid = importedRules.every(rule =>
                    rule.name && rule.urlFilter && rule.headerType &&
                    rule.headerName && rule.headerValue
                );

                if (!isValid) {
                    throw new Error('规则数据不完整');
                }

                // 确认导入
                const confirmMsg = `确定要导入 ${importedRules.length} 条规则吗？\n这将替换当前所有规则！`;
                if (confirm(confirmMsg)) {
                    // 为每条规则生成新的 ID
                    const rulesWithNewIds = importedRules.map((rule, index) => ({
                        ...rule,
                        id: `imported-${Date.now()}-${index}`
                    }));
                    onChange(rulesWithNewIds);
                    alert(`✅ 成功导入 ${importedRules.length} 条规则！`);
                }
            } catch (error) {
                console.error('导入失败:', error);
                alert(`❌ 导入失败：${error.message}`);
            }

            // 清空文件输入
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        };

        reader.onerror = () => {
            alert('❌ 文件读取失败');
        };

        reader.readAsText(file);
    };

    // 合并导入（追加而不是替换）
    const handleMergeImport = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedRules = JSON.parse(e.target.result);

                if (!Array.isArray(importedRules)) {
                    throw new Error('导入的文件格式不正确');
                }

                const isValid = importedRules.every(rule =>
                    rule.name && rule.urlFilter && rule.headerType &&
                    rule.headerName && rule.headerValue
                );

                if (!isValid) {
                    throw new Error('规则数据不完整');
                }

                const confirmMsg = `确定要合并导入 ${importedRules.length} 条规则吗？\n将追加到现有规则后面`;
                if (confirm(confirmMsg)) {
                    const rulesWithNewIds = importedRules.map((rule, index) => ({
                        ...rule,
                        id: `imported-${Date.now()}-${index}`
                    }));
                    onChange([...rules, ...rulesWithNewIds]);
                    alert(`✅ 成功合并导入 ${importedRules.length} 条规则！`);
                }
            } catch (error) {
                console.error('合并导入失败:', error);
                alert(`❌ 合并导入失败：${error.message}`);
            }

            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        };

        reader.readAsText(file);
    };

    return (
        <div className="http-rules">
            <div className="rules-list">
                {rules.map(rule => (
                    <div key={rule.id} className="rule-item">
                        <div className="rule-header">
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={rule.enabled}
                                    onChange={() => toggleRule(rule.id)}
                                />
                                <span className="slider"></span>
                            </label>
                            <div className="rule-info">
                                <h4>{rule.name}</h4>
                                <p className="rule-detail">
                                    <code>{rule.urlFilter}</code> →
                                    <span className={`header-type ${rule.headerType}`}>
                                        {rule.headerType === 'request' ? '请求头' : '响应头'}
                                    </span>
                                    <code>{rule.headerName}: {rule.headerValue}</code>
                                </p>
                            </div>
                            <div className="rule-actions">
                                <button
                                    className="btn-icon"
                                    onClick={() => setEditingRule(rule)}
                                    title="编辑"
                                >
                                    ✏️
                                </button>
                                <button
                                    className="btn-icon"
                                    onClick={() => deleteRule(rule.id)}
                                    title="删除"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="rules-actions" style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowAddForm(true)}
                >
                    ➕ 添加新规则
                </button>

                <button
                    className="btn btn-secondary"
                    onClick={handleExport}
                    disabled={rules.length === 0}
                    title={rules.length === 0 ? '没有规则可导出' : '导出为 JSON 文件'}
                >
                    📥 导出规则 ({rules.length})
                </button>

                <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                    📤 替换导入
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        style={{ display: 'none' }}
                    />
                </label>

                <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                    ➕ 合并导入
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleMergeImport}
                        style={{ display: 'none' }}
                    />
                </label>
            </div>

            {/* 添加/编辑表单 */}
            {(showAddForm || editingRule) && (
                <RuleForm
                    rule={editingRule}
                    onSave={editingRule ? updateRule : addRule}
                    onCancel={() => {
                        setShowAddForm(false);
                        setEditingRule(null);
                    }}
                />
            )}
        </div>
    );
}

// 规则表单组件
function RuleForm({ rule, onSave, onCancel }) {
    const [formData, setFormData] = useState(rule || {
        name: '',
        urlFilter: '',
        headerType: 'request',
        headerName: '',
        headerValue: '',
        enabled: true
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.urlFilter || !formData.headerName || !formData.headerValue) {
            alert('请填写所有必填项');
            return;
        }
        onSave(formData);
    };

    return (
        <div className="rule-form-overlay">
            <div className="rule-form">
                <h3>{rule ? '编辑规则' : '添加规则'}</h3>
                <form onSubmit={handleSubmit}>
                    <div className="form-item">
                        <label>规则名称 *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="例如：掘金图片防盗链"
                        />
                    </div>

                    <div className="form-item">
                        <label>URL 匹配规则 *</label>
                        <input
                            type="text"
                            value={formData.urlFilter}
                            onChange={(e) => setFormData({ ...formData, urlFilter: e.target.value })}
                            placeholder="例如：*://cdn.example.com/*"
                        />
                        <p className="hint">支持通配符 *，例如 *://domain.com/*</p>
                    </div>

                    <div className="form-item">
                        <label>头类型 *</label>
                        <select
                            value={formData.headerType}
                            onChange={(e) => setFormData({ ...formData, headerType: e.target.value })}
                        >
                            <option value="request">请求头（Request Header）</option>
                            <option value="response">响应头（Response Header - 仅 CORS）</option>
                        </select>
                        {formData.headerType === 'response' && (
                            <p className="hint" style={{ color: '#ff4d4f', marginTop: '5px' }}>
                                ⚠️ Chrome 只允许修改 CORS 相关响应头：<br />
                                Access-Control-Allow-Origin, Access-Control-Allow-Credentials,<br />
                                Access-Control-Allow-Headers, Access-Control-Allow-Methods
                            </p>
                        )}
                    </div>

                    <div className="form-item">
                        <label>Header 名称 *</label>
                        <input
                            type="text"
                            value={formData.headerName}
                            onChange={(e) => setFormData({ ...formData, headerName: e.target.value })}
                            placeholder="例如：Referer 或 Access-Control-Allow-Origin"
                        />
                    </div>

                    <div className="form-item">
                        <label>Header 值 *</label>
                        <input
                            type="text"
                            value={formData.headerValue}
                            onChange={(e) => setFormData({ ...formData, headerValue: e.target.value })}
                            placeholder="例如：https://example.com/ 或 *"
                        />
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn btn-primary">
                            {rule ? '更新' : '添加'}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={onCancel}>
                            取消
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// 开关选项组件
function OptionItem({ title, description, checked, onChange }) {
    return (
        <div className="option-item">
            <label className="switch">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <span className="slider"></span>
            </label>
            <div className="option-info">
                <h3>{title}</h3>
                <p>{description}</p>
            </div>
        </div>
    );
}

// 代理管理组件
function ProxyManager({ proxyConfig, onChange }) {
    const [editingProfile, setEditingProfile] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [showRuleForm, setShowRuleForm] = useState(false);

    // 切换代理启用状态
    const handleToggleProxy = async (enabled) => {
        const newConfig = { ...proxyConfig, enabled };
        onChange(newConfig);
        await applyProxySettings(newConfig);
    };

    // 切换代理模式
    const handleModeChange = async (mode) => {
        const newConfig = { ...proxyConfig, mode };
        // 如果切换到 fixed 模式，确保如果有选择的代理配置，则启用代理
        if (mode === 'fixed' && newConfig.currentProfile) {
            newConfig.enabled = true; // 如果有选择的代理，自动启用
        }
        // 如果切换到 fixed 模式但没有选择代理，提示用户
        if (mode === 'fixed' && !newConfig.currentProfile && newConfig.profiles && newConfig.profiles.length > 0) {
            // 不自动选择，让用户手动选择
        }
        console.log('🔧 切换代理模式:', {
            mode,
            enabled: newConfig.enabled,
            currentProfile: newConfig.currentProfile
        });
        onChange(newConfig);
        await applyProxySettings(newConfig);
    };

    // 应用代理设置（通过 background script）
    const applyProxySettings = async (config) => {
        try {
            console.log('🔧 发送代理设置请求:', {
                enabled: config.enabled,
                mode: config.mode,
                currentProfile: config.currentProfile,
                hasProfiles: !!config.profiles?.length
            });
            
            // 通过消息传递调用 background script 设置代理
            chrome.runtime.sendMessage({
                action: 'setProxy',
                config: config
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ 应用代理设置失败:', chrome.runtime.lastError);
                    alert('❌ 应用代理设置失败: ' + chrome.runtime.lastError.message);
                    return;
                }

                if (response && response.success) {
                    console.log('✅ 代理设置成功');
                } else if (response && response.error) {
                    console.error('❌ 应用代理设置失败:', response.error);
                    alert('❌ 应用代理设置失败: ' + response.error);
                } else {
                    console.warn('⚠️ 未收到响应或响应格式异常:', response);
                }
            });
        } catch (error) {
            console.error('❌ 应用代理设置失败:', error);
            alert('❌ 应用代理设置失败: ' + error.message);
        }
    };

    // 添加代理配置
    const addProfile = (profile) => {
        const newProfiles = [...(proxyConfig.profiles || []), {
            ...profile,
            id: Date.now().toString()
        }];
        onChange({ ...proxyConfig, profiles: newProfiles });
        setShowAddForm(false);
    };

    // 更新代理配置
    const updateProfile = (updatedProfile) => {
        const newProfiles = (proxyConfig.profiles || []).map(p =>
            p.id === updatedProfile.id ? updatedProfile : p
        );
        onChange({ ...proxyConfig, profiles: newProfiles });
        setEditingProfile(null);
    };

    // 删除代理配置
    const deleteProfile = (id) => {
        if (confirm('确定要删除这个代理配置吗？')) {
            const newProfiles = (proxyConfig.profiles || []).filter(p => p.id !== id);
            const newConfig = { ...proxyConfig, profiles: newProfiles };
            if (newConfig.currentProfile === id) {
                newConfig.currentProfile = null;
            }
            onChange(newConfig);
        }
    };

    // 切换当前使用的代理
    const switchProfile = async (id) => {
        if (!id) {
            // 如果清空选择，清除代理
            const newConfig = { ...proxyConfig, currentProfile: null, mode: 'fixed', enabled: false };
            onChange(newConfig);
            await applyProxySettings(newConfig);
            return;
        }
        
        // 选择代理时，确保启用代理和 fixed 模式
        const newConfig = { 
            ...proxyConfig, 
            currentProfile: id, 
            mode: 'fixed', 
            enabled: true  // 强制启用代理
        };
        console.log('🔧 切换代理配置:', {
            id,
            enabled: newConfig.enabled,
            mode: newConfig.mode,
            profile: newConfig.profiles?.find(p => p.id === id)
        });
        onChange(newConfig);
        await applyProxySettings(newConfig);
    };

    // 添加切换规则
    const addRule = (rule) => {
        const newRules = [...(proxyConfig.rules || []), {
            ...rule,
            id: Date.now().toString()
        }];
        onChange({ ...proxyConfig, rules: newRules });
        setShowRuleForm(false);
    };

    // 更新切换规则
    const updateRule = (updatedRule) => {
        const newRules = (proxyConfig.rules || []).map(r =>
            r.id === updatedRule.id ? updatedRule : r
        );
        onChange({ ...proxyConfig, rules: newRules });
        setEditingRule(null);
    };

    // 删除切换规则
    const deleteRule = (id) => {
        if (confirm('确定要删除这条规则吗？')) {
            const newRules = (proxyConfig.rules || []).filter(r => r.id !== id);
            onChange({ ...proxyConfig, rules: newRules });
        }
    };

    return (
        <div className="proxy-manager">
            {/* 代理总开关 */}
            <div className="option-group" style={{ marginBottom: '20px' }}>
                <OptionItem
                    title="启用代理"
                    description="开启后，浏览器将使用配置的代理服务器"
                    checked={proxyConfig.enabled || false}
                    onChange={handleToggleProxy}
                />
            </div>

            {proxyConfig.enabled && (
                <>
                    {/* 代理模式选择 */}
                    <div className="form-item" style={{ marginBottom: '20px' }}>
                        <label>代理模式</label>
                        <select
                            value={proxyConfig.mode || 'direct'}
                            onChange={(e) => handleModeChange(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid #e8e8e8' }}
                        >
                            <option value="direct">直连（不使用代理）</option>
                            <option value="system">使用系统代理设置</option>
                            <option value="fixed">固定代理</option>
                            <option value="auto_switch">自动切换（根据规则）</option>
                        </select>
                        <p className="hint">
                            {proxyConfig.mode === 'fixed' && '选择一个代理配置作为固定代理'}
                            {proxyConfig.mode === 'auto_switch' && '根据规则自动切换不同的代理'}
                        </p>
                    </div>

                    {/* 固定代理模式 - 选择代理配置 */}
                    {proxyConfig.mode === 'fixed' && (
                        <div className="form-item" style={{ marginBottom: '20px' }}>
                            <label>选择代理配置</label>
                            <select
                                value={proxyConfig.currentProfile || ''}
                                onChange={(e) => switchProfile(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '2px solid #e8e8e8' }}
                            >
                                <option value="">请选择代理配置</option>
                                {(proxyConfig.profiles || []).map(profile => (
                                    <option key={profile.id} value={profile.id}>
                                        {profile.name} ({profile.scheme}://{profile.host}:{profile.port})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* 代理配置列表 */}
                    <div className="proxy-profiles" style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ fontSize: '16px', color: '#333' }}>代理配置列表</h3>
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowAddForm(true)}
                                style={{ padding: '8px 16px', fontSize: '14px' }}
                            >
                                ➕ 添加代理
                            </button>
                        </div>

                        <div className="profiles-list">
                            {(proxyConfig.profiles || []).map(profile => (
                                <div key={profile.id} className="profile-item">
                                    <div className="profile-header">
                                        <div className="profile-info">
                                            <h4>{profile.name}</h4>
                                            <p className="profile-detail">
                                                <code>{profile.scheme}://{profile.host}:{profile.port}</code>
                                                {profile.username && <span> (认证: {profile.username})</span>}
                                            </p>
                                        </div>
                                        <div className="profile-actions">
                                            {proxyConfig.mode === 'fixed' && proxyConfig.currentProfile === profile.id && (
                                                <span className="badge active">当前使用</span>
                                            )}
                                            <button
                                                className="btn-icon"
                                                onClick={() => switchProfile(profile.id)}
                                                title="使用此代理"
                                            >
                                                ✅
                                            </button>
                                            <button
                                                className="btn-icon"
                                                onClick={() => setEditingProfile(profile)}
                                                title="编辑"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="btn-icon"
                                                onClick={() => deleteProfile(profile.id)}
                                                title="删除"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(proxyConfig.profiles || []).length === 0 && (
                                <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                                    暂无代理配置，点击"添加代理"创建
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 自动切换规则（仅在 auto_switch 模式显示） */}
                    {proxyConfig.mode === 'auto_switch' && (
                        <div className="proxy-rules" style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ fontSize: '16px', color: '#333' }}>自动切换规则</h3>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowRuleForm(true)}
                                    style={{ padding: '8px 16px', fontSize: '14px' }}
                                >
                                    ➕ 添加规则
                                </button>
                            </div>

                            <div className="rules-list">
                                {(proxyConfig.rules || []).map(rule => (
                                    <div key={rule.id} className="rule-item">
                                        <div className="rule-header">
                                            <div className="rule-info">
                                                <h4>{rule.name}</h4>
                                                <p className="rule-detail">
                                                    条件: {rule.conditions.map(c => c.value).join(', ')} →
                                                    使用: {rule.profile?.name || '未配置'}
                                                </p>
                                            </div>
                                            <div className="rule-actions">
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => setEditingRule(rule)}
                                                    title="编辑"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => deleteRule(rule.id)}
                                                    title="删除"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(proxyConfig.rules || []).length === 0 && (
                                    <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                                        暂无切换规则，点击"添加规则"创建
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* 添加/编辑代理配置表单 */}
            {(showAddForm || editingProfile) && (
                <ProxyProfileForm
                    profile={editingProfile}
                    profiles={proxyConfig.profiles || []}
                    onSave={editingProfile ? updateProfile : addProfile}
                    onCancel={() => {
                        setShowAddForm(false);
                        setEditingProfile(null);
                    }}
                />
            )}

            {/* 添加/编辑切换规则表单 */}
            {(showRuleForm || editingRule) && (
                <ProxyRuleForm
                    rule={editingRule}
                    profiles={proxyConfig.profiles || []}
                    onSave={editingRule ? updateRule : addRule}
                    onCancel={() => {
                        setShowRuleForm(false);
                        setEditingRule(null);
                    }}
                />
            )}
        </div>
    );
}

// 代理配置表单组件
function ProxyProfileForm({ profile, profiles, onSave, onCancel }) {
    const [formData, setFormData] = useState(profile || {
        name: '',
        scheme: 'http',
        host: '',
        port: '8080',
        username: '',
        password: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.host || !formData.port) {
            alert('请填写所有必填项');
            return;
        }
        onSave(formData);
    };

    return (
        <div className="rule-form-overlay">
            <div className="rule-form">
                <h3>{profile ? '编辑代理配置' : '添加代理配置'}</h3>
                <form onSubmit={handleSubmit}>
                    <div className="form-item">
                        <label>配置名称 *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="例如：公司代理"
                        />
                    </div>

                    <div className="form-item">
                        <label>代理协议 *</label>
                        <select
                            value={formData.scheme}
                            onChange={(e) => setFormData({ ...formData, scheme: e.target.value })}
                        >
                            <option value="http">HTTP</option>
                            <option value="https">HTTPS</option>
                            <option value="socks4">SOCKS4</option>
                            <option value="socks5">SOCKS5</option>
                        </select>
                    </div>

                    <div className="form-item">
                        <label>代理地址 *</label>
                        <input
                            type="text"
                            value={formData.host}
                            onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                            placeholder="例如：proxy.example.com 或 192.168.1.1"
                        />
                    </div>

                    <div className="form-item">
                        <label>端口 *</label>
                        <input
                            type="number"
                            value={formData.port}
                            onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                            placeholder="例如：8080"
                            min="1"
                            max="65535"
                        />
                    </div>

                    <div className="form-item">
                        <label>用户名（可选）</label>
                        <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            placeholder="代理认证用户名"
                        />
                    </div>

                    <div className="form-item">
                        <label>密码（可选）</label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="代理认证密码"
                        />
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn btn-primary">
                            {profile ? '更新' : '添加'}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={onCancel}>
                            取消
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// 代理规则表单组件
function ProxyRuleForm({ rule, profiles, onSave, onCancel }) {
    const [formData, setFormData] = useState(rule || {
        name: '',
        conditions: [{ type: 'hostContains', value: '' }],
        profileId: ''
    });

    const addCondition = () => {
        setFormData({
            ...formData,
            conditions: [...formData.conditions, { type: 'hostContains', value: '' }]
        });
    };

    const removeCondition = (index) => {
        const newConditions = formData.conditions.filter((_, i) => i !== index);
        setFormData({ ...formData, conditions: newConditions });
    };

    const updateCondition = (index, field, value) => {
        const newConditions = [...formData.conditions];
        newConditions[index] = { ...newConditions[index], [field]: value };
        setFormData({ ...formData, conditions: newConditions });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || formData.conditions.length === 0 || !formData.profileId) {
            alert('请填写所有必填项');
            return;
        }

        const profile = profiles.find(p => p.id === formData.profileId);
        if (!profile) {
            alert('请选择有效的代理配置');
            return;
        }

        onSave({
            ...formData,
            profile: profile
        });
    };

    return (
        <div className="rule-form-overlay">
            <div className="rule-form">
                <h3>{rule ? '编辑切换规则' : '添加切换规则'}</h3>
                <form onSubmit={handleSubmit}>
                    <div className="form-item">
                        <label>规则名称 *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="例如：内网使用代理"
                        />
                    </div>

                    <div className="form-item">
                        <label>匹配条件 *</label>
                        {formData.conditions.map((condition, index) => (
                            <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                <select
                                    value={condition.type}
                                    onChange={(e) => updateCondition(index, 'type', e.target.value)}
                                    style={{ flex: '0 0 150px' }}
                                >
                                    <option value="hostContains">域名包含</option>
                                    <option value="urlMatches">URL 匹配</option>
                                </select>
                                <input
                                    type="text"
                                    value={condition.value}
                                    onChange={(e) => updateCondition(index, 'value', e.target.value)}
                                    placeholder={condition.type === 'hostContains' ? '例如：example.com' : '例如：*://example.com/*'}
                                    style={{ flex: 1 }}
                                />
                                {formData.conditions.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeCondition(index)}
                                        className="btn btn-danger"
                                        style={{ padding: '8px 12px' }}
                                    >
                                        删除
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addCondition}
                            className="btn btn-secondary"
                            style={{ marginTop: '10px' }}
                        >
                            ➕ 添加条件
                        </button>
                        <p className="hint">多个条件之间为"或"关系（满足任一条件即匹配）</p>
                    </div>

                    <div className="form-item">
                        <label>使用的代理配置 *</label>
                        <select
                            value={formData.profileId}
                            onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
                        >
                            <option value="">请选择代理配置</option>
                            {profiles.map(profile => (
                                <option key={profile.id} value={profile.id}>
                                    {profile.name} ({profile.scheme}://{profile.host}:{profile.port})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn btn-primary">
                            {rule ? '更新' : '添加'}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={onCancel}>
                            取消
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// 保存数据显示组件
function SavedDataDisplay({ data }) {
    if (!data || (!data.sessionid && !data.tyAuthToken)) {
        return (
            <div className="saved-data">
                <p className="loading">暂无保存的数据</p>
            </div>
        );
    }

    return (
        <div className="saved-data">
            <p><strong>SESSIONID:</strong> {data.sessionid ? '已保存 ✅' : '未保存 ❌'}</p>
            <p><strong>tyAuthToken:</strong> {data.tyAuthToken ? '已保存 ✅' : '未保存 ❌'}</p>
            <p><strong>保存时间:</strong> {data.savedTime ? new Date(data.savedTime).toLocaleString('zh-CN') : '-'}</p>
            <p><strong>来源页面:</strong> {data.savedUrl ? <a href={data.savedUrl} target="_blank" rel="noopener noreferrer">{data.savedUrl}</a> : '-'}</p>
        </div>
    );
}

// ============ 渲染应用 ============
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<OptionsApp />);
