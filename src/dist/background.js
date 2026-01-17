// Manifest V3 Background Service Worker

// 导入默认配置
importScripts('default-config.js');

// 配置对象
const CONFIG = {
    contextMenus: {
        parentId: '_hshen',
        parentTitle: 'Paget Options',
        items: [
            { id: 'get_sessionid', title: 'GET SESSIONID' },
            { id: 'set_sessionid', title: 'SET SESSIONID' },
        ],
    },
    storageKeys: {
        sessionid: 'sessionid',
        tyAuthToken: 'tyAuthToken',
    },
    cookieNames: {
        sessionid: 'SESSIONID',
    },
    localStorageKeys: {
        tyAuthToken: 'tyAuthToken',
    },
};

// 工具函数：发送消息给 Content Script（带错误处理）
function sendMessageToTab(tabId, message, callback) {
    chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
            console.error('❌ 消息发送失败:', chrome.runtime.lastError.message);
            callback(null, chrome.runtime.lastError);
        } else {
            callback(response, null);
        }
    });
}

// 工具函数：显示提示消息
function showAlert(tabId, message) {
    sendMessageToTab(tabId, { action: 'alert', message }, () => {});
}

// 创建右键菜单
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('🔧 扩展已安装/更新:', details.reason);
    
    // 初始化默认配置（首次安装或更新时）
    if (details.reason === 'install' || details.reason === 'update') {
        try {
            // 检查是否已有配置
            const result = await chrome.storage.sync.get('extensionConfig');
            
            if (!result.extensionConfig) {
                // 首次安装，写入默认配置
                await chrome.storage.sync.set({ extensionConfig: DEFAULT_EXTENSION_CONFIG });
                console.log('✅ 默认配置已初始化:', DEFAULT_EXTENSION_CONFIG);
            } else if (details.reason === 'update') {
                // 更新时，合并新的默认配置（保留用户自定义的值）
                const mergedConfig = mergeConfig(DEFAULT_EXTENSION_CONFIG, result.extensionConfig);
                await chrome.storage.sync.set({ extensionConfig: mergedConfig });
                console.log('✅ 配置已更新并合并:', mergedConfig);
            }
        } catch (error) {
            console.error('❌ 初始化配置失败:', error);
        }
    }
    
    // 创建父菜单
    chrome.contextMenus.create({
        title: CONFIG.contextMenus.parentTitle,
        id: CONFIG.contextMenus.parentId,
    });
    
    // 创建子菜单
    CONFIG.contextMenus.items.forEach(item => {
        chrome.contextMenus.create({
            title: item.title,
            parentId: CONFIG.contextMenus.parentId,
            id: item.id,
        });
    });

    // 设置默认侧边栏路径
    if (chrome.sidePanel) {
        chrome.sidePanel.setOptions({
            path: 'sidepanel.html',
            enabled: true
        });
    }
});

// 深度合并配置（保留用户自定义值，添加新的默认值）
function mergeConfig(defaultConfig, userConfig) {
    const merged = { ...defaultConfig };
    
    for (const key in userConfig) {
        if (userConfig.hasOwnProperty(key)) {
            if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key]) && userConfig[key] !== null) {
                // 递归合并对象
                merged[key] = mergeConfig(defaultConfig[key] || {}, userConfig[key]);
            } else {
                // 保留用户的值
                merged[key] = userConfig[key];
            }
        }
    }
    
    return merged;
}

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'get_sessionid') {
        handleGetSessionId(tab);
    }
    
    if (info.menuItemId === 'set_sessionid') {
        handleSetSessionId(tab);
    }
});

// 添加快捷键命令来打开侧边栏
chrome.commands.onCommand.addListener((command) => {
    if (command === '_execute_action' && chrome.sidePanel) {
        // 获取当前活动标签页
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.windows.get(tabs[0].windowId, (window) => {
                    chrome.sidePanel.open({ windowId: window.id });
                });
            }
        });
    }
});

// 处理获取 SESSIONID 逻辑
function handleGetSessionId(tab) {
    // 1. 读取页面 localStorage
    sendMessageToTab(tab.id, { action: 'getPageLocalStorage' }, (response, error) => {
        if (error) {
            showAlert(tab.id, '❌ 无法访问页面数据，请刷新后重试');
            return;
        }
        
        console.log('📦 收到页面 localStorage:', response);
        
        // 2. 读取 Cookie
        chrome.cookies.getAll({ url: tab.url }, (cookies) => {
            const sessionCookie = cookies.find(item => item.name === CONFIG.cookieNames.sessionid);
            const sessionId = sessionCookie?.value || '';
            const tyAuthToken = response?.localStorage?.[CONFIG.localStorageKeys.tyAuthToken] || '';
            
            // 3. 保存到扩展存储
            const dataToSave = {
                [CONFIG.storageKeys.sessionid]: sessionId,
                [CONFIG.storageKeys.tyAuthToken]: tyAuthToken,
                savedTime: new Date().toISOString(),
                savedUrl: tab.url
            };
            
            chrome.storage.local.set(dataToSave, () => {
                const message = [
                    sessionId ? `✅ SESSIONID: ${sessionId}` : '⚠️  SESSIONID 未找到',
                    tyAuthToken ? `✅ tyAuthToken: ${tyAuthToken}` : '⚠️  tyAuthToken 未找到'
                ].join('\n');
                
                showAlert(tab.id, message);
                console.log('✅ 已保存到扩展存储:', dataToSave);
            });
        });
    });
}

