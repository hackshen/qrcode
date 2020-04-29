import React, {useState, useEffect} from 'react'
import ReactDOM from 'react-dom';
import axios from 'axios';
import "babel-polyfill";
import './popup.css';

export default function App(props) {
    const [imgUrl, setImgUrl] = useState('');
    const [message, setMessage] = useState('');
    const [url, setUrl] = useState('');

    const getMsg = () => {
        return axios('http://api.hackshen.com:3000/message');
    }

    const getQr = (url) => {
        return `http://api.hackshen.com:3000/qrcode?data=${url}`
    }

    const messag = async () => {
        const msg = await getMsg();
        setMessage(msg.data[0].title);
    }

    const getValue = (e) => {
        const value = e.target.value;
        setUrl(value);
        setImgUrl(getQr(value));
    }
    useEffect(() => {
        chrome.tabs.getSelected(null, (tab) => {
            window.tab = tab
            window.tabUrl = tab.url;
            setImgUrl(getQr(tab.url));
            setUrl(tab.url);
        });
        messag();
        // const msg = getMsg();
        // msg.then((res)=>{
        //     setMessage(res.data[0].title);
        // })
    }, []);

    return (
        <div>
            <img id="qrcode" src={imgUrl} alt="" style={{width: '240px'}}/>
            <div id="qrcode1"></div>
            <div className="qrtext">Current qr code</div>

            <div className="changeInput">
                <textarea id="urlVal" style={{maxWidth: '90%'}} type="text" value={url} onChange={(e) => {
                    getValue(e)
                }}/>
            </div>
            <div className="message" onClick={() => {
                messag()
            }}>{message}</div>
            <div style={{textAlign: "center"}}>
                <a href="http://hackshen.com" target="_blank">Author: Hshen</a>
            </div>
        </div>
    )
}

ReactDOM.render(
    <App/>
    , document.getElementById('root'));
