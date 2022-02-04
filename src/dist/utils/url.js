const incloudUrl = [
  'link.juejin.cn',
  'link.zhihu.com',
];
document.addEventListener('mousedown', function (Mevent) {
  const {target} = Mevent;
  const href = target.getAttribute('href');
  const reg = new RegExp(incloudUrl.join('|'));
  if (!reg.test(href)) return;
  const targetUrl = (new URL(href)).searchParams.get('target');
  targetUrl && target.setAttribute('href', targetUrl);
  // target.setAttribute('target', '_blank');
});
console.log(2222)
