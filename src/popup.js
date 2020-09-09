import React, {useState, useEffect, useRef, useCallback} from 'react'
import ReactDOM from 'react-dom';
import axios from 'axios';
import QRCode from 'qrcode.react';
import 'babel-polyfill';
import './popup.css';

const HSHEN_CONF = {
    author: 'Author: Hshen',
    api: 'http://api.hackshen.com/message',
    qrText: 'Current qr code',
}

const newTab = [
    {
        name: 'Hshen@Blog',
        link: 'https://hackshen.com',
    }, {
        name: 'Hshen@Git',
        link: 'https://git.hackshen.com',
    }, {
        name: 'Hshen@Api',
        link: 'https://api.hackshen.com',
    },
]


function App() {
    const [qrUrl, setQrurl] = useState('');
    const [message, setMessage] = useState('');
    const ref = useRef();

    const getMessage = async () => {
        const msg = await axios(HSHEN_CONF.api);
        setMessage(msg.data[0].title);
    }

    const getValue = (e) => {
        const value = e.target.value;
        ref.current.value = value;
        setQrurl(value);
    }

    const scriptInject = () => {
        chrome.tabs.getSelected(null, (tab) => {//获取当前tab
            //向tab发送请求
            chrome.tabs.sendMessage(tab.id, {action: "inject"}, (response) => {
                console.log(response.msg);
            });
        });
    }

    useEffect(() => {
        chrome.tabs.getSelected(null, (tab) => {
            setQrurl(tab.url)
            ref.current.value = tab.url;
        });
        getMessage();
    }, []);

    return (
        <React.Fragment>
            <QRCode
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
                onClick={getMessage}>{message}</div>
            <p className={'shortcut'}>shortcut</p>
            <div className={'tabLink'}>
                <a style={{background: 'skyblue'}} onClick={scriptInject}>inject</a>
                {newTab.map(item => {
                    return <a style={{background: `#${Math.random().toString(16).substr(2, 6).toUpperCase()}`}}
                              target="_blank" href={item.link}>{item.name}</a>
                })}
            </div>

            <hr/>
            <div className="author">
                <a href="http://hackshen.com" target="_blank">{HSHEN_CONF.author}</a>
            </div>
        </React.Fragment>
    )
}

ReactDOM.render(
    <App/>
    , document.getElementById('root'));
