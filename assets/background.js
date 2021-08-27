/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/background.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./src/background.js":
/*!***************************!*\
  !*** ./src/background.js ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports) {

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

/***/ })

/******/ });
//# sourceMappingURL=background.js.map