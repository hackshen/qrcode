// 注：本文件由 options.js 拆出，属纯代码搬移，逻辑未变

export function OptionItem({ title, description, checked, onChange }) {
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

export function SavedDataDisplay({ data }) {
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

// SourceMap 管理组件
