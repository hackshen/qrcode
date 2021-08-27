// import React, {useState, useEffect} from 'react'
// import ReactDOM from 'react-dom';
// import axios from 'axios';
// import 'babel-polyfill';
// import {Spin, BackTop} from 'antd';
//
// import styles from './background.module.css';
//
// /**
//  * chrome **
//  */
// chrome.browserAction.setBadgeText({text: 'Shen'});
// chrome.browserAction.setBadgeBackgroundColor({color: 'skyblue'});
//
// chrome.contextMenus.create({
//     title: "test_click",
//     onclick: () => {
//         alert('Hi');
//     }
// });
//
// const getData = async (limit) => {
//     const res = await axios(`https://api.hackshen.com/message?limit=${limit}`);
//     const {data} = res;
//     return data;
// }
//
// let reqLock = true;
// const App = () => {
//     const [data, setData] = useState([]);
//     const [limit, setlimit] = useState(20);
//
//     useEffect(() => {
//         getData(limit).then(res => {
//             setData(res);
//             reqLock = false;
//         })
//     }, []);
//
//     useEffect(() => {
//         if (!reqLock) {
//             const io = new IntersectionObserver((entries) => {
//                 console.log(entries, 11)
//                 entries.forEach(item => {
//                     const {isIntersecting, target} = item;
//                     if (isIntersecting) {
//                         reqLock = true;
//                         io.unobserve(target);
//                         viewData();
//                     }
//                 })
//             }, {});
//             io.observe(document.getElementById('loading'));
//         }
//     });
//
//     const viewData = () => {
//         setlimit((v) => {
//             const limit = v + 1;
//             getData(limit).then(res => {
//                 reqLock = false;
//                 setData(data.concat(res));
//             });
//             return limit;
//         });
//
//     }
//     return (
//         <div className={styles.aa}>{data.map((item, index) => {
//             const {title} = item;
//             return <div key={index} className={styles.item}>{title}</div>
//         })}
//             {/*<div onClick={() => {*/}
//             {/*    viewData()*/}
//             {/*}} className="viewmore">view more*/}
//             {/*</div>*/}
//             <div id="loading" className={'loading'}>
//                 <Spin/>
//             </div>
//             <BackTop/>
//         </div>
//     )
// }
// ReactDOM.render(
//     <App/>
//     , document.getElementById('root'));
