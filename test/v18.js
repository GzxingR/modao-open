/**
 * v1.8 自测：组件库分类 + 搜索、左栏可拖拽分栏
 */

import { Store } from '../src/store.js';
import { createProject, COMPONENTS } from '../src/model.js';
import { renderLibrary } from '../src/library.js';
import { initResizers } from '../src/resizer.js';

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

const store = new Store();
store.state.project = createProject('gui');
const handlers = { addComponent() {}, toast() {} };
const lib = document.getElementById('library');

/* ================= 组件库分类 ================= */
await check('无搜索时按分类分组', () => {
  renderLibrary(lib, store, handlers, '');
  const titles = lib.querySelectorAll('.lib-group-title');
  const items = lib.querySelectorAll('.lib-item');
  assert(titles.length === 4, '分类标题数=' + titles.length);
  assert(items.length === COMPONENTS.length, '组件数=' + items.length + ' / ' + COMPONENTS.length);
  const names = Array.from(titles).map((t) => t.textContent).join(',');
  assert(names.indexOf('基础') >= 0 && names.indexOf('表单') >= 0, '分类名不对：' + names);
  return titles.length + ' 组 / ' + items.length + ' 个组件';
});

await check('搜索框过滤（按名称）', () => {
  renderLibrary(lib, store, handlers, '按钮');
  const items = lib.querySelectorAll('.lib-item');
  assert(items.length === 1, '匹配数=' + items.length);
  assert(items[0].textContent.indexOf('按钮') >= 0, '匹配内容不对');
  const titles = lib.querySelectorAll('.lib-group-title');
  assert(titles.length === 0, '搜索时不该显示分类标题');
  return '1 个匹配';
});

await check('搜索框过滤（按类型英文）', () => {
  renderLibrary(lib, store, handlers, 'nav');
  const items = lib.querySelectorAll('.lib-item');
  assert(items.length === 1, '匹配数=' + items.length + '（期望 navbar）');
  return '1 个匹配';
});

await check('搜索大小写不敏感', () => {
  renderLibrary(lib, store, handlers, 'BUTTON');
  const items = lib.querySelectorAll('.lib-item');
  assert(items.length === 1, '匹配数=' + items.length);
  return 'ok';
});

await check('搜不到时给空提示', () => {
  renderLibrary(lib, store, handlers, 'zzzz不存在');
  const empty = lib.querySelector('.lib-empty');
  assert(empty, '没有空提示');
  assert(empty.textContent.indexOf('zzzz不存在') >= 0, '提示里没带关键词');
  return 'ok';
});

await check('清空搜索恢复全部分组', () => {
  renderLibrary(lib, store, handlers, '');
  const titles = lib.querySelectorAll('.lib-group-title');
  const items = lib.querySelectorAll('.lib-item');
  assert(titles.length === 4 && items.length === COMPONENTS.length, '恢复失败');
  return 'ok';
});

/* ================= 左栏分栏 ================= */
await check('resizer 能改变相邻面板高度', () => {
  localStorage.removeItem('modao-open:left-panes');
  const left = document.getElementById('leftBox');
  const pages = document.getElementById('panePages');
  const layers = document.getElementById('paneLayers');
  // 先固定成像素，便于断言
  pages.style.flex = '0 0 160px';
  layers.style.flex = '0 0 140px';

  initResizers({ container: left });
  const h0 = pages.getBoundingClientRect().height;

  const rz = document.getElementById('rz1');
  const startY = 200;
  rz.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientY: startY, pointerId: 31, button: 0 }));
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientY: startY + 40, pointerId: 31 }));
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientY: startY + 40, pointerId: 31 }));

  const h1 = pages.getBoundingClientRect().height;
  assert(Math.abs(h1 - (h0 + 40)) < 2, '高度没跟着变：' + h0 + ' → ' + h1);
  return Math.round(h0) + 'px → ' + Math.round(h1) + 'px';
});

await check('拖拽后比例写进 localStorage', () => {
  const raw = localStorage.getItem('modao-open:left-panes');
  assert(raw, '没写 localStorage');
  const arr = JSON.parse(raw);
  assert(Array.isArray(arr) && arr.length === 3, '格式不对：' + raw);
  const sum = arr.reduce((s, v) => s + v, 0);
  assert(sum > 50 && sum < 140, '比例之和异常：' + sum);
  return arr.join(' / ') + ' %';
});

await check('最小高度保护', () => {
  const left = document.getElementById('leftBox');
  const pages = document.getElementById('panePages');
  pages.style.flex = '0 0 160px';
  document.getElementById('paneLayers').style.flex = '0 0 140px';
  initResizers({ container: left, minHeight: 72 });

  const rz = document.getElementById('rz1');
  rz.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientY: 300, pointerId: 32, button: 0 }));
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientY: 300 - 500, pointerId: 32 }));
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientY: 300 - 500, pointerId: 32 }));

  const h = pages.getBoundingClientRect().height;
  assert(h >= 71, '低于最小高度：' + h);
  return 'h=' + Math.round(h);
});

await check('保存的比例能在下次恢复', () => {
  const left = document.getElementById('leftBox');
  localStorage.setItem('modao-open:left-panes', JSON.stringify([40, 30, 30]));
  initResizers({ container: left });
  const pages = document.getElementById('panePages');
  assert(pages.style.flex.indexOf('40%') >= 0, '没恢复：' + pages.style.flex);
  return pages.style.flex;
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
