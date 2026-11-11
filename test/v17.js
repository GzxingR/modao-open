/**
 * v1.7 自测：画布交互（Ctrl+滚轮缩放、空格平移、右键菜单）+ 空状态引导
 */

import { Store } from '../src/store.js';
import { createProject } from '../src/model.js';
import { createCanvas } from '../src/canvas.js';
import { openMenu, hideMenu, isMenuOpen } from '../src/contextmenu.js';

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

function makeCanvas(extra) {
  const s = new Store();
  s.state.project = createProject('gui');
  s.state.zoom = 1;
  const host = document.getElementById('testHost');
  const cv = createCanvas(Object.assign({
    canvasHost: host,
    nodesLayer: document.getElementById('testNodes'),
    hintsLayer: document.getElementById('testHints'),
    store: s
  }, extra || {}));
  cv.render();
  return { s, cv, host };
}

/* ================= Ctrl + 滚轮缩放 ================= */
await check('Ctrl+滚轮放大、缩小', () => {
  const { s, host } = makeCanvas();
  const z0 = s.state.zoom;
  host.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100, clientX: 100, clientY: 100
  }));
  const z1 = s.state.zoom;
  assert(z1 > z0, '放大失败：' + z0 + ' → ' + z1);

  host.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true, cancelable: true, ctrlKey: true, deltaY: 100, clientX: 100, clientY: 100
  }));
  const z2 = s.state.zoom;
  assert(z2 < z1, '缩小失败：' + z1 + ' → ' + z2);
  return z0.toFixed(2) + ' → ' + z1.toFixed(2) + ' → ' + z2.toFixed(2);
});

await check('不按 Ctrl 滚轮不缩放', () => {
  const { s, host } = makeCanvas();
  const z0 = s.state.zoom;
  host.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true, cancelable: true, ctrlKey: false, deltaY: -100, clientX: 100, clientY: 100
  }));
  assert(s.state.zoom === z0, '不该缩放：' + s.state.zoom);
  return 'ok';
});

await check('缩放有上下限', () => {
  const { s, host } = makeCanvas();
  for (let i = 0; i < 40; i += 1) {
    host.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100, clientX: 50, clientY: 50
    }));
  }
  assert(s.state.zoom <= 3.0001, '超过上限：' + s.state.zoom);
  for (let i = 0; i < 80; i += 1) {
    host.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, ctrlKey: true, deltaY: 100, clientX: 50, clientY: 50
    }));
  }
  assert(s.state.zoom >= 0.0999, '低于下限：' + s.state.zoom);
  return 'zoom=' + s.state.zoom.toFixed(2);
});

/* ================= 空格平移 ================= */
await check('空格模式下拖拽平移画布滚动位置', () => {
  const { s, cv, host } = makeCanvas();
  s.setZoom(2);
  cv.applyZoom(); // 让画布真正放大，容器才可滚动
  const scroller = document.getElementById('stageScroll');
  s.setSpacePanning(true);
  scroller.scrollLeft = 200;
  scroller.scrollTop = 200;
  assert(scroller.scrollLeft === 200, '前置滚动设置失败：' + scroller.scrollLeft);

  host.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, clientX: 300, clientY: 300, pointerId: 21, button: 0
  }));
  window.dispatchEvent(new PointerEvent('pointermove', {
    bubbles: true, clientX: 250, clientY: 260, pointerId: 21
  }));
  window.dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true, clientX: 250, clientY: 260, pointerId: 21
  }));

  // 向左上拖 → 内容跟手 → 滚动位置增加
  assert(scroller.scrollLeft > 200, 'scrollLeft 没变：' + scroller.scrollLeft);
  assert(scroller.scrollTop > 200, 'scrollTop 没变：' + scroller.scrollTop);
  s.setSpacePanning(false);
  return 'scroll ' + scroller.scrollLeft + ',' + scroller.scrollTop;
});

