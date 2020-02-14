const getQr = (url) => {
    return `http://api.hackshen.com/qrcode?data=${url}`
}

const getMsg = ()=>{
    $.get('http://api.hackshen.com/message').then((res) => {
        console.log(res)
        $('.message').html(res[0].title)
    })
}

const setQr = () => {

}
chrome.tabs.getSelected(null, (tab) => {
    window.tab = tab
    $('#qrcode').attr('src', getQr(tab.url))
});

getMsg();

$('#urlCode').on('click', () => {
    const url = getQr($('#urlVal').val());
    $('#qrcode').attr('src', url)
})

$('.message').on('click', () => {
    getMsg();
});