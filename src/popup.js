import React, {useState, useEffect, useRef, useReducer} from 'react'
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import {QRCodeSVG} from 'qrcode.react';
import './popup.css';
import { Checkbox } from 'antd';


const HSHEN_CONF = {
    author: 'Author: Hshen',
    api: 'https://api.hackshen.com/message',
    qrText: 'Current qr code',
    optionsText: 'Options'
}

const openDownload = () => {
    chrome.runtime.getPlatformInfo(function (info) {
        chrome.downloads.showDefaultFolder();
    });
}

const scriptInject = () => {
    chrome.tabs.getSelected(null, (tab) => {//获取当前tab
        //向tab发送请求
        chrome.tabs.sendMessage(tab.id, {action: 'inject'}, (response) => {
            console.log(response.msg);
        });
    });
}

const pageReload = () => {
    chrome.tabs.getSelected(null, (tab) => {//获取当前tab
        if (!/aliexpress\.com/.test(tab?.url)) {
            //向tab发送请求
            chrome.tabs.sendMessage(tab.id, {action: 'reload'}, (response) => {
                console.log(response.msg);
                // window.close();
            });
        }
    });
}

const clearDnsCache = () => {
    chrome.tabs.create({url: 'chrome://net-internals', active: false}, tab => {
        chrome.tabs.executeScript(tab.id, {file: 'clear.js'}, () => {
            chrome.tabs.remove(tab.id, () => {
                chrome.tabs.sendMessage(window.tabId, {action: 'clear'})
            })
        })
    })
}

const tagData = [
    // {
    //     name: 'background',
    //     style: {background: 'skyblue'},
    //     link: './background.html'
    // },
    // {
    //     name: 'test',
    //     style: {background: 'skyblue'},
    //     link: './table.html'
    // },
    {
        name: '清除DNS缓存',
        fn: clearDnsCache,
        style: {background: '#55acee'},
    },
    {
        name: 'Download',
        fn: openDownload,
        // style: {background: 'cyan'},
    },
    {
        name: '注入jQuery',
        fn: scriptInject,
        style: {background: 'skyblue'},
    },
    // {
    //     name: 'Hshen@Blog',
    //     link: 'https://hackshen.com',
    // },
    {
        name: '工具库',
        link: 'https://tools.hackshen.com/',
        style: {background: '#55acee'},
    },

    // {
    //     name: 'Hshen@Git',
    //     link: '//git.hackshen.com',
    // },
    // {
    //     name: 'Hshen@Api',
    //     link: '//api.hackshen.com',
    // },
]


function App() {
    const initialState = {
        qrUrl: '',
        message: '',
        tag: '',
    };
    const [state, dispatch] = useReducer(reducer, initialState);
    const [swChecked, setSwChecked] = useState(false);
    const [klChecked, setKlChecked] = useState(false);
    const [currentUrl, setCurrentUrl] = useState('');
    const [showOptions, setShowOpitons] = useState(false);
    const [enbArr, setEnbArr] = useState([]);
    const {qrUrl, message, tag} = state;
    const ref = useRef();
    const options = [
        { label: 'Dev', value: 'dev' },
        { label: 'newTab', value: 'newTab' },
        { label: 'test', value: 'test' },
    ];

    function reducer(state, action) {
        switch (action.type) {
            case 'url':
                return {...state, qrUrl: action.value}

            case 'message':
                return {...state, message: action.value}
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
                    >{item.name}</a>
                })
                return {...state, tag: tagList}

            case 'getMsg':
                axios(HSHEN_CONF.api).then(res => {
                    dispatch({type: 'message', value: res.data[0].title})
                })
                return {...state}
        }
    }

    const getValue = (e) => {
        const value = e.target.value;
        ref.current.value = value;
        dispatch({type: 'url', value: value})
    }

    useEffect(() => {
        chrome.tabs.getSelected(null, (tab) => {
            window.tabId = tab.id;
            dispatch({type: 'url', value: tab.url});
            ref.current.value = tab.url;
        });
        chrome.storage.sync.get('openDev', res => {
            // setSwChecked(res?.openDev);
            setEnbArr(res?.openDev);
        });
        dispatch({type: 'tag'});
        dispatch({type: 'getMsg'});
    }, []);
    const swCheck = async (arr) => {
        // const {checked} = e.target;
        // chrome.storage.sync.set({
        //     openDev: checked
        // });
        // pageReload();
        // setSwChecked(checked);
        await chrome.storage.sync.set({
            openDev: arr,
        });
        setEnbArr(arr);
        pageReload();
    }
    const kaolaClk = e => {
        const checked = e.target.checked;
        chrome.storage.sync.set({
            kaolaChecked: checked
        });
        setKlChecked(checked);
    }
    return (
        <React.Fragment>
            {showOptions ? (
                <div className="options">
                    <div className="dev-switch">
                        <span>切换预发环境: </span>
                        <input onChange={swCheck} checked={swChecked} id="checked_1" type="checkbox"
                               className="switch"/>
                        <label htmlFor="checked_1"/>
                    </div>
                    <div className="dev-switch">
                        <span>🐨抢购模式: </span>
                        <input onChange={kaolaClk} checked={klChecked} id="checked_2" type="checkbox"
                               className="switch"/>
                        <label htmlFor="checked_2"></label>
                    </div>
                </div>
            ) : (
                <QRCodeSVG
                    value={qrUrl}
                    size={256}
                />
            )}
            <div className="qrtext">{showOptions ? HSHEN_CONF.optionsText : HSHEN_CONF.qrText}</div>
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
                    dispatch({type: 'getMsg'})
                }}>{message}</div>
            <div className={'tabLink'}>{tag}</div>
            <div className={'sw-wrap'}>
                {/*<div className="dev-switch">*/}
                {/*    <span>dev: </span>*/}
                {/*    <input onChange={swCheck} checked={swChecked} id="checked_1" type="checkbox" className="switch"/>*/}
                {/*    <label htmlFor="checked_1"/>*/}
                {/*</div>*/}
                {/*<Checkbox.Group*/}
                {/*  className={'checked-group'}*/}
                {/*  options={options}*/}
                {/*  // defaultValue={['Pear']}*/}
                {/*  value={enbArr}*/}
                {/*  onChange={swCheck}*/}
                {/*/>*/}


            </div>
            {/*<div className="dev-switch">*/}
            {/*    <span>🐨抢购模式: </span>*/}
            {/*    <input onChange={kaolaClk} checked={klChecked} id="checked_2" type="checkbox" className="switch"/>*/}
            {/*    <label htmlFor="checked_2"></label>*/}
            {/*</div>*/}
            <div className="h-line"/>
            <div className="author">
                <a href="http://hackshen.com" target="_blank">{HSHEN_CONF.author}</a>
            </div>
        </React.Fragment>
    )
}

const root = ReactDOM.createRoot(
    document.getElementById("root")
);
root.render(<App />);
