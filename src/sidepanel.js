import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import axios from 'axios';
import './sidepanel.css';
import CONFIG from './config';

// 配置 axios 实例
const apiClient = axios.create();
apiClient.interceptors.response.use(
    (response) => response.data,
    (error) => Promise.reject(error)
);

// ============ 工具函数 ============
// 生成随机颜色
const generateRandomColor = () => {
    return '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
};

// 获取当前活动标签页
const getCurrentTab = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
};

// ============ Chrome API 操作函数 ============
const openDownload = () => {
    chrome.downloads.showDefaultFolder();
};

const scriptInject = async () => {
    try {
        const tab = await getCurrentTab();
        chrome.tabs.sendMessage(tab.id, { action: 'inject' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('❌ jQuery 注入失败:', chrome.runtime.lastError);
            } else {
                console.log('✅ jQuery 注入成功:', response?.msg);
            }
        });
    } catch (error) {
        console.error('❌ 获取标签页失败:', error);
    }
};

const clearDnsCache = async () => {
    try {
        const tab = await chrome.tabs.create({ 
            url: 'chrome://net-internals', 
            active: false 
        });
        
        setTimeout(async () => {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['clear.js']
                });
                
                await chrome.tabs.remove(tab.id);
                
                const currentTab = await getCurrentTab();
                chrome.tabs.sendMessage(currentTab.id, { action: 'clear' });
            } catch (error) {
                console.error('❌ DNS 缓存清除失败:', error);
                await chrome.tabs.remove(tab.id);
            }
        }, 500);
    } catch (error) {
        console.error('❌ 创建标签页失败:', error);
    }
};

// 映射配置中的 action 到实际函数
const actionMap = {
    clearDnsCache,
    openDownload,
    scriptInject,
};

// ============ QuickLink 组件 ============
// 使用 React.memo 防止不必要的重新渲染
const QuickLink = React.memo(({ link, index }) => {
    const handleClick = (e) => {
        if (link.action && actionMap[link.action]) {
            e.preventDefault();
            actionMap[link.action]();
        }
    };

    const style = {
        background: link.style?.background || generateRandomColor(),
        ...link.style
    };

    return (
        <a
            key={index}
            style={style}
            target="_blank"
            href={link.link}
            onClick={handleClick}
            rel="noopener noreferrer"
            className="quick-link-item"
        >
            {link.name}
        </a>
    );
});

