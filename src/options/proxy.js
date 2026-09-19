// 注：本文件由 options.js 拆出，属纯代码搬移，逻辑未变
import { useState } from 'react';
import { OptionItem } from './common.js';

export function ProxyManager({ proxyConfig, onChange }) {
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
export function ProxyProfileForm({ profile, onSave, onCancel }) {
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
export function ProxyRuleForm({ rule, profiles, onSave, onCancel }) {
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
