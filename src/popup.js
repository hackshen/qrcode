import React, {useState, useEffect, useRef, useCallback} from 'react'
import ReactDOM from 'react-dom';
import axios from 'axios';
import QRCode from 'qrcode.react';
import "babel-polyfill";
import './popup.css';

function App() {
    const [qrUrl, setQrurl] = useState('');
    const [message, setMessage] = useState('');
    const ref = useRef();

    const getMessage = async () => {
        const msg = await axios('http://api.hackshen.com:3000/message');
        setMessage(msg.data[0].title);
    }

    const getValue = (e) => {
        const value = e.target.value;
        ref.current.value = value;
        setQrurl(value);
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
            <div className="qrtext">Current qr code</div>
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
            <div className="author">
                <a href="http://hackshen.com" target="_blank">Author: Hshen</a>
            </div>
        </React.Fragment>
    )
}

ReactDOM.render(
    <App/>
    , document.getElementById('root'));
