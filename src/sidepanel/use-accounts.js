// 注：本文件由 sidepanel.js 拆出，属纯代码搬移，逻辑未变
// 账号列表域：状态 + 存取/搜索/导入导出逻辑
// deps：showStatus 由宿主组件注入（状态提示的宿主实现）
import { useState, useCallback, useMemo, useRef } from 'react';

export function useAccounts({ showStatus }) {
    const importInputRef = useRef(null);
    const [accountList, setAccountList] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newAccount, setNewAccount] = useState({ account: '', password: '', remark: '' });
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef(null);

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


    return {
        accountList, loadAccountList, filteredAccountList,
        showAddForm, newAccount, searchQuery, searchInputRef, importInputRef,
        setSearchQuery, setNewAccount,
        handleToggleAddForm, handleManualAddAccount,
        handleImportClick, handleImportFile, handleExportAccounts,
        handleDeleteAccount, handleClearSearch,
    };
}
