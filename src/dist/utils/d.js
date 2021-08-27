var url = 'https://buyertrade.taobao.com/trade/itemlist/asyncBought.htm?action=itemlist%2FBoughtQueryAction&event_submit_do_query=1&_input_charset=utf8';
window.orderArr = [];
var pageNum = 1;

function getOrder() {
    $.post(url, {
        pageSize: 50,
        pageNum: pageNum
    }, res => {
        const resData = JSON.parse(res);

        const {page, mainOrders} = resData
        const {currentPage, totalPage} = page;
        console.log(resData, 888, currentPage, totalPage);
        if (currentPage <= totalPage) {
            window.orderArr = window.orderArr.concat(mainOrders);
            pageNum++;
            getOrder()
        } else {
            saveJSON(window.orderArr, "test.json")
        }
        // saveJSON(res,"test.json");
    });
}

getOrder();

function saveJSON(data, filename) {
    if (!data) {
        alert('data is null');
        return;
    }
    if (!filename) {
        filename = 'json.json'
    }
    if (typeof data === 'object') {
        data = JSON.stringify(data, undefined, 4)
    }
    var blob = new Blob([data], {type: 'text/json'});
    var e = document.createEvent('MouseEvents');
    var a = document.createElement('a');
    a.download = filename;
    a.href = window.URL.createObjectURL(blob);
    a.dataset.downloadurl = ['text/json', a.download, a.href].join(':');
    e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    a.dispatchEvent(e);
}