// 处理设置 SESSIONID 逻辑
function handleSetSessionId(tab) {
    // 1. 读取保存的数据
    const keysToGet = [CONFIG.storageKeys.sessionid, CONFIG.storageKeys.tyAuthToken];
    
    chrome.storage.local.get(keysToGet, (result) => {
        const sessionId = result[CONFIG.storageKeys.sessionid] || '';
        const tyAuthToken = result[CONFIG.storageKeys.tyAuthToken] || '';
        
        if (!sessionId && !tyAuthToken) {
            showAlert(tab.id, '❌ 没有保存的数据，请先执行 GET SESSIONID');
            return;
        }
        
        const { origin } = new URL(tab.url);
        let cookieSet = false;
        let localStorageSet = false;
        
        // 2. 设置 Cookie
        if (sessionId) {
            chrome.cookies.set({
                url: origin,
                name: CONFIG.cookieNames.sessionid,
                value: sessionId,
            }, (cookie) => {
                cookieSet = !!cookie;
                tryComplete();
            });
        } else {
            tryComplete();
        }
        
        // 3. 设置页面 localStorage
        if (tyAuthToken) {
            sendMessageToTab(tab.id, {
                action: 'setPageLocalStorage',
                data: { [CONFIG.localStorageKeys.tyAuthToken]: tyAuthToken }
            }, (response, error) => {
                localStorageSet = !error && response?.success;
                tryComplete();
            });
        } else {
            tryComplete();
        }
        
        // 4. 等待两个操作都完成后显示结果
        let completedCount = 0;
        function tryComplete() {
            completedCount++;
            if (completedCount >= 2) {
                const messages = [];
                if (sessionId) messages.push(cookieSet ? '✅ SESSIONID 已设置' : '❌ SESSIONID 设置失败');
                if (tyAuthToken) messages.push(localStorageSet ? '✅ tyAuthToken 已设置' : '❌ tyAuthToken 设置失败');
                messages.push('🔄 刷新页面生效');
                
                showAlert(tab.id, messages.join('\n'));
                console.log('✅ 已恢复:', { sessionId: !!sessionId, tyAuthToken: !!tyAuthToken, cookieSet, localStorageSet });
            }
        }
    });
}

// ============ HTTP 头规则动态管理 ============
importScripts('http-rules-manager.js');

// ============ SourceMap 自动注入 ============
// importScripts('sourcemap-injector.js');

