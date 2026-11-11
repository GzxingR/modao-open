/**
 * 交互自测：真实挂载画布，模拟选择 / 拖拽 / 缩放 / 连线渲染
 */

import { Store } from '../src/store.js';
import { createCanvas } from '../src/canvas.js';
import { renderLinks } from '../src/links.js';
import { createProject } from '../src/model.js';
import { renderPage } from '../src/nodes.js';

const results = [];
function check(name, fn) {
  try {
    const d = fn();
    results.push('PASS  ' + name + (d ? '  (' + d + ')' : ''));
  } catch (e) {
    results.push('FAIL  ' + name + '  -> ' + (e && e.message));
  }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }

const store = new Store();
store.state.project = createProject('interact');
store.state.zoom = 1;

const host = document.getElementById('canvasHost');
const nodesLayer = document.getElementById('nodesLayer');
const hintsLayer = document.getElementById('hintsLayer');
const linksLayer = document.getElementById('linksLayer');

const canvas = createCanvas({ canvasHost: host, nodesLayer, hintsLayer, store });

function ptr(el, type, x, y, extra = {}) {
  const ev = new PointerEvent(type, Object.assign({
    bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: type === 'pointerup' ? 0 : 1
  }, extra));
  el.dispatchEvent(ev);
  return ev;
}

/* ---------- 1. 渲染 ---------- */
check('画布渲染出节点 DOM', () => {
  const n = store.addNode('rect');
  canvas.render();
  const el = nodesLayer.querySelector('[data-id="' + n.id + '"]');
  assert(el, '没有渲染出节点');
  return '1 个';
});

/* ---------- 2. 选中 ---------- */
check('点击节点选中并出现缩放手柄', () => {
  const n = store.page.nodes[0];
  canvas.render();
  const el = nodesLayer.querySelector('[data-id="' + n.id + '"]');
  ptr(el, 'pointerdown', 100, 100);
  ptr(window, 'pointerup', 100, 100);
  assert(store.isSelected(n.id), '没选中');
  const handles = el.querySelectorAll(':scope > .handle');
  assert(handles.length === 8, '手柄数量=' + handles.length);
  return '8 个手柄';
});

/* ---------- 3. 拖拽 ---------- */
check('拖动节点位置跟随鼠标', () => {
  const n = store.page.nodes[0];
  canvas.render();
  const el = nodesLayer.querySelector('[data-id="' + n.id + '"]');
  const x0 = n.x, y0 = n.y;
  ptr(el, 'pointerdown', 200, 200);
  ptr(window, 'pointermove', 260, 240);
  ptr(window, 'pointermove', 300, 280);
  ptr(window, 'pointerup', 300, 280);
  const dx = n.x - x0, dy = n.y - y0;
  assert(Math.abs(dx - 100) <= 6, 'dx=' + dx);
  assert(Math.abs(dy - 80) <= 6, 'dy=' + dy);
  return 'Δ=' + dx + ',' + dy;
});

/* ---------- 4. 缩放（右下角手柄） ---------- */
check('拖手柄改变尺寸', () => {
  const n = store.page.nodes[0];
  canvas.render();
  const el = nodesLayer.querySelector('[data-id="' + n.id + '"]');
  const h = el.querySelector('.handle.se');
  assert(h, '没有 se 手柄');
  const w0 = n.w, h0 = n.h;
  ptr(h, 'pointerdown', 300, 300);
  ptr(window, 'pointermove', 350, 340);
  ptr(window, 'pointerup', 350, 340);
  assert(n.w === w0 + 50, 'w=' + n.w + ' 期望 ' + (w0 + 50));
  assert(n.h === h0 + 40, 'h=' + n.h + ' 期望 ' + (h0 + 40));
  return n.w + 'x' + n.h;
});

/* ---------- 5. 空白处取消选择 ---------- */
check('点空白取消选择', () => {
  rect(host);
  canvas.render();
  store.select([store.page.nodes[0].id]);
  assert(store.state.selection.length === 1, '前置选择失败');
  host.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 }));
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 5, clientY: 5, pointerId: 1 }));
  assert(store.state.selection.length === 0, '选择没被清空');
  return 'ok';
});

/* ---------- 6. 连线 ---------- */
check('交互连线渲染成 svg path', () => {
  const a = store.page.nodes[0];
  const b = store.addNode('button');
  store.updateNode(a.id, { link: { action: 'toggle', targetNodeId: b.id } });
  store.state.showLinks = true;
  renderLinks(linksLayer, store);
  const paths = linksLayer.querySelectorAll('path.link-path');
  assert(paths.length === 1, 'path 数量=' + paths.length);
  return '1 条';
});

/* ---------- 7. 缩放比例 ---------- */
check('缩放改变画布 transform 与容器尺寸', () => {
  store.setZoom(0.5);
  canvas.applyZoom();
  assert(host.style.transform.indexOf('scale(0.5)') >= 0, 'transform=' + host.style.transform);
  const wrap = host.parentElement;
  assert(wrap.style.width === (store.device.w * 0.5) + 'px', 'wrap w=' + wrap.style.width);
  store.setZoom(1);
  canvas.applyZoom();
  return 'ok';
});

/* ---------- 8. 导出序列化 ---------- */
check('导出用 SVG 序列化成功', () => {
  const page = store.page;
  const dom = renderPage(page, { device: store.device });
  const xml = new XMLSerializer().serializeToString(dom);
  assert(xml.length > 100, 'xml 太短');
  assert(xml.indexOf('foreignObject') < 0, '渲染结果不该自带 foreignObject');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + store.device.w + '" height="' + store.device.h +
    '"><foreignObject width="100%" height="100%">' + xml + '</foreignObject></svg>';
  assert(svg.length > xml.length, 'svg 包装失败');
  return xml.length + ' 字节 XML';
});

function rect() { /* 占位，避免未使用告警 */ }

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
