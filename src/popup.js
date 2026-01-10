import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import './popup.css';
import CONFIG from './config';

// 配置 axios 实例，自动返回 response.data（只返回接口的实际数据）
const apiClient = axios.create();

// 响应拦截器：自动提取 response.data，只返回接口的实际响应数据
apiClient.interceptors.response.use(
    (response) => {
        // 直接返回 response.data，而不是整个 response 对象
        return response.data;
    },
    (error) => {
        // 错误处理：返回 Promise.reject 以便 catch 可以捕获
        return Promise.reject(error);
    }
);

const HSHEN_CONF = {
    author: CONFIG.author.name,
    blog: CONFIG.author.blog,
    api: CONFIG.api.message,
    qrText: CONFIG.text.qrCode,
    optionsText: CONFIG.text.options,
    toolsUrl: CONFIG.author.toolsUrl,
};

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
        // 使用 Manifest V3 的 scripting API
        const tab = await chrome.tabs.create({ 
            url: 'chrome://net-internals', 
            active: false 
        });
        
        // 等待片刻让页面加载
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
const QuickLink = ({ link, index }) => {
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
        >
            {link.name}
        </a>
    );
};

// ============ 主组件 ============
function App() {
    const [qrUrl, setQrUrl] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef();

    // 获取每日一句
    const fetchMessage = async () => {
        setLoading(true);
        setError(null);
        try {
            // 从配置读取 API 地址
            const config = await chrome.storage.sync.get('extensionConfig');
            const apiUrl = config.extensionConfig?.api?.message || HSHEN_CONF.api;
            
            const response = await apiClient.get(apiUrl);
            const data = response.data;
            const msg = data?.[0]?.title || '暂无数据';
            setMessage(msg);
        } catch (err) {
            console.error('❌ 获取消息失败:', err);
            setError('获取失败，点击重试');
            setMessage('获取失败，点击重试');
        } finally {
            setLoading(false);
        }
    };

    // 输入框变化处理
    const handleInputChange = (e) => {
        const value = e.target.value;
        setQrUrl(value);
    };

    // 初始化
    useEffect(() => {
        const initPopup = async () => {
            try {
                const tab = await getCurrentTab();
                if (tab) {
                    window.tabId = tab.id;
                    setQrUrl(tab.url);
                    if (inputRef.current) {
                        inputRef.current.value = tab.url;
                    }
                }
            } catch (error) {
                console.error('❌ 初始化失败:', error);
            }
        };

        initPopup();
        fetchMessage();
    }, []);
    
    return (
        <React.Fragment>
            {/* 二维码 */}
            <QRCodeSVG
                value={qrUrl || 'https://hackshen.com'}
                size={256}
            />
            
            {/* 标题 */}
            <div className="qrtext">{HSHEN_CONF.qrText}</div>
            
            {/* 输入框 */}
            <div className="changeInput">
                <textarea
                    className="url-text"
                    ref={inputRef}
                    onChange={handleInputChange}
                    placeholder="输入自定义文本生成二维码"
                />
            </div>
            
            {/* 每日一句 */}
            <div
                className="message"
                onClick={fetchMessage}
                style={{ 
                    cursor: 'pointer',
                    opacity: loading ? 0.6 : 1,
                    color: error ? '#ff4d4f' : 'inherit'
                }}
            >
                {loading ? '加载中...' : message || '点击获取每日一句'}
            </div>
            
            {/* 快捷链接 */}
            <div className="tabLink">
                {CONFIG.quickLinks.map((link, index) => (
                    <QuickLink key={index} link={link} index={index} />
                ))}
            </div>

            {/* 打开侧边栏按钮 */}
            <div className="tabLink" style={{ marginTop: '10px' }}>
                <a
                    href="#"
                    onClick={async (e) => {
                        e.preventDefault();
                        try {
                            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                            if (tab) {
                                const window = await chrome.windows.get(tab.windowId);
                                await chrome.sidePanel.open({ windowId: window.id });
                            }
                        } catch (error) {
                            console.error('❌ 打开侧边栏失败:', error);
                        }
                    }}
                    style={{
                        display: 'block',
                        padding: '10px',
                        background: '#667eea',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        textAlign: 'center',
                        fontWeight: '500'
                    }}
                >
                    🔧 打开侧边栏
                </a>
            </div>
            
            {/* 分隔线 */}
            <div className="h-line" />
            
            {/* 作者信息 */}
            <div className="author">
                <a 
                    href={HSHEN_CONF.blog} 
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {HSHEN_CONF.author}
                </a>
            </div>
        </React.Fragment>
    );
}

const root = ReactDOM.createRoot(
    document.getElementById("root")
);
root.render(<App />);
