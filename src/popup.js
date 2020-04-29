import React, {useState, useEffect} from 'react'
import ReactDOM from 'react-dom';
import axios from 'axios';
import QRCode from 'qrcode.react';
import "babel-polyfill";
import './popup.css';

export default function App(props) {
    const [qrUrl, setQrurl] = useState('');
    const [message, setMessage] = useState('');

    const messag = async () => {
        const msg = await axios('http://api.hackshen.com:3000/message');
        setMessage(msg.data[0].title);
    }

    const getValue = (e) => {
        const value = e.target.value;
        setQrurl(value);
    }

    useEffect(() => {
        chrome.tabs.getSelected(null, (tab) => {
            setQrurl(tab.url)
        });
        messag();
    }, []);

    return (
        <React.Fragment>
            <QRCode
                value={qrUrl}
                size={256}
            />
            <div className="qrtext">Current qr code</div>
            <div className="changeInput">
                <textarea
                    className="url-text"
                    type="text"
                    value={qrUrl}
                    onChange={(e) => {
                        getValue(e)
                    }}/>
            </div>
            <div
                className="message"
                onClick={() => {
                    messag()
                }}>{message}</div>
            <div className="author">
                <a href="http://hackshen.com" target="_blank">Author: Hshen</a>
            </div>
        </React.Fragment>
    )
}

ReactDOM.render(
    <App/>
    , document.getElementById('root'));
