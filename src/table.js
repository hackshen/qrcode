import React, {useState, useCallback, useEffect} from 'react';
import ReactDOM from "react-dom";
import {Timeline} from 'antd';
import {ClockCircleOutlined} from '@ant-design/icons';
import Jsonp from 'jsonp';
import {Input, Space} from 'antd';
import {AudioOutlined} from '@ant-design/icons';

const {Search} = Input;
import 'antd/dist/antd.css';
import './table.css';
import axios from "axios";

const searchApi = `https://www.baidu.com/sugrec?pre=1&p=3&ie=utf-8&json=1&prod=pc&from=pc_web&wd=反反复复f&csor=5&cb=cb`

const navObj = {};
const suffix = (
    <AudioOutlined
        style={{
            fontSize: 16,
            color: '#1890ff',
        }}
    />
);

const onSearch = value => console.log(value);
const onChange = e => {
    console.log(e.target.value)
}

const Nav = () => {
    return (
        <div className={'nav'}>
            hhhhh
        </div>
    )
}
const App = () => {
    useEffect(() => {
        axios(searchApi).then(res => {
            console.log(res, 222)
        })
    }, [])
    return (
        <div className={'container'}>
            <div
                className={'bg-img'}
            >
            </div>
            <div className={'search'}>
                <Search
                    placeholder="input search textf2"
                    enterButton="百度一下"
                    size="large"
                    suffix={suffix}
                    onChange={onChange}
                    onSearch={onSearch}
                />
            </div>
            <Nav/>
        </div>
    )
}

ReactDOM.render(
  <App/>
  , document.getElementById('root'));
