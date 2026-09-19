// 注：本文件由 options.js 拆出，属纯代码搬移，逻辑未变
import { useState, useRef } from 'react';

export function HttpRulesManager({ rules, onChange }) {
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

                // 验证每条规则的必填字段（remove 操作无需 headerValue）
                const isValid = importedRules.every(rule =>
                    rule.name && rule.urlFilter && rule.headerType &&
                    rule.headerName && (rule.operation === 'remove' || rule.headerValue)
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
                        operation: rule.operation || 'set',
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
                    rule.headerName && (rule.operation === 'remove' || rule.headerValue)
                );

                if (!isValid) {
                    throw new Error('规则数据不完整');
                }

                const confirmMsg = `确定要合并导入 ${importedRules.length} 条规则吗？\n将追加到现有规则后面`;
                if (confirm(confirmMsg)) {
                    const rulesWithNewIds = importedRules.map((rule, index) => ({
                        ...rule,
                        operation: rule.operation || 'set',
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
                                    {rule.operation === 'remove' &&
                                        <span className="header-type remove">删除</span>
                                    }
                                    <code>{rule.operation === 'remove' ? rule.headerName : `${rule.headerName}: ${rule.headerValue}`}</code>
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
            <p className="hint" style={{ marginTop: '8px' }}>
                💡 规则添加/修改/启停/导入后会<b>自动保存</b>并立即生效，无需点击页面底部的“保存设置”（该按钮用于其他配置项）
            </p>

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
export function RuleForm({ rule, onSave, onCancel }) {
    const [formData, setFormData] = useState(rule || {
        name: '',
        urlFilter: '',
        headerType: 'request',
        operation: 'set',
        headerName: '',
        headerValue: '',
        enabled: true
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const needValue = formData.operation !== 'remove';
        if (!formData.name || !formData.urlFilter || !formData.headerName || (needValue && !formData.headerValue)) {
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
                            <option value="response">响应头（Response Header）</option>
                        </select>
                    </div>

                    <div className="form-item">
                        <label>操作方式 *</label>
                        <select
                            value={formData.operation || 'set'}
                            onChange={(e) => setFormData({ ...formData, operation: e.target.value })}
                        >
                            <option value="set">设置（覆盖 Header 值）</option>
                            <option value="remove">删除（移除该 Header）</option>
                        </select>
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
                        <label>Header 值 {formData.operation === 'remove' ? '' : '*'}</label>
                        <input
                            type="text"
                            value={formData.headerValue}
                            onChange={(e) => setFormData({ ...formData, headerValue: e.target.value })}
                            placeholder="例如：https://example.com/ 或 *"
                            disabled={formData.operation === 'remove'}
                        />
                        {formData.operation === 'remove' && (
                            <p className="hint">删除模式下无需填写值</p>
                        )}
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn btn-primary">
                            {rule ? '更新' : '添加'}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={onCancel}>
                            取消
                        </button>
                    </div>
                    <p className="hint" style={{ marginTop: '8px' }}>💡 点击“{rule ? '更新' : '添加'}”后规则将自动保存并生效</p>
                </form>
            </div>
        </div>
    );
}