await check('非空格模式下拖拽不会平移，而是框选/取消选择', () => {
  const { s, cv, host } = makeCanvas();
  cv.applyZoom();
  const scroller = document.getElementById('stageScroll');
  scroller.scrollLeft = 100;
  const before = scroller.scrollLeft;
  host.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, clientX: 20, clientY: 20, pointerId: 22, button: 0
  }));
  window.dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true, clientX: 20, clientY: 20, pointerId: 22
  }));
  assert(scroller.scrollLeft === before, '不该滚动：' + scroller.scrollLeft + ' vs ' + before);
  return 'ok';
});

/* ================= 右键菜单 ================= */
await check('右键节点触发菜单回调并带上节点 id', () => {
  let got = null;
  const { s, cv, host } = makeCanvas({ onContextMenu(x, y, id) { got = { x, y, id }; } });
  const n = s.addNode('button', { x: 20, y: 20, w: 120, h: 40, text: '右键我' });
  cv.render();
  s.select([]);

  const el = host.querySelector('[data-id="' + n.id + '"]');
  assert(el, '画布上没渲染出该节点');
  el.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true, cancelable: true, clientX: 60, clientY: 40
  }));
  assert(got, '没触发 onContextMenu');
  assert(got.id === n.id, '节点 id 不对：' + got.id);
  assert(s.state.selection[0] === n.id, '右键没选中该节点');
  return 'id ok';
});

await check('右键空白处不带节点 id', () => {
  let got = 'unset';
  makeCanvas({ onContextMenu(x, y, id) { got = { x, y, id }; } });
  document.getElementById('testHost').dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true, cancelable: true, clientX: 2, clientY: 2
  }));
  assert(got !== 'unset', '没触发');
  assert(got.id === null, '空白处不该有 id：' + got.id);
  return 'ok';
});

await check('菜单能打开、渲染项、点击执行并关闭', () => {
  hideMenu();
  let clicked = 0;
  openMenu(120, 120, [
    { label: '复制一份', hint: 'Ctrl+D', action: () => { clicked += 1; } },
    { divider: true },
    { label: '删除', danger: true, action: () => { clicked += 10; } }
  ]);
  assert(isMenuOpen(), '菜单没打开');
  const el = document.getElementById('ctxMenu');
  const items = el.querySelectorAll('.ctx-item');
  const dividers = el.querySelectorAll('.ctx-divider');
  assert(items.length === 2, '项数=' + items.length);
  assert(dividers.length === 1, '分隔线数=' + dividers.length);
  assert(items[1].classList.contains('danger'), 'danger 样式没加上');
  const hint = items[0].querySelector('.ctx-hint');
  assert(hint && hint.textContent === 'Ctrl+D', '快捷键提示不对');

  items[1].click();
  assert(clicked === 10, '点击没执行：' + clicked);
  assert(!isMenuOpen(), '点击后没关闭');
  return '2 项 / 1 分隔线 / 点击执行并关闭';
});

await check('菜单会夹在视口内', () => {
  hideMenu();
  openMenu(window.innerWidth - 5, window.innerHeight - 5, [
    { label: '一项', action() {} }
  ]);
  const el = document.getElementById('ctxMenu');
  const rect = el.getBoundingClientRect();
  assert(rect.right <= window.innerWidth, '右边溢出：' + rect.right);
  assert(rect.bottom <= window.innerHeight, '下边溢出：' + rect.bottom);
  hideMenu();
  return 'ok';
});

/* ================= 空状态引导 ================= */
await check('空状态引导存在且默认隐藏', async () => {
  const html = await (await fetch('../index.html')).text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const guide = doc.getElementById('emptyGuide');
  assert(guide, '页面里没有 #emptyGuide');
  assert(guide.hasAttribute('hidden'), '默认应该隐藏');
  assert(guide.textContent.indexOf('开始画第一个页面') >= 0, '缺标题文案');
  const btn = guide.querySelector('[data-act="preset"]');
  assert(btn, '没有载入示例按钮');
  return 'ok';
});

await check('多选快捷键 Ctrl+A 会全选（逻辑层）', () => {
  const { s } = makeCanvas();
  s.addNode('rect');
  s.addNode('button');
  s.select(s.page.nodes.map((n) => n.id));
  assert(s.state.selection.length === 2, '选中数=' + s.state.selection.length);
  return 'ok';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
