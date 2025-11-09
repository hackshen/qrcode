import React, { useState, useEffect, useRef, useReducer } from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import './popup.css';
import CONFIG from './config';

const HSHEN_CONF = {
    author: CONFIG.author.name,
    blog: CONFIG.author.blog,
    api: CONFIG.api.message,
    qrText: CONFIG.text.qrCode,
    optionsText: CONFIG.text.options,
    toolsUrl: CONFIG.author.toolsUrl,
};

const openDownload = () => {
    chrome.runtime.getPlatformInfo(function (info) {
        chrome.downloads.showDefaultFolder();
    });
};

const scriptInject = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'inject' }, (response) => {
            console.log(response?.msg);
        });
    });
};


const clearDnsCache = () => {
    chrome.tabs.create({ url: 'chrome://net-internals', active: false }, tab => {
        chrome.tabs.executeScript(tab.id, { file: 'clear.js' }, () => {
            chrome.tabs.remove(tab.id, () => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'clear' });
                });
            });
        });
    });
};

// 映射配置中的 action 到实际函数
const actionMap = {
    clearDnsCache,
    openDownload,
    scriptInject,
};

const tagData = CONFIG.quickLinks.map(link => ({
    name: link.name,
    fn: link.action ? actionMap[link.action] : undefined,
    link: link.link,
    style: link.style,
}));

function App() {
    const initialState = {
        qrUrl: '',
        message: '',
        tag: '',
    };
    const [state, dispatch] = useReducer(reducer, initialState);
    const { qrUrl, message, tag } = state;
    const ref = useRef();

    function reducer(state, action) {
        switch (action.type) {
            case 'url':
                return { ...state, qrUrl: action.value };

            case 'message':
                return { ...state, message: action.value };
                
            case 'tag':
                const tagList = tagData.map((item, index) => {
                    return <a
                        key={index}
                        style={{
                            background: `#${(Math.random() * 18).toString(16).substr(2, 6).toUpperCase()}`,
                            ...item.style
                        }}
                        target="_blank"
                        href={item.link}
                        onClick={item.fn}
                    >{item.name}</a>;
                });
                return { ...state, tag: tagList };

            case 'getMsg':
                axios(HSHEN_CONF.api).then(res => {
                    dispatch({ type: 'message', value: res.data[0].title });
                });
                return { ...state };
                
            default:
                return state;
        }
    }

    const getValue = (e) => {
        const value = e.target.value;
        ref.current.value = value;
        dispatch({ type: 'url', value: value });
    };

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            window.tabId = tab.id;
            dispatch({ type: 'url', value: tab.url });
            ref.current.value = tab.url;
        });
        
        dispatch({ type: 'tag' });
        dispatch({ type: 'getMsg' });
    }, []);
    
    return (
        <React.Fragment>
            <QRCodeSVG
                value={qrUrl}
                size={256}
            />
            <div className="qrtext">{HSHEN_CONF.qrText}</div>
            <div className="changeInput">
                <textarea
                    className="url-text"
                    type="text"
                    ref={ref}
                    onChange={getValue}/>
            </div>
            <div
                className="message"
                onClick={() => {
                    dispatch({ type: 'getMsg' });
                }}>{message}</div>
            <div className={'tabLink'}>{tag}</div>
            <div className="h-line"/>
            <div className="author">
                <a href={HSHEN_CONF.blog} target="_blank">{HSHEN_CONF.author}</a>
            </div>
        </React.Fragment>
    );
}

const root = ReactDOM.createRoot(
    document.getElementById("root")
);
root.render(<App />);
