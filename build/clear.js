var scriptTag = document.createElement('script');
scriptTag.type = 'text/javascript';
scriptTag.text = `g_browser.sendClearHostResolverCache();g_browser.sendFlushSocketPools();console.log('success!')`
document.body.appendChild(scriptTag);
