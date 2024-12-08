
if (process.env.NODE_ENV === 'development') {
    const eventSource = new EventSource(
        `http://${process.env.REACT_APP__HOST}:${process.env.REACT_APP__PORT}/reload/`
    );
    console.log(eventSource, 'eventSource', process.env, 12);
    eventSource.addEventListener('contentReload', async ({ data }) => {
        return chrome.tabs.getSelected(null, tab => {
            const { id } = tab;
            chrome.tabs.sendMessage(id, {
                type: 'contentReload',
            });
            console.log(data);
            chrome.runtime.reload();
        });
    });
}
console.log('This is the background page.');
