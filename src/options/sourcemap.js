// 注：本文件由 options.js 拆出，属纯代码搬移，逻辑未变
import { useState } from 'react';

export function SourceMapManager({ sourcemapConfig, onChange }) {
    const [editingRule, setEditingRule] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);

    // 切换 SourceMap 启用状态
    const handleToggleSourceMap = (enabled) => {
        const newConfig = { ...sourcemapConfig, enabled };
        onChange(newConfig);
    };

    // 添加规则
    const addRule = (rule) => {
        const newRules = [...(sourcemapConfig.rules || []), {
            ...rule,
            id: Date.now().toString()
        }];
        onChange({ ...sourcemapConfig, rules: newRules });
        setShowAddForm(false);
    };

    // 更新规则
    const updateRule = (updatedRule) => {
        const newRules = (sourcemapConfig.rules || []).map(r =>
            r.id === updatedRule.id ? updatedRule : r
        );
        onChange({ ...sourcemapConfig, rules: newRules });
        setEditingRule(null);
    };

    // 删除规则
    const deleteRule = (id) => {
        if (confirm('确定要删除这条规则吗？')) {
            const newRules = (sourcemapConfig.rules || []).filter(r => r.id !== id);
            onChange({ ...sourcemapConfig, rules: newRules });
        }
    };

    // 切换规则启用状态
    const toggleRule = (id) => {
        const newRules = (sourcemapConfig.rules || []).map(rule =>
            rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
        );
        onChange({ ...sourcemapConfig, rules: newRules });
    };

    return (
        <div className="sourcemap-manager">
            {/* SourceMap 总开关 */}
            <div className="option-group" style={{ marginBottom: '20px' }}>
                <OptionItem
                    title="启用 SourceMap 注入"
                    description="使用 CDP 为指定的 JS 文件自动注入 SourceMap 响应头（需在 DevTools 中打开）"
                    checked={sourcemapConfig.enabled || false}
                    onChange={handleToggleSourceMap}
                />
                <p className="hint" style={{ marginTop: '10px', color: '#666' }}>
                    ⚠️ 注意：启用后需要打开 DevTools 才会生效，会显示"正在调试此浏览器"提示
                </p>
            </div>

            {sourcemapConfig.enabled && (
                <>
                    {/* 规则列表 */}
                    <div className="sourcemap-rules" style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ fontSize: '16px', color: '#333' }}>注入规则列表</h3>
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowAddForm(true)}
                                style={{ padding: '8px 16px', fontSize: '14px' }}
                            >
                                ➕ 添加规则
                            </button>
                        </div>

                        <div className="rules-list">
                            {(sourcemapConfig.rules || []).map(rule => (
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
                                                <code>{rule.urlPattern}</code> →
                                                <span style={{ margin: '0 8px', color: '#52c41a' }}>SourceMap</span>
                                                <code>{rule.sourceMapUrl || '${url}.map'}</code>
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
                            {(sourcemapConfig.rules || []).length === 0 && (
                                <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                                    暂无注入规则，点击"添加规则"创建
                                </p>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* 添加/编辑规则表单 */}
            {(showAddForm || editingRule) && (
                <SourceMapRuleForm
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

// SourceMap 规则表单组件
export function SourceMapRuleForm({ rule, onSave, onCancel }) {
    const [formData, setFormData] = useState(rule || {
        name: '',
        urlPattern: '',
        sourceMapUrl: '',
        enabled: true
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.urlPattern) {
            alert('请填写所有必填项');
            return;
        }
        onSave(formData);
    };

    return (
        <div className="rule-form-overlay">
            <div className="rule-form">
                <h3>{rule ? '编辑 SourceMap 规则' : '添加 SourceMap 规则'}</h3>
                <form onSubmit={handleSubmit}>
                    <div className="form-item">
                        <label>规则名称 *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="例如：生产环境 JS"
                        />
                    </div>

                    <div className="form-item">
                        <label>URL 匹配规则 *</label>
                        <input
                            type="text"
                            value={formData.urlPattern}
                            onChange={(e) => setFormData({ ...formData, urlPattern: e.target.value })}
                            placeholder="例如：*://cdn.example.com/*.js"
                        />
                        <p className="hint">
                            支持通配符 *，例如：<br />
                            • *://cdn.example.com/*.js - 匹配指定域名的所有 JS<br />
                            • *://example.com/static/*.min.js - 匹配压缩后的 JS
                        </p>
                    </div>

                    <div className="form-item">
                        <label>SourceMap URL 模板（可选）</label>
                        <input
                            type="text"
                            value={formData.sourceMapUrl}
                            onChange={(e) => setFormData({ ...formData, sourceMapUrl: e.target.value })}
                            placeholder="留空则自动添加 .map 后缀"
                        />
                        <p className="hint">
                            支持变量替换：<br />
                            • 留空：自动在原 URL 后添加 .map（推荐）<br />
                            • 自定义：可使用变量替换<br />
                            &nbsp;&nbsp;- {'${url}'} - 完整的 JS 文件 URL<br />
                            &nbsp;&nbsp;- {'${path}'} - JS 文件的路径部分（不含文件名）<br />
                            &nbsp;&nbsp;- {'${filename}'} - JS 文件名（含扩展名）<br />
                            &nbsp;&nbsp;- {'${basename}'} - JS 文件名（不含扩展名）<br />
                            例如：https://sourcemap.example.com{'${path}'}/${'{filename}'}.map
                        </p>
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
