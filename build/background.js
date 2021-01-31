chrome.browserAction.setBadgeText({text: 'Shen'});
chrome.browserAction.setBadgeBackgroundColor({color: 'skyblue'});

chrome.contextMenus.create({
    title: "test_click",
    onclick: () => {
        alert('Hi');
    }
});

