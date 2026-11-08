function lsRefresh() { lsRender(); }
$('ls-prev').onclick = () => lsChapter(lsCh - 1);
$('ls-next').onclick = () => lsChapter(lsCh + 1);
$('ls-ch').addEventListener('change', e => lsChapter(+e.target.value));

LANG = firstLang();
let initial = SAMPLES[0].code[LANG];
try { const d = localStorage.getItem(STORE); if (d !== null && d.trim()) initial = d; } catch (e) {}
$('code').value = initial;
hmOps = HM_OPS[0].slice();
setLang(LANG, false);
show(parseHash().route);
