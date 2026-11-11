/**
 * v2.8 自测：批量标注、组件库同义词搜索、错误边界与数据恢复
 */

import { Store } from '../src/store.js';
import { createProject } from '../src/model.js';
import { createCanvas } from '../src/canvas.js';
import { renderLibrary } from '../src/library.js';

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

/* ================= 批量标注 ================= */
function makeCanvas() {
  const s = new Store();
  s.state.project = createProject('inspect');
  const layer = document.getElementById('nodes');
  layer.textContent = '';
  const cv = createCanvas({
    canvasHost: document.getElementById('host'),
    nodesLayer: layer,
    hintsLayer: document.getElementById('hints'),
    store: s
  });
  cv.render();
  return { s, cv, layer };
}

await check('开启标注后每个元素都有尺寸标签', () => {
  const { s, cv, layer } = makeCanvas();
  s.addNode('rect', { x: 10, y: 10, w: 120, h: 60 });
  s.addNode('button', { x: 10, y: 100, w: 200, h: 44, text: '按钮' });
  s.toggleInspect();
  cv.render();

  const labels = layer.querySelectorAll('.dim-label');
  assert(labels.length === 2, '标签数=' + labels.length);
  const texts = Array.from(labels).map((x) => x.textContent);
  assert(texts.indexOf('120 × 60') >= 0, '缺 120×60：' + texts.join(' / '));
  assert(texts.indexOf('200 × 44') >= 0, '缺 200×44：' + texts.join(' / '));
  assert(document.getElementById('host').classList.contains('inspect'), '没加 inspect 类');
  return labels.length + ' 个标签';
});

await check('关闭标注后标签被移除', () => {
  const { s, cv, layer } = makeCanvas();
  s.addNode('rect', { x: 10, y: 10, w: 100, h: 50 });
  s.toggleInspect();
  cv.render();
  assert(layer.querySelectorAll('.dim-label').length === 1, '前置失败');

  s.toggleInspect();
  cv.render();
  assert(layer.querySelectorAll('.dim-label').length === 0, '标签没清掉');
  assert(!document.getElementById('host').classList.contains('inspect'), 'inspect 类没移除');
  return 'ok';
});

await check('改尺寸后标签跟着更新', () => {
  const { s, cv, layer } = makeCanvas();
  const n = s.addNode('rect', { x: 10, y: 10, w: 100, h: 50 });
  s.toggleInspect();
  cv.render();
  n.w = 222;
  n.h = 111;
  cv.render();
  const lab = layer.querySelector('.dim-label');
  assert(lab && lab.textContent === '222 × 111', '标签没更新：' + (lab && lab.textContent));
  return 'ok';
});

/* ================= 组件库同义词 ================= */
const handlers = { addComponent() {}, toast() {} };
const store2 = new Store();
store2.state.project = createProject('lib');
const lib = document.getElementById('libBox');

function searchLib(kw) {
  renderLibrary(lib, store2, handlers, kw);
  return Array.from(lib.querySelectorAll('.lib-item')).map((x) => x.textContent);
}

await check('搜「弹窗」能找到卡片组件', () => {
  const r = searchLib('弹窗');
  assert(r.length === 1, '结果数=' + r.length + '：' + r.join(','));
  assert(r[0].indexOf('卡片') >= 0, '不是卡片：' + r[0]);
  return r[0];
});

await check('搜「底栏」能找到标签栏', () => {
  const r = searchLib('底栏');
  assert(r.length === 1, '结果数=' + r.length);
  assert(r[0].indexOf('标签栏') >= 0, '不是标签栏：' + r[0]);
  return r[0];
});

await check('搜「勾选」能找到复选框', () => {
  const r = searchLib('勾选');
  assert(r.length === 1, '结果数=' + r.length);
  assert(r[0].indexOf('复选框') >= 0, '不是复选框：' + r[0]);
  return r[0];
});

await check('搜「divider」能找到分割线（英文同义词）', () => {
  const r = searchLib('divider');
  assert(r.length === 1, '结果数=' + r.length);
  assert(r[0].indexOf('分割线') >= 0, '不是分割线：' + r[0]);
  return r[0];
});

await check('原来按名称/类型搜仍然有效', () => {
  assert(searchLib('按钮').length === 1, '按钮搜不到');
  assert(searchLib('navbar').length === 1, 'navbar 搜不到');
  assert(searchLib('').length === 16, '空搜索应显示全部：' + searchLib('').length);
  return 'ok';
});

await check('搜不到时仍给空提示', () => {
  renderLibrary(lib, store2, handlers, '压根不存在');
  assert(lib.querySelector('.lib-empty'), '没有空提示');
  return 'ok';
});

/* ================= 错误边界 ================= */
await check('坏 JSON：返回 false 且另存备份', () => {
  const s = new Store();
  localStorage.setItem('modao-open:project:v1', '{这不是JSON');
  localStorage.removeItem('modao-open:project:v1:broken');
  const ok = s.loadFromStorage();
  assert(ok === false, '应返回 false');
  assert(s.state.lastLoadError, '没记录错误原因');
  const backup = localStorage.getItem('modao-open:project:v1:broken');
  assert(backup && backup.indexOf('这不是JSON') >= 0, '备份没写：' + backup);
  localStorage.removeItem('modao-open:project:v1');
  localStorage.removeItem('modao-open:project:v1:broken');
  return '已备份坏数据';
});

await check('结构性坏数据：拒绝加载、说清原因、保留备份', () => {
  const s = new Store();
  localStorage.setItem('modao-open:project:v1', JSON.stringify({ pages: '不是数组' }));
  localStorage.removeItem('modao-open:project:v1:broken');
  const ok = s.loadFromStorage();
  assert(ok === false, '应拒绝加载坏结构');
  assert(String(s.state.lastLoadError).indexOf('pages') >= 0, '错误原因没说清：' + s.state.lastLoadError);
  assert(localStorage.getItem('modao-open:project:v1:broken'), '没留备份');
  localStorage.removeItem('modao-open:project:v1');
  localStorage.removeItem('modao-open:project:v1:broken');
  return '拒绝并备份';
});

await check('错误条元素与样式存在', async () => {
  const html = await (await fetch('../index.html')).text();
  assert(html.indexOf('id="errorBar"') >= 0, 'index.html 缺 errorBar');
  assert(html.indexOf('id="errorText"') >= 0, '缺 errorText');
  const css = await (await fetch('../css/app.css')).text();
  assert(css.indexOf('.error-bar') >= 0, '缺 .error-bar 样式');
  assert(css.indexOf('.dim-label') >= 0, '缺 .dim-label 样式');
  assert(css.indexOf('.canvas-host.inspect') >= 0, '缺 inspect 模式样式');
  return 'ok';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
