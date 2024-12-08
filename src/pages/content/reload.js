chrome.runtime.onMessage.addListener(
    (
        msg,
        sender,
        sendResponse
    ) => {
        console.log('[content.js]. Message received', msg);
        sendResponse('received');
        if (process.env.NODE_ENV === 'development') {
            if (msg.type === 'contentReload') {
                console.log('current page will reload.');
                window.location.reload();
            }
        }
    }
);