// ============ 主组件 ============
function SidePanelApp() {
    const [tabInfo, setTabInfo] = useState(null);
    const [sectionStatus, setSectionStatus] = useState({});
    const statusTimersRef = useRef({});
    const importInputRef = useRef(null);
    const [qrText, setQrText] = useState('');
    const [version, setVersion] = useState('1.0.0');
    const [loading, setLoading] = useState(true);
    const [cookieData, setCookieData] = useState({ sessionId: '', pubCorpCode: '', merchantInfoId: '' });
    const [tyAuthToken, setTyAuthToken] = useState('');
    const [tokenExpireTime, setTokenExpireTime] = useState('');
    const [accountList, setAccountList] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newAccount, setNewAccount] = useState({ account: '', password: '', remark: '' });
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef(null);
    
    // 每日一句相关状态
    const [message, setMessage] = useState('');
    const [messageLoading, setMessageLoading] = useState(false);
    const [messageError, setMessageError] = useState(null);

    // 状态徽标（用于标题右侧）
    const renderStatusBadge = (scope) => {
        const s = sectionStatus[scope];
        if (!s || !s.message) return null;
        return (
            <span
                className={`status ${s.type}`}
                style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginLeft: '8px'
                }}
            >
                {s.message}
            </span>
        );
    };

    // 切换添加账号表单并清理状态
    const handleToggleAddForm = () => {
        setShowAddForm((prev) => {
            const next = !prev;
            // 关闭时重置表单与提示
            if (!next) {
                setNewAccount({ account: '', password: '', remark: '' });
            }
            return next;
        });
    };

    // 显示状态消息
    const showStatus = (message, type = 'success', scope = 'global') => {
        // 清除同一作用域的旧定时器，避免旧提示清掉新提示
        if (statusTimersRef.current[scope]) {
            clearTimeout(statusTimersRef.current[scope]);
            statusTimersRef.current[scope] = null;
        }

        setSectionStatus((prev) => ({
            ...prev,
            [scope]: { message, type },
        }));
        if (type === 'success') {
            statusTimersRef.current[scope] = setTimeout(() => {
                setSectionStatus((prev) => {
                    const next = { ...prev };
                    if (next[scope]) {
                        next[scope] = { message: '', type: '' };
                    }
                    return next;
                });
                statusTimersRef.current[scope] = null;
            }, 2000);
        }
    };

    // 组件卸载时清理所有定时器
    useEffect(() => {
        return () => {
            Object.values(statusTimersRef.current).forEach((timer) => {
                if (timer) clearTimeout(timer);
            });
        };
    }, []);

    // 复制到剪贴板
    const copyToClipboard = async (text, label = '内容', scope = 'global') => {
        try {
            await navigator.clipboard.writeText(text);
            showStatus(`✅ ${label}已复制到剪贴板`, 'success', scope);
        } catch (error) {
            console.error('❌ 复制失败:', error);
            // 降级方案：使用传统方法
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                showStatus(`✅ ${label}已复制到剪贴板`, 'success', scope);
            } catch (err) {
                showStatus(`❌ 复制失败`, 'error', scope);
            }
        }
    };

    // 解析 JWT token 获取有效期
    const parseJWTExpireTime = (token) => {
        if (!token) return '';
        
        try {
            // JWT 格式：header.payload.signature
            const parts = token.split('.');
            if (parts.length !== 3) {
                return '无效的 JWT 格式';
            }
            
            // 解码 payload（base64url）
            const payload = parts[1];
            // 添加 padding 如果需要
            const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
            // 替换 base64url 字符
            const base64 = paddedPayload.replace(/-/g, '+').replace(/_/g, '/');
            
            // 解码 base64
            const decodedPayload = JSON.parse(atob(base64));
            
            // 获取 exp 字段（Unix 时间戳）
            const exp = decodedPayload.exp;
            if (!exp) {
                return '未找到过期时间';
            }
            
            // 转换为日期时间字符串
            const expireDate = new Date(exp * 1000);
            const now = new Date();
            const timeLeft = expireDate - now;
            
            if (timeLeft < 0) {
                return `已过期 (${expireDate.toLocaleString('zh-CN')})`;
            }
            
            // 计算剩余时间
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            
            let timeLeftStr = '';
            if (days > 0) {
                timeLeftStr = `${days}天${hours}小时`;
            } else if (hours > 0) {
                timeLeftStr = `${hours}小时${minutes}分钟`;
            } else {
                timeLeftStr = `${minutes}分钟`;
            }
            
            return `${expireDate.toLocaleString('zh-CN')} (剩余: ${timeLeftStr})`;
        } catch (error) {
            console.error('❌ 解析 JWT 失败:', error);
            return '解析失败';
        }
    };

    // 从 cookie 中加载 SESSIONID 和 pub_corp_code
    const loadCookies = useCallback(async (url) => {
        if (!url) return;
        
        try {
            const cookies = await new Promise((resolve, reject) => {
                chrome.cookies.getAll({ url }, (cookies) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(cookies);
                    }
                });
            });

            const sessionIdCookie = cookies.find(cookie => cookie.name === 'SESSIONID');
            const pubCorpCodeCookie = cookies.find(cookie => cookie.name === 'pub_corp_code');
            const merchantInfoIdCookie = cookies.find(cookie => cookie.name === 'merchantInfoId');
            const mIdCookie = cookies.find(cookie => cookie.name === 'm_id');
            
            // 店铺ID优先使用 merchantInfoId，如果没有则使用 m_id
            const shopId = merchantInfoIdCookie?.value || mIdCookie?.value || '';

            // 根据店铺ID查找 token cookie
            let tokenExpireTimeStr = '';
            if (shopId) {
                const tokenCookieName = `token_${shopId}`;
                const tokenCookie = cookies.find(cookie => cookie.name === tokenCookieName);
                if (tokenCookie?.value) {
                    tokenExpireTimeStr = parseJWTExpireTime(tokenCookie.value);
                } else {
                    tokenExpireTimeStr = '未找到 token cookie';
                }
            } else {
                tokenExpireTimeStr = '未找到店铺ID';
            }

            setCookieData({
                sessionId: sessionIdCookie?.value || '',
                pubCorpCode: pubCorpCodeCookie?.value || '',
                merchantInfoId: shopId
            });
            setTokenExpireTime(tokenExpireTimeStr);
        } catch (error) {
            console.error('❌ 加载 Cookie 失败:', error);
            setCookieData({ sessionId: '', pubCorpCode: '', merchantInfoId: '' });
            setTokenExpireTime('');
        }
    }, []);

    // 从当前标签页的 localStorage 中加载 tyAuthToken
    const loadLocalStorage = useCallback(async (tabId) => {
        if (!tabId) return;
        
        try {
            const response = await new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, { action: 'getPageLocalStorage' }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                });
            });

            if (response && response.success && response.localStorage) {
                const token = response.localStorage['tyAuthToken'] || '';
                setTyAuthToken(token);
            } else {
                setTyAuthToken('');
            }
        } catch (error) {
            console.error('❌ 加载 localStorage 失败:', error);
            setTyAuthToken('');
        }
    }, []);

    // 加载当前标签页信息
    const loadTabInfo = useCallback(async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                setTabInfo(tab);
                setQrText(tab.url || '');
                // 加载 cookie 信息
                await loadCookies(tab.url);
                // 加载 localStorage 信息
                await loadLocalStorage(tab.id);
                setLoading(false);
            }
        } catch (error) {
            console.error('❌ 加载标签页信息失败:', error);
            setLoading(false);
        }
    }, [loadCookies, loadLocalStorage]);

    // 加载账号列表
    const loadAccountList = useCallback(async () => {
        try {
            const result = await chrome.storage.local.get('accountList');
            const accounts = result.accountList || [];
            setAccountList(accounts);
        } catch (error) {
            console.error('❌ 加载账号列表失败:', error);
            setAccountList([]);
        }
    }, []);

    // 添加账号到列表
    const addAccountToList = async (account, password, remark) => {
        if (!account.trim()) {
            showStatus('❌ 账号不能为空', 'error', 'account');
            return;
        }

        try {
            const result = await chrome.storage.local.get('accountList');
            const accounts = result.accountList || [];
            
            // 检查是否已存在
            if (accounts.some(acc => acc.account === account.trim())) {
                showStatus('⚠️ 该账号已存在', 'error', 'account');
                return;
            }

            const accountData = {
                id: Date.now(),
                account: account.trim(),
                password: password.trim() || '',
                remark: remark.trim() || ''
            };

            accounts.push(accountData);
            await chrome.storage.local.set({ accountList: accounts });
            setAccountList(accounts);
            showStatus('✅ 账号已添加', 'success', 'account');
            
            // 重置表单
            setNewAccount({ account: '', password: '', remark: '' });
            setShowAddForm(false);
        } catch (error) {
            console.error('❌ 添加账号失败:', error);
            showStatus('❌ 添加账号失败', 'error', 'account');
        }
    };

    // 手动添加账号
    const handleManualAddAccount = async () => {
        await addAccountToList(newAccount.account, newAccount.password, newAccount.remark);
    };

    // 触发文件选择导入账号
    const handleImportClick = () => {
        if (importInputRef.current) {
            importInputRef.current.click();
        }
    };

    // 处理导入账号文件
    const handleImportFile = async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!Array.isArray(data)) {
                throw new Error('格式错误');
            }

            const normalized = data
                .map((item, idx) => {
                    const account = (item.account ?? item.username ?? '').toString().trim();
                    const password = (item.password ?? '').toString().trim();
                    const remark = (item.remark ?? item.note ?? '').toString().trim();
                    return { account, password, remark, idx };
                })
                .filter((item) => item.account);

            if (normalized.length === 0) {
                throw new Error('无有效账号');
            }

            const result = await chrome.storage.local.get('accountList');
            const existing = result.accountList || [];
            const existingSet = new Set(existing.map((i) => i.account));

            let added = 0;
            const merged = [...existing];
            normalized.forEach((item, i) => {
                if (existingSet.has(item.account)) return;
                merged.push({
                    id: Date.now() + i,
                    account: item.account,
                    password: item.password,
                    remark: item.remark,
                });
                existingSet.add(item.account);
                added += 1;
            });

            if (added === 0) {
                showStatus('⚠️ 导入文件中没有新的账号', 'error', 'account');
                return;
            }

            await chrome.storage.local.set({ accountList: merged });
            setAccountList(merged);
            showStatus(`✅ 导入成功，新增 ${added} 个账号`, 'success', 'account');
        } catch (error) {
            console.error('❌ 导入账号失败:', error);
            showStatus('❌ 导入失败，请检查文件格式（JSON 数组）', 'error', 'account');
        } finally {
            // 清理 input 以便重复选择同一文件
            event.target.value = '';
        }
    };

    // 导出账号为 JSON
    const handleExportAccounts = () => {
        if (!accountList || accountList.length === 0) {
            showStatus('⚠️ 当前没有可导出的账号', 'error', 'account');
            return;
        }

        const exportData = accountList.map(({ account, password, remark }) => ({
            account,
            password,
            remark,
        }));

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'accounts.json';
        a.click();
        URL.revokeObjectURL(url);
        showStatus('✅ 已导出账号列表', 'success', 'account');
    };

    // 删除账号
    const handleDeleteAccount = async (id) => {
        try {
            const accounts = accountList.filter(acc => acc.id !== id);
            await chrome.storage.local.set({ accountList: accounts });
            setAccountList(accounts);
            showStatus('✅ 账号已删除', 'success', 'account');
        } catch (error) {
            console.error('❌ 删除账号失败:', error);
            showStatus('❌ 删除账号失败', 'error', 'account');
        }
    };

    // 账号搜索
    const filteredAccountList = useMemo(() => {
        const keyword = searchQuery.trim().toLowerCase();
        if (!keyword) return accountList;
        return accountList.filter(({ account, password, remark }) => {
            const values = [account, password, remark]
                .filter(Boolean)
                .map((v) => v.toString().toLowerCase());
            return values.some((v) => v.includes(keyword));
        });
    }, [accountList, searchQuery]);

    const handleClearSearch = () => {
        setSearchQuery('');
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    };

    // 加载版本信息
    const loadVersion = () => {
        try {
            const manifest = chrome.runtime.getManifest();
            setVersion(manifest.version);
        } catch (error) {
            console.error('❌ 获取版本失败:', error);
        }
    };

    // 初始化
    useEffect(() => {
        loadTabInfo();
        loadVersion();
        loadAccountList();
        fetchMessage(); // 加载每日一句

        // 监听标签页更新事件
        const handleTabUpdate = (tabId, changeInfo, tab) => {
            // 当标签页加载完成时更新信息
            if (changeInfo.status === 'complete') {
                // 检查是否是当前活动标签页
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0] && tabs[0].id === tabId) {
                        console.log('🔄 标签页已更新，重新加载信息');
                        loadTabInfo();
                    }
                });
            }
        };

        // 监听标签页激活事件（切换标签页时）
        const handleTabActivated = (activeInfo) => {
            chrome.tabs.get(activeInfo.tabId, (tab) => {
                if (tab) {
                    console.log('🔄 标签页已切换，重新加载信息');
                    loadTabInfo();
                }
            });
        };

        // 添加监听器
        chrome.tabs.onUpdated.addListener(handleTabUpdate);
        chrome.tabs.onActivated.addListener(handleTabActivated);

        // 清理函数
        return () => {
            chrome.tabs.onUpdated.removeListener(handleTabUpdate);
            chrome.tabs.onActivated.removeListener(handleTabActivated);
        };
    }, [loadTabInfo]);

    // 刷新当前页面
    const handleRefreshPage = async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                showStatus('🔄 正在刷新页面...', 'success', 'actions');
                await chrome.tabs.reload(tab.id);
                // 标签页更新监听器会自动更新信息
            }
        } catch (error) {
            console.error('❌ 刷新失败:', error);
            showStatus('❌ 刷新失败', 'error', 'actions');
        }
    };

    // 重新加载扩展
    const handleReloadExtension = () => {
        chrome.runtime.reload();
        showStatus('✅ 扩展将重新加载', 'success', 'actions');
    };

    // 打开设置页面
    const handleOpenOptions = () => {
        chrome.runtime.openOptionsPage();
        showStatus('✅ 已打开设置页面', 'success', 'actions');
    };

    // 获取每日一句
    const fetchMessage = async () => {
        setMessageLoading(true);
        setMessageError(null);
        try {
            const config = await chrome.storage.sync.get('extensionConfig');
            const apiUrl = config.extensionConfig?.api?.message || 'https://api.hackshen.com/message';
            
            const response = await apiClient.get(apiUrl);
            const data = response.data;
            const msg = data?.[0]?.title || '暂无数据';
            setMessage(msg);
        } catch (err) {
            console.error('❌ 获取消息失败:', err);
            setMessageError('获取失败，点击重试');
            setMessage('获取失败，点击重试');
        } finally {
            setMessageLoading(false);
        }
    };



    return (
        <div className="sidepanel-container">
            {/* <h1>🔧 扩展工具</h1> */}

            {/* 二维码生成 */}
            <div className="section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <h2>🔲 二维码</h2>
                    {/* {renderStatusBadge('qr')} */}
                </div>
                <div className="qr-container">
                    {qrText && (
                        <div className="qr-code-wrapper">
                            <QRCodeSVG
                                value={qrText}
                                size={'100%'}
                                level="M"
                            />
                            <p className="qr-text">Current QR Code</p>
                        </div>
                    )}
                    <textarea
                        className="qr-input"
                        placeholder="输入要生成二维码的内容"
                        value={qrText}
                        onChange={(e) => setQrText(e.target.value)}
                    />
                    
                    {/* 每日一句 */}
                    <div
                        className="message"
                        onClick={fetchMessage}
                        style={{ 
                            cursor: 'pointer',
                            opacity: messageLoading ? 0.6 : 1,
                            color: messageError ? '#ff4d4f' : 'inherit',
                            padding: '5px',
                            marginTop: '10px',
                            background: '#f5f5f5',
                            borderRadius: '6px',
                            textAlign: 'center',
                            fontSize: '12px',
                            lineHeight: '1.6',
                            transition: 'all 0.3s ease',
                            userSelect: 'none',         /* 标准语法 */
                            WebkitUserSelect: 'none', /* Safari */
                            MozUserSelect: 'none', /* Firefox */
                            msUserSelect: 'none', /* IE10+/Edge */
                        }}
                    >
                        {messageLoading ? '加载中...' : message || '点击获取每日一句'}
                    </div>
                    
                    {/* 快捷链接 */}
                    <div 
                        className="quick-links"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '10px',
                            marginTop: '10px'
                        }}
                    >
                        {CONFIG.quickLinks.map((link, index) => (
                            <QuickLink key={index} link={link} index={index} />
                        ))}
                    </div>
                </div>
            </div>

            {/* 当前标签页信息 */}
            <div className="section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <h2>📋 当前标签页</h2>
                    {renderStatusBadge('tab')}
                </div>
                {loading ? (
                    <div className="info-item">
                        <p>正在加载...</p>
                    </div>
                ) : tabInfo ? (
                    <div className="info-item">
                        <div className="info-row">
                            <p><strong>标题:</strong> {tabInfo.title || '无标题'}</p>
                            <button
                                className="copy-btn"
                                onClick={() => copyToClipboard(tabInfo.title || '无标题', '标题', 'tab')}
                                title="复制标题"
                            >
                                📋
                            </button>
                        </div>
                        <div className="info-row">
                            <p>
                                <strong>URL:</strong>{' '}
                                <a 
                                    href={tabInfo.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="url-link"
                                >
                                    {tabInfo.url}
                                </a>
                            </p>
                            <button
                                className="copy-btn"
                                onClick={() => copyToClipboard(tabInfo.url, 'URL', 'tab')}
                                title="复制URL"
                            >
                                📋
                            </button>
                        </div>
                        <div className="info-row">
                            <p><strong>TabId:</strong> {tabInfo.id}</p>
                            <button
                                className="copy-btn"
                                onClick={() => copyToClipboard(String(tabInfo.id), 'TabId', 'tab')}
                                title="复制TabId"
                            >
                                📋
                            </button>
                        </div>
                        <div className="info-row">
                            <p><strong>SESSIONID:</strong> {cookieData.sessionId || '未找到'}</p>
                            {cookieData.sessionId && (
                                <button
                                    className="copy-btn"
                                onClick={() => copyToClipboard(cookieData.sessionId, 'SESSIONID', 'tab')}
                                    title="复制SESSIONID"
                                >
                                    📋
                                </button>
                            )}
                        </div>
                        <div className="info-row">
                            <p><strong>企业码:</strong> {cookieData.pubCorpCode || '未找到'}</p>
                            {cookieData.pubCorpCode && (
                                <button
                                    className="copy-btn"
                                onClick={() => copyToClipboard(cookieData.pubCorpCode, 'corpCode', 'tab')}
                                    title="复制企业码"
                                >
                                    📋
                                </button>
                            )}
                        </div>
                        <div className="info-row">
                            <p><strong>tyAuthToken:</strong> {tyAuthToken || '未找到'}</p>
                            {tyAuthToken && (
                                <button
                                    className="copy-btn"
                                onClick={() => copyToClipboard(tyAuthToken, 'tyAuthToken', 'tab')}
                                    title="复制tyAuthToken"
                                >
                                    📋
                                </button>
                            )}
                        </div>
                        <div className="info-row">
                            <p><strong>店铺ID:</strong> {cookieData.merchantInfoId || '未找到'}</p>
                            {cookieData.merchantInfoId && (
                                <button
                                    className="copy-btn"
                                onClick={() => copyToClipboard(cookieData.merchantInfoId, '店铺ID', 'tab')}
                                    title="复制店铺ID"
                                >
                                    📋
                                </button>
                            )}
                        </div>
                        <div className="info-row">
                            <p><strong>Token有效期:</strong> {tokenExpireTime || '未找到'}</p>
                        </div>
                    </div>
                ) : (
                    <div className="info-item">
                        <p>无法获取标签页信息</p>
                    </div>
                )}
            </div>

            {/* 账号列表 */}
            <div className="section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', gap: '8px' }}>
                    <h2>👤 账号列表</h2>
                    {renderStatusBadge('account')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <button
                        className="btn btn-primary"
                        onClick={handleToggleAddForm}
                        title="添加"
                        style={{ padding: '8px 12px', fontSize: '14px', lineHeight: 1.35 }}
                    >
                        {showAddForm ? '❌ 取消' : '➕ 添加'}
                    </button>
                    {/* 导入账号 */}
                    <button
                        className="btn btn-primary"
                        onClick={handleImportClick}
                        title="导入"
                        style={{ padding: '8px 12px', fontSize: '14px', lineHeight: 1.35 }}
                    >
                        🔄 导入
                    </button>
                    {/* 导出账号 */}
                    <button
                        className="btn btn-primary"
                        onClick={handleExportAccounts}
                        title="导出"
                        style={{ padding: '8px 12px', fontSize: '14px', lineHeight: 1.35 }}
                    >
                        🔄 导出
                    </button>
                    <input
                        ref={importInputRef}
                        type="file"
                        accept="application/json"
                        style={{ display: 'none' }}
                        onChange={handleImportFile}
                    />
                </div>
                {/* 搜索账号 */}
                <div
                    className="info-item"
                    style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}
                >
                    <div className="search-wrapper">
                        <input
                            ref={searchInputRef}
                            type="text"
                            className={`search-input ${searchQuery ? 'has-clear' : ''}`}
                            placeholder="搜索账号 / 密码 / 备注"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                className="search-clear-btn"
                                onClick={handleClearSearch}
                                aria-label="清空搜索"
                                title="清空搜索"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    {accountList.length > 0 && (
                        <span style={{ fontSize: '12px', color: '#666' }}>
                            匹配 {filteredAccountList.length} / {accountList.length}
                        </span>
                    )}
                </div>
                {/* 添加账号表单 */}
                {showAddForm && (
                    <div className="info-item" style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>账号:</label>
                            <input
                                type="text"
                                className="qr-input"
                                placeholder="请输入账号"
                                value={newAccount.account}
                                onChange={(e) => setNewAccount({ ...newAccount, account: e.target.value })}
                                style={{ width: '100%', marginBottom: '10px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>密码:</label>
                            <input
                                type="text"
                                className="qr-input"
                                placeholder="请输入密码（可选）"
                                value={newAccount.password}
                                onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                                style={{ width: '100%', marginBottom: '10px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>备注:</label>
                            <input
                                type="text"
                                className="qr-input"
                                placeholder="请输入备注（可选）"
                                value={newAccount.remark}
                                onChange={(e) => setNewAccount({ ...newAccount, remark: e.target.value })}
                                style={{ width: '100%', marginBottom: '10px' }}
                            />
                        </div>
                        <button
                            className="btn btn-primary btn-full"
                            onClick={handleManualAddAccount}
                        >
                            确认添加
                        </button>
                    </div>
                )}
                <div className="info-item">
                    {accountList.length === 0 ? (
                        <div className="info-row">
                            <p>暂无账号，点击"添加账号"按钮添加</p>
                        </div>
                    ) : filteredAccountList.length === 0 ? (
                        <div className="info-row" style={{ gap: '10px', alignItems: 'center' }}>
                            <p style={{ margin: 0 }}>未找到匹配的账号</p>
                            <button
                                className="btn btn-secondary"
                                onClick={handleClearSearch}
                                style={{ padding: '6px 10px', fontSize: '12px' }}
                            >
                                重置搜索
                            </button>
                        </div>
                    ) : (
                        filteredAccountList.map((account) => (
                            <div key={account.id} className="account-card">
                                <div className="account-row">
                                    <div className="account-line account-line-top">
                                        <span className="account-field account-main"><strong>账号:</strong> <span className="account-main-value">{account.account}</span></span>
                                        <div className="account-actions">
                                            <button
                                                className="copy-btn"
                                                onClick={() => copyToClipboard(account.account, '账号', 'account')}
                                                title="复制账号"
                                            >
                                                📋
                                            </button>
                                            <button
                                                className="copy-btn"
                                                onClick={() => copyToClipboard(account.password, '密码', 'account')}
                                                title="复制密码"
                                            >
                                                🔑
                                            </button>
                                            <button
                                                className="delete-btn"
                                                onClick={() => handleDeleteAccount(account.id)}
                                                title="删除账号"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                    <div className="account-line">
                                        <span className="account-field account-sub"><strong>密码:</strong> <span className="account-sub-value">{account.password}</span></span>
                                    </div>
                                    <div className="account-line">
                                        <span className="account-field account-remark"><strong>备注:</strong> <span className="account-remark-value">{account.remark || '无'}</span></span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 快捷操作 */}
            <div className="section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <h2>⚡ 快捷操作</h2>
                    {renderStatusBadge('actions')}
                </div>
                <div className="button-group">
                    <button className="btn btn-primary" onClick={handleRefreshPage}>
                        🔄 刷新页面
                    </button>
                    <button className="btn btn-primary" onClick={handleReloadExtension}>
                        🔄 重新加载扩展
                    </button>
                    <button className="btn btn-secondary" onClick={handleOpenOptions}>
                        ⚙️ 打开设置
                    </button>
                </div>
            </div>

            {/* 扩展信息 */}
            <div className="section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <h2>ℹ️ 扩展信息</h2>
                    {renderStatusBadge('info')}
                </div>
                <div className="info-item">
                    <strong>版本:</strong> {version}
                </div>
                <div className="info-item">
                    <strong>作者:</strong> Hshen
                </div>
            </div>
        </div>
    );
}

// ============ 渲染应用 ============
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<SidePanelApp />);
