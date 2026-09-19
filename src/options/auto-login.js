// 注：本文件由 options.js 拆出，属纯代码搬移，逻辑未变
import { useState, useEffect } from 'react';

export function getETldPlus1(host) {
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
    host = String(host || '').toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');
    if (!host) return '';
    const parts = host.split('.');
    if (parts.length <= 2) return host;
    const last2 = parts.slice(-2).join('.');
    if (EFFECTIVE_SUFFIXES.has(last2)) return parts.slice(-3).join('.');
    return last2;
}

// 密码输入（带显隐切换）
export function PasswordInput({ value, onChange, placeholder }) {
    const [show, setShow] = useState(false);
    return (
        <div className="pw-input">
            <input
                type={show ? 'text' : 'password'}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || ''}
                autoComplete="off"
            />
            <button type="button" className="btn-icon pw-toggle" onClick={() => setShow(!show)}>
                {show ? '🙈' : '👁'}
            </button>
        </div>
    );
}

// 凭证表单（模态）
export function CredentialForm({ cred, onSave, onCancel }) {
    const [formData, setFormData] = useState(cred || { username: '', password: '', note: '' });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.username) {
            alert('请填写用户名');
            return;
        }
        onSave(formData);
    };

    return (
        <div className="rule-form-overlay">
            <div className="rule-form">
                <h3>{cred ? '编辑凭证' : '添加凭证'}</h3>
                <form onSubmit={handleSubmit}>
                    <div className="form-item">
                        <label>用户名 *</label>
                        <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            placeholder="登录用户名 / 手机号 / 邮箱"
                        />
                    </div>
                    <div className="form-item">
                        <label>密码</label>
                        <PasswordInput
                            value={formData.password}
                            onChange={(v) => setFormData({ ...formData, password: v })}
                            placeholder="登录密码"
                        />
                    </div>
                    <div className="form-item">
                        <label>备注</label>
                        <input
                            type="text"
                            value={formData.note || ''}
                            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                            placeholder="如：主号 / 测试号（可选）"
                        />
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="btn btn-primary">
                            {cred ? '更新' : '添加'}
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

// 站点档案管理（自管 storage.local，不走 extensionConfig/handleSave）
export function SiteProfileManager() {
    const [profiles, setProfiles] = useState({});
    const [expanded, setExpanded] = useState(null);
    const [editing, setEditing] = useState(null);   // { eTld, cred }
    const [addingCred, setAddingCred] = useState(null); // eTld
    const [newDomain, setNewDomain] = useState('');

    const load = async () => {
        const data = await chrome.storage.local.get('autoLoginProfiles');
        setProfiles(data.autoLoginProfiles || {});
    };

    useEffect(() => {
        load();
        const listener = (changes, area) => {
            if (area === 'local' && changes.autoLoginProfiles) load();
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    const persist = async (next) => {
        setProfiles(next);
        await chrome.storage.local.set({ autoLoginProfiles: next });
    };

    const restoreAllBalls = async () => {
        await chrome.storage.local.set({ autoLoginBallPrefs: {} });
        alert('已恢复所有站点的悬浮球，刷新对应页面即可重新看到');
    };

    const addSite = () => {
        const cleaned = newDomain.trim().replace(/^https?:\/\//, '').split('/')[0];
        const eTld = getETldPlus1(cleaned);
        if (!eTld) { alert('请输入有效域名'); return; }
        if (profiles[eTld]) { alert('该站点已存在'); return; }
        const next = { ...profiles, [eTld]: { fieldBinding: {}, credentials: [], updatedAt: Date.now() } };
        persist(next);
        setNewDomain('');
        setExpanded(eTld);
    };

    const deleteSite = (eTld) => {
        if (!confirm(`确认删除站点 ${eTld} 及其所有凭证？`)) return;
        const next = { ...profiles };
        delete next[eTld];
        persist(next);
    };

    const saveCredential = (eTld, cred) => {
        const profile = profiles[eTld] || { fieldBinding: {}, credentials: [] };
        const list = profile.credentials || [];
        const newCred = cred.id ? cred : { ...cred, id: 'cred_' + Date.now(), lastUsed: 0 };
        const idx = list.findIndex((c) => c.id === newCred.id);
        if (idx > -1) list[idx] = newCred; else list.push(newCred);
        persist({ ...profiles, [eTld]: { ...profile, credentials: list, updatedAt: Date.now() } });
        setEditing(null);
        setAddingCred(null);
    };

    const deleteCredential = (eTld, credId) => {
        const profile = profiles[eTld] || {};
        const list = (profile.credentials || []).filter((c) => c.id !== credId);
        persist({ ...profiles, [eTld]: { ...profile, credentials: list, updatedAt: Date.now() } });
    };

    const bindingSummary = (profile) => {
        const b = (profile && profile.fieldBinding) || {};
        const parts = [];
        if (b.username) parts.push('账号');
        if (b.password) parts.push('密码');
        if (b.captcha) parts.push('验证码');
        if (b.submit) parts.push('登录按钮');
        return parts.length ? '已捕获：' + parts.join('、') : '未捕获（在页面悬浮球中点「捕获登录框」）';
    };

    const domains = Object.keys(profiles).sort();

    return (
        <div className="option-group">
            <p className="hint" style={{ color: '#fa8c16' }}>
                ⚠️ 密码以明文存储于本地，请勿存放生产/支付等高价值账号。凭证改动即时保存；上方开关需点底部「保存设置」。
            </p>

            <button type="button" className="btn btn-secondary" style={{ marginBottom: '12px' }} onClick={restoreAllBalls}>
                🔄 恢复所有隐藏的悬浮球
            </button>

            <div className="form-item" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                    <label>添加站点</label>
                    <input
                        type="text"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        placeholder="example.com 或 https://login.example.com"
                    />
                </div>
                <button type="button" className="btn btn-primary" onClick={addSite}>+ 添加</button>
            </div>

            <div className="profiles-list">
                {domains.length === 0 && <p className="hint">暂无站点。在页面悬浮球点「⚙ 捕获登录框」后会自动出现。</p>}
                {domains.map((eTld) => {
                    const profile = profiles[eTld];
                    const creds = profile.credentials || [];
                    const isOpen = expanded === eTld;
                    return (
                        <div key={eTld} className="profile-item">
                            <div className="profile-header">
                                <strong style={{ cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : eTld)}>
                                    {eTld}
                                </strong>
                                <span className="hint" style={{ marginLeft: '8px' }}>{creds.length} 条凭证</span>
                                <div className="profile-actions" style={{ marginLeft: 'auto' }}>
                                    <button className="btn-icon" title={isOpen ? '收起' : '展开'} onClick={() => setExpanded(isOpen ? null : eTld)}>
                                        {isOpen ? '▲' : '▼'}
                                    </button>
                                    <button className="btn-icon" title="删除站点" onClick={() => deleteSite(eTld)}>🗑️</button>
                                </div>
                            </div>
                            <p className="hint" style={{ margin: '4px 0' }}>{bindingSummary(profile)}</p>
                            {isOpen && (
                                <>
                                    <div className="field-binding">
                                        <div className="fb-title">已捕获的 DOM 节点</div>
                                        {[
                                            { key: 'username', label: '账号框' },
                                            { key: 'password', label: '密码框' },
                                            { key: 'captcha', label: '验证码框' },
                                            { key: 'submit', label: '登录按钮' },
                                        ].map((f) => {
                                            const b = (profile.fieldBinding || {})[f.key];
                                            const fp = b && b.fingerprint;
                                            const fpText = fp ? [
                                                fp.tag && fp.tag.toLowerCase(),
                                                fp.type && 'type=' + fp.type,
                                                fp.name && 'name=' + fp.name,
                                                fp.id && 'id=' + fp.id,
                                                fp.placeholder && 'placeholder="' + fp.placeholder + '"',
                                                fp.labelText && 'label=' + fp.labelText,
                                                fp.role && 'role=' + fp.role,
                                            ].filter(Boolean).join(' · ') : '';
                                            return (
                                                <div className="fb-item" key={f.key}>
                                                    <span className="fb-role">{f.label}</span>
                                                    {b ? (
                                                        <div className="fb-detail">
                                                            <code className="fb-selector">{b.selector}</code>
                                                            {fpText && <span className="hint">{fpText}</span>}
                                                        </div>
                                                    ) : (
                                                        <span className="hint">未捕获</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="cred-list">
                                        {creds.length === 0 && <p className="hint">暂无凭证</p>}
                                        {creds.slice().sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0)).map((c) => (
                                            <div key={c.id} className="cred-item">
                                                <div>
                                                    <div><strong>{c.username || '(空)'}</strong></div>
                                                    {c.note && <div className="hint">{c.note}</div>}
                                                </div>
                                                <div className="profile-actions" style={{ marginLeft: 'auto' }}>
                                                    <button className="btn-icon" title="编辑" onClick={() => setEditing({ eTld, cred: c })}>✏️</button>
                                                    <button className="btn-icon" title="删除" onClick={() => deleteCredential(eTld, c.id)}>🗑️</button>
                                                </div>
                                            </div>
                                        ))}
                                        <button className="btn btn-secondary" style={{ marginTop: '8px' }} onClick={() => setAddingCred(eTld)}>
                                            + 添加凭证
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {editing && (
                <CredentialForm
                    cred={editing.cred}
                    onSave={(cred) => saveCredential(editing.eTld, cred)}
                    onCancel={() => setEditing(null)}
                />
            )}
            {addingCred && (
                <CredentialForm
                    cred={null}
                    onSave={(cred) => saveCredential(addingCred, cred)}
                    onCancel={() => setAddingCred(null)}
                />
            )}
        </div>
    );
}

// 开关选项组件
