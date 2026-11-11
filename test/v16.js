/**
 * v1.6 GUI 自测：图标化工具栏、可折叠属性分组、SVG 图层图标、连线标签胶囊
 */

import { Store } from '../src/store.js';
import { createProject } from '../src/model.js';
import { renderInspector } from '../src/inspector.js';
import { renderLayerList, renderPageList } from '../src/library.js';
import { renderLinks } from '../src/links.js';

const results = [];
async function check(name, fn) {
  try {
    const d = await fn();
    results.push('PASS  ' + name + (d ? '  (' + d + ')' : ''));
  } catch (e) {
    results.push('FAIL  ' + name + '  -> ' + (e && e.message ? e.message : e));
  }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }

/* ================= 工具栏图标化 ================= */
await check('工具栏按钮全部是图标按钮且带 svg', async () => {
  const res = await fetch('../index.html');
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const btns = doc.querySelectorAll('.toolbar .icon-btn');
  assert(btns.length >= 8, '图标按钮数=' + btns.length);
  let withSvg = 0;
  btns.forEach((b) => { if (b.querySelector('svg')) withSvg += 1; });
  assert(withSvg === btns.length, '有按钮没有 svg：' + withSvg + '/' + btns.length);
  // 每个都该有 title 提示
  let withTitle = 0;
  btns.forEach((b) => { if (b.getAttribute('title')) withTitle += 1; });
  assert(withTitle === btns.length, '有按钮没有 title：' + withTitle);
  return btns.length + ' 个图标按钮';
});

await check('工具栏分组存在', async () => {
  const doc = new DOMParser().parseFromString(await (await fetch('../index.html')).text(), 'text/html');
  const groups = doc.querySelectorAll('.toolbar .tb-group');
  assert(groups.length >= 3, '分组数=' + groups.length);
  return groups.length + ' 组';
});

/* ================= 属性面板折叠 ================= */
await check('属性分组带折叠箭头并可收起', () => {
  localStorage.removeItem('modao-open:collapsed-groups');
  const s = new Store();
  s.state.project = createProject('gui');
  s.addNode('button', { text: '按钮' });
  s.select([s.page.nodes[0].id]);
  const box = document.getElementById('inspectorBox');
  renderInspector(box, s, {
    update() {}, toast() {}, align() {},
    bringForward() {}, sendBackward() {}, bringToFront() {}, sendToBack() {}
  });

  const head = box.querySelector('.group-head');
  assert(head, '没有 group-head');
  const caret = head.querySelector('.caret svg');
  assert(caret, '没有折叠箭头（svg）');
  const body = head.nextElementSibling;
  assert(body && body.classList.contains('group-body'), '没有 group-body');
  assert(body.style.display !== 'none', '默认不该折叠');

  const groupEl = head.parentElement;
  head.click();
  assert(body.style.display === 'none', '点击后没折叠');
  assert(groupEl.classList.contains('collapsed'), '没有加 collapsed 类');

  // 折叠状态要持久化
  const saved = JSON.parse(localStorage.getItem('modao-open:collapsed-groups') || '{}');
  const title = head.textContent.trim();
  assert(saved[title] === true, '折叠状态没存：' + JSON.stringify(saved));

  head.click();
  assert(body.style.display === '', '再点没展开');
  assert(!groupEl.classList.contains('collapsed'), 'collapsed 类没移除');
  return '折叠/展开/持久化 ok';
});

/* ================= 图层图标 ================= */
await check('图层行用 SVG 图标而不是文字符号', () => {
  const s = new Store();
  s.state.project = createProject('gui2');
  s.addNode('text', { text: '标题' });
  s.addNode('button', { text: '确定' });
  const box = document.getElementById('layerBox');
  renderLayerList(box, s, { toast() {} });

  const rows = box.querySelectorAll('.layer-item');
  assert(rows.length === 2, '行数=' + rows.length);
  rows.forEach((row) => {
    const icon = row.querySelector('.l-icon svg');
    assert(icon, '某行没有 svg 图标');
  });
  const btns = rows[0].querySelectorAll('.l-btn svg');
  assert(btns.length === 2, '眼睛/锁不是 svg：' + btns.length);
  return rows.length + ' 行 / 每行 2 个按钮都是 svg';
});

await check('页面列表也有图标', () => {
  const s = new Store();
  s.state.project = createProject('gui3');
  const box = document.getElementById('pagesBox');
  renderPageList(box, s, { toast() {} });
  const icon = box.querySelector('.page-item .p-icon svg');
  assert(icon, '页面行没有 svg 图标');
  return 'ok';
});

/* ================= 连线标签胶囊 ================= */
await check('连线标签带白色胶囊底', () => {
  const s = new Store();
  s.state.project = createProject('gui4');
  const a = s.addNode('button', { x: 41, y: 300, w: 320, h: 44, text: '去下一页' });
  s.addPage('第二页');
  s.setActivePage(s.project.pages[0].id);
  s.updateNode(a.id, { link: { action: 'navigate', trigger: 'click', targetPageId: s.project.pages[1].id } });

  const layer = document.getElementById('linksLayer');
  s.state.showLinks = true;
  renderLinks(layer, s);

  const texts = layer.querySelectorAll('text.link-label');
  assert(texts.length === 1, '标签数=' + texts.length);
  const rects = layer.querySelectorAll('svg > rect');
  assert(rects.length >= 1, '没有胶囊底 rect');
  const bg = rects[0];
  assert(bg.getAttribute('rx') === '3', '不是圆角胶囊');
  assert(bg.getAttribute('fill').indexOf('255,255,255') >= 0, '底色不是白：' + bg.getAttribute('fill'));
  const w = parseFloat(bg.getAttribute('width'));
  assert(w > 20, '胶囊宽度异常：' + w);
  return '宽度 ' + Math.round(w) + 'px';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
