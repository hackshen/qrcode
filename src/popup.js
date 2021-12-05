import React, {useState, useEffect, useRef, useReducer, useCallback, useMemo} from 'react'
import ReactDOM from 'react-dom';
import axios from 'axios';
import QRCode from 'qrcode.react';
import './popup.css';

const HSHEN_CONF = {
    author: 'Author: Hshen',
    api: 'https://api.hackshen.com/message',
    qrText: 'Current qr code',
    optionsText: 'Options',
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
        if (/aliexpress\.com/.test(tab?.url)) {
            //向tab发送请求
            chrome.tabs.sendMessage(tab.id, {action: 'reload'}, (response) => {
                console.log(response.msg);
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
    {
        name: 'background',
        style: {background: 'skyblue'},
        link: './background.html'
    },
    {
        name: 'test',
        style: {background: 'skyblue'},
        link: './table.html'
    },
    {
        name: 'DNS',
        fn: clearDnsCache,
        style: {background: 'skyblue'},
    },
    {
        name: 'Download',
        fn: openDownload,
        style: {background: 'skyblue'},
    },
    {
        name: 'Inject',
        fn: scriptInject,
        style: {background: 'skyblue'},
    },
    {
        name: 'Hshen@Blog',
        link: 'https://hackshen.com',
    }, {
        name: 'Hshen@Git',
        link: '//git.hackshen.com',
    }, {
        name: 'Hshen@Api',
        link: '//api.hackshen.com',
    },
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
    const {qrUrl, message, tag} = state;
    const ref = useRef();

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
                        style={{background: `#${Math.random().toString(16).substr(2, 6).toUpperCase()}`, ...item.style}}
                        target="_blank"
                        href={item.link}
                        onClick={item.fn}
                    >{item.name}</a>
                })
                return {...state, tag: tagList}

            case 'getMsg':
                const getMessage = async () => {
                    const msg = await axios(HSHEN_CONF.api);
                    dispatch({type: 'message', value: msg.data[0].title})
                }
                getMessage();
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
            setSwChecked(res?.openDev);
        });

        dispatch({type: 'tag'});
        dispatch({type: 'getMsg'});
    }, []);
    const swCheck = (e) => {
        const checked = e.target.checked;
        chrome.storage.sync.set({
            openDev: checked
        });
        pageReload();
        setSwChecked(checked);
    }
    const kaolaClk = e => {
        const checked = e.target.checked;
        console.log(checked, 999)
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
                <QRCode
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
            <div className="dev-switch">
                <span>切换预发环境: </span>
                <input onChange={swCheck} checked={swChecked} id="checked_1" type="checkbox" className="switch"/>
                <label htmlFor="checked_1"></label>
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

ReactDOM.render(
    <App/>
    , document.getElementById('root'));
