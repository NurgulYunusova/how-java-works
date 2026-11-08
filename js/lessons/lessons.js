/* ---------- Lessons: one view, each topic brings its own stage ---------- */
const LS = {};
const LS_ORDER = ['gc', 'threads', 'chm', 'bytecode', 'classload', 'stream', 'treemap', 'strings', 'layout', 'vthreads'];
const LS_UI = {
  az: {step:'Addım', reset:'Əvvələ qaytar', chapter:'Bölmə', out:'Çıxış', code:'Kod', measured:'Real JVM ölçüsü', simplified:'Sadələşdirilmiş model'},
  tr: {step:'Adım', reset:'Başa dön', chapter:'Bölüm', out:'Çıktı', code:'Kod', measured:'Gerçek JVM ölçümü', simplified:'Basitleştirilmiş model'},
  en: {step:'Step', reset:'Start over', chapter:'Section', out:'Output', code:'Code', measured:'Real JVM measurement', simplified:'Simplified model'},
};
let lsId = null, lsCh = 0, lsState = null;
const lsX = () => LS[lsId].text[LANG];
const lu = k => { const x = lsX().ui; return x && k in x ? x[k] : LS_UI[LANG][k]; };
const ls$ = (k, ...a) => { const v = lu(k); return typeof v === 'function' ? v(...a) : v; };
const pnl = (title, body, cls) => `<div class="pnl${cls ? ' ' + cls : ''}">${title ? `<h2>${esc(nb(title))}</h2>` : ''}${body}</div>`;
const tag = (kind, label) => `<span class="tg tg-${kind}">${esc(nb(label))}</span>`;
const measured = html => `<p class="note-m"><b>${esc(LS_UI[LANG].measured)}.</b> ${html}</p>`;
const simplified = html => `<p class="note-s"><b>${esc(LS_UI[LANG].simplified)}.</b> ${html}</p>`;
/* Step buttons never change size, so they never move between steps. */
function lsStepper(cur, total, extra) {
  return `<div class="stepbar">
    <button class="btn" type="button" data-act="prev"${cur <= 0 ? ' disabled' : ''}>${esc(t('prev'))}</button>
    <button class="btn primary" type="button" data-act="next"${cur >= total ? ' disabled' : ''}>${esc(t('next'))}</button>
    <span class="count stepcount">${esc(LS_UI[LANG].step)} ${cur} / ${total}</span>
    <button class="btn ghost" type="button" data-act="reset"${cur <= 0 ? ' disabled' : ''}>${esc(LS_UI[LANG].reset)}</button>${extra || ''}
  </div>`;
}
function codeBlock(lines, active) {
  return `<ol class="srcv">${lines.map((l, i) => `<li class="${i === active ? 'on' : ''}">${esc(l) || ' '}</li>`).join('')}</ol>`;
}
function lsRender() {
  if (!lsId) return;
  const l = LS[lsId], x = lsX(), ch = x.ch[lsCh];
  const focused = document.activeElement && document.activeElement.closest && document.activeElement.closest('#ls-ctl [data-act], #ls-stage [data-act]');
  const refocus = focused ? focused.dataset.act + '|' + (focused.dataset.v || '') : null;
  const fieldId = document.activeElement && document.activeElement.id && document.activeElement.closest('#ls-ctl') ? document.activeElement.id : null;
  $('ls-title').textContent = nb(x.title);
  $('ls-title').classList.toggle('long', x.title.length > 22);
  $('ls-prose').innerHTML = `<h2>${esc(nb(ch[0]))}</h2>` + ch[1].map(p => `<p>${rich(p)}</p>`).join('');
  $('ls-count').textContent = `${LS_UI[LANG].chapter} ${lsCh + 1} / ${x.ch.length}`;
  $('ls-prev').disabled = lsCh === 0;
  $('ls-next').disabled = lsCh === x.ch.length - 1;
  $('ls-t-prev').textContent = `${t('prev')}: ${LS_UI[LANG].chapter}`;
  $('ls-t-next').textContent = `${t('next')}: ${LS_UI[LANG].chapter}`;
  const sel = $('ls-ch'); sel.textContent = '';
  x.ch.forEach((c, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${i + 1}. ${nb(c[0])}`; sel.appendChild(o); });
  sel.value = String(lsCh);
  $('ls-ctl').innerHTML = l.controls(lsState, lsCh);
  $('ls-ctl').hidden = !$('ls-ctl').innerHTML.trim();
  $('ls-stage').innerHTML = l.stage(lsState, lsCh);
  if (refocus) {
    const [a, v] = refocus.split('|');
    const b = [...document.querySelectorAll('#ls-ctl [data-act], #ls-stage [data-act]')].find(e => e.dataset.act === a && (e.dataset.v || '') === v && !e.disabled);
    if (b) b.focus();
  } else if (fieldId && $(fieldId)) { $(fieldId).focus(); }
}
function lsChapter(i) {
  const n = lsX().ch.length;
  lsCh = Math.max(0, Math.min(n - 1, i));
  lsState = LS[lsId].init(lsCh);
  lsRender();
  $('ls-prose').scrollTop = 0;
  const st = $('ls-stage'); if (st) st.scrollTop = 0;
}
function lsOpen(id) {
  if (lsId !== id) { lsId = id; lsChapter(0); }
  else lsRender();
}
document.addEventListener('click', e => {
  const b = e.target.closest('#view-lesson [data-act]');
  if (!b || b.disabled) return;
  LS[lsId].act(lsState, b.dataset.act, b.dataset.v, lsCh);
  lsRender();
});
document.addEventListener('change', e => {
  const c = e.target.closest('#view-lesson [data-change]');
  if (!c) return;
  LS[lsId].act(lsState, c.dataset.change, c.value, lsCh);
  lsRender();
});
document.addEventListener('submit', e => {
  const f = e.target.closest('#view-lesson form[data-submit]');
  if (!f) return;
  e.preventDefault();
  LS[lsId].act(lsState, f.dataset.submit, new FormData(f), lsCh);
  lsRender();
});
