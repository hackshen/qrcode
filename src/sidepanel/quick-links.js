// 注：本文件由 sidepanel.js 拆出，属纯代码搬移，逻辑未变
import React from 'react';
import { generateRandomColor, actionMap } from './utils.js';

// ============ QuickLink 组件 ============
// 使用 React.memo 防止不必要的重新渲染
export const QuickLink = React.memo(({ link, index }) => {
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