// ============ 统一消息处理 ============
// 处理来自 content script 和 DevTools Panel 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // API Mock 相关消息
    if (request.action === 'getMockRules') {
        // 获取 Mock 规则
        chrome.storage.local.get(['mockRules', 'mockEnabled', 'interceptCount'], (result) => {
            sendResponse({
                mockRules: result.mockRules || [],
                mockEnabled: result.mockEnabled || false,
                interceptCount: result.interceptCount || 0
            });
        });
        return true; // 保持消息通道开启
    }
    
    if (request.action === 'saveMockRules') {
        // 保存 Mock 规则
        chrome.storage.local.set(request.data, () => {
            sendResponse({ success: true });
        });
        return true; // 保持消息通道开启
    }
    
    // 代理设置相关消息
    if (request.action === 'setProxy') {
        // 设置代理
        handleSetProxy(request.config)
            .then(() => {
                sendResponse({ success: true });
            })
            .catch((error) => {
                console.error('❌ 设置代理失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // 保持消息通道开启
    }
    
    if (request.action === 'clearProxy') {
        // 清除代理
        chrome.proxy.settings.clear({}, () => {
            sendResponse({ success: true });
        });
        return true;
    }
    
    // 其他消息处理可以在这里添加
    // 例如：来自 content script 的消息
});

// ============ 代理设置处理 ============
async function handleSetProxy(config) {
    return new Promise((resolve, reject) => {
        try {
            console.log('🔧 开始设置代理:', {
                enabled: config.enabled,
                mode: config.mode,
                currentProfile: config.currentProfile,
                profilesCount: config.profiles?.length || 0
            });

            if (!config.enabled || config.mode === 'direct') {
                console.log('🔧 清除代理设置（未启用或直连模式）');
                chrome.proxy.settings.clear({}, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        console.log('✅ 代理已清除');
                        resolve();
                    }
                });
                return;
            }

            if (config.mode === 'system') {
                chrome.proxy.settings.set({
                    value: { mode: 'system' },
                    scope: 'regular'
                }, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        console.log('✅ 系统代理设置成功');
                        resolve();
                    }
                });
                return;
            }

            if (config.mode === 'fixed') {
                console.log('🔧 固定代理模式，currentProfile:', config.currentProfile);
                if (!config.currentProfile) {
                    // 固定模式但没有选择代理，清除代理设置
                    console.log('⚠️ 固定模式但未选择代理，清除代理设置');
                    chrome.proxy.settings.clear({}, () => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve();
                        }
                    });
                    return;
                }

                const profile = config.profiles?.find(p => p.id === config.currentProfile);
                if (!profile) {
                    console.error('❌ 代理配置不存在，ID:', config.currentProfile);
                    console.error('可用配置:', config.profiles?.map(p => ({ id: p.id, name: p.name })));
                    reject(new Error('代理配置不存在'));
                    return;
                }

                console.log('🔧 找到代理配置:', {
                    id: profile.id,
                    name: profile.name,
                    scheme: profile.scheme,
                    host: profile.host,
                    port: profile.port
                });

                const proxyConfig = buildProxyConfig(profile);
                console.log('🔧 构建的代理配置:', JSON.stringify(proxyConfig, null, 2));
                
                chrome.proxy.settings.set({
                    value: proxyConfig,
                    scope: 'regular'
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ 设置代理失败:', chrome.runtime.lastError);
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        console.log('✅ 代理设置成功:', proxyConfig);
                        resolve();
                    }
                });
                return;
            }

            if (config.mode === 'auto_switch') {
                const pacScript = buildPACScript(config.rules);
                chrome.proxy.settings.set({
                    value: { 
                        mode: 'pac_script', 
                        pacScript: {
                            data: pacScript
                        }
                    },
                    scope: 'regular'
                }, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve();
                    }
                });
                return;
            }

            reject(new Error('未知的代理模式'));
        } catch (error) {
            reject(error);
        }
    });
}

// 构建代理配置
function buildProxyConfig(profile) {
    console.log('🔧 构建代理配置，输入:', profile);
    
    if (!profile) {
        throw new Error('代理配置不能为空');
    }
    
    const scheme = (profile.scheme || 'http').toLowerCase().trim();
    const host = (profile.host || '').trim();
    const portStr = String(profile.port || '').trim();
    const port = parseInt(portStr, 10);
    
    // 验证端口号
    if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error(`无效的端口号: ${portStr}，范围应为 1-65535`);
    }
    
    // 验证主机地址
    if (!host) {
        throw new Error('代理地址不能为空');
    }

    // Chrome proxy API 要求 scheme 必须是 'http', 'https', 'socks4', 'socks5'
    let proxyScheme = scheme;
    if (scheme === 'http' || scheme === 'https') {
        proxyScheme = scheme;
    } else if (scheme === 'socks4') {
        proxyScheme = 'socks4';
    } else if (scheme === 'socks5') {
        proxyScheme = 'socks5';
    } else {
        throw new Error(`不支持的代理协议: ${scheme}，支持: http, https, socks4, socks5`);
    }

    const proxyConfig = {
        mode: 'fixed_servers',
        rules: {
            singleProxy: {
                scheme: proxyScheme,
                host: host,
                port: port  // 确保是数字类型
            }
        }
    };
    
    console.log('🔧 构建的代理配置:', JSON.stringify(proxyConfig, null, 2));
    return proxyConfig;
}

// 构建 PAC 脚本（用于自动切换）
function buildPACScript(rules) {
    if (!rules || rules.length === 0) {
        return 'function FindProxyForURL(url, host) { return "DIRECT"; }';
    }

    const rulesCode = rules.map(rule => {
        if (!rule.profile) return '';
        const conditions = rule.conditions.map(c => {
            if (c.type === 'hostContains') {
                return `shExpMatch(host, "*${c.value}*")`;
            } else if (c.type === 'urlMatches') {
                return `shExpMatch(url, "${c.value}")`;
            }
            return 'false';
        }).join(' || ');

        if (!conditions) return '';
        return `if (${conditions}) { return "PROXY ${rule.profile.host}:${rule.profile.port}"; }`;
    }).filter(code => code).join('\n');

    return `
        function FindProxyForURL(url, host) {
            ${rulesCode}
            return "DIRECT";
        }
    `;
}
