/**
 * v2.6 自测：触屏（双指缩放、触控目标）与键盘可达性（Esc 优先级、aria）
 */

import { Store } from '../src/store.js';
import { createProject } from '../src/model.js';
import { createCanvas } from '../src/canvas.js';
import { decideEscape, pinchZoom, distance, ariaLabels } from '../src/keys.js';

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

/* ================= Esc 优先级 ================= */
await check('Esc 优先级：菜单 > 预览 > 弹窗 > 取消选中', () => {
  assert(decideEscape({}) === 'none', '全空应为 none');
  assert(decideEscape({ hasSelection: true }) === 'clear-selection', '有选中应清选中');
  assert(decideEscape({ modalOpen: true, hasSelection: true }) === 'close-modal', '弹窗优先于选中');
  assert(decideEscape({ previewOpen: true, modalOpen: true }) === 'close-preview', '预览优先于弹窗');
  assert(decideEscape({ menuOpen: true, previewOpen: true }) === 'close-menu', '菜单最优先');
  return '4 级优先级正确';
});

/* ================= 双指缩放计算 ================= */
await check('pinchZoom 按距离比例缩放', () => {
  assert(Math.abs(pinchZoom(1, 100, 200) - 2) < 1e-6, '放大 2 倍失败');
  assert(Math.abs(pinchZoom(1, 200, 100) - 0.5) < 1e-6, '缩小一半失败');
  assert(Math.abs(pinchZoom(1.5, 100, 150) - 2.25) < 1e-6, '基于起始缩放计算错误');
  return 'ok';
});

await check('pinchZoom 夹在上下限', () => {
  assert(pinchZoom(2, 100, 1000) === 3, '上限没夹住：' + pinchZoom(2, 100, 1000));
  assert(pinchZoom(0.2, 100, 1) === 0.1, '下限没夹住：' + pinchZoom(0.2, 100, 1));
  assert(pinchZoom(1.5, 5, 100) === 1.5, '起始距离太小时应原样返回');
  return 'ok';
});

await check('distance 计算正确', () => {
  assert(distance({ x: 0, y: 0 }, { x: 3, y: 4 }) === 5, '3-4-5 失败');
  return 'ok';
});

/* ================= 真实双指手势 ================= */
function mountCanvas() {
  const s = new Store();
  s.state.project = createProject('touch');
  s.state.zoom = 1;
  const host = document.getElementById('host');
  const cv = createCanvas({
    canvasHost: host,
    nodesLayer: document.getElementById('nodes'),
    hintsLayer: document.getElementById('hints'),
    store: s
  });
  cv.render();
  return { s, cv, host };
}

function touch(host, type, id, x, y) {
  host.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y
  }));
}

await check('双指张开 → 放大', () => {
  const { s, host } = mountCanvas();
  touch(host, 'pointerdown', 11, 100, 100);
  touch(host, 'pointerdown', 12, 200, 100); // 距离 100
  touch(host, 'pointermove', 12, 300, 100); // 距离 200
  assert(Math.abs(s.state.zoom - 2) < 0.02, 'zoom=' + s.state.zoom);
  touch(host, 'pointerup', 11, 100, 100);
  touch(host, 'pointerup', 12, 300, 100);
  return '1.00 → ' + s.state.zoom.toFixed(2);
});

await check('双指捏合 → 缩小', () => {
  const { s, host } = mountCanvas();
  touch(host, 'pointerdown', 21, 100, 100);
  touch(host, 'pointerdown', 22, 300, 100); // 距离 200
  touch(host, 'pointermove', 22, 150, 100); // 距离 50
  assert(Math.abs(s.state.zoom - 0.25) < 0.02, 'zoom=' + s.state.zoom);
  touch(host, 'pointerup', 22, 150, 100);
  touch(host, 'pointerup', 21, 100, 100);
  return '1.00 → ' + s.state.zoom.toFixed(2);
});

await check('单指拖动不触发缩放', () => {
  const { s, host } = mountCanvas();
  const z0 = s.state.zoom;
  touch(host, 'pointerdown', 31, 100, 100);
  touch(host, 'pointermove', 31, 300, 300);
  touch(host, 'pointerup', 31, 300, 300);
  assert(s.state.zoom === z0, 'zoom 变了：' + s.state.zoom);
  return 'ok';
});

await check('鼠标指针不参与双指逻辑', () => {
  const { s, host } = mountCanvas();
  const z0 = s.state.zoom;
  host.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 41, pointerType: 'mouse', clientX: 10, clientY: 10 }));
  host.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 42, pointerType: 'mouse', clientX: 100, clientY: 10 }));
  host.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 42, pointerType: 'mouse', clientX: 300, clientY: 10 }));
  assert(s.state.zoom === z0, '鼠标不该触发缩放：' + s.state.zoom);
  return 'ok';
});

await check('双指缩放后松开，再次单指不会残留 pinch', () => {
  const { s, host } = mountCanvas();
  touch(host, 'pointerdown', 51, 100, 100);
  touch(host, 'pointerdown', 52, 200, 100);
  touch(host, 'pointermove', 52, 300, 100);
  touch(host, 'pointerup', 51, 100, 100);
  touch(host, 'pointerup', 52, 300, 100);

  const z1 = s.state.zoom;
  // 单指再动，不应继续缩放
  touch(host, 'pointerdown', 53, 100, 100);
  touch(host, 'pointermove', 53, 400, 400);
  assert(s.state.zoom === z1, 'pinch 状态残留：' + s.state.zoom);
  touch(host, 'pointerup', 53, 400, 400);
  return 'ok';
});

/* ================= aria ================= */
await check('按钮自动补 aria-label', () => {
  const n = ariaLabels(document);
  assert(n >= 1, '一个都没补：' + n);
  const b1 = document.getElementById('b1');
  assert(b1.getAttribute('aria-label').indexOf('撤销') >= 0, 'b1 标签不对：' + b1.getAttribute('aria-label'));
  const b2 = document.getElementById('b2');
  assert(b2.getAttribute('aria-label') === '自定义标签', 'b2 原有标签被覆盖：' + b2.getAttribute('aria-label'));
  // 再跑一次不重复计数
  const n2 = ariaLabels(document);
  assert(n2 === 0, '第二次不该再补：' + n2);
  return '补了 ' + n + ' 个';
});

await check('触屏样式包含 coarse 媒体查询与 touch-action', async () => {
  const css = await (await fetch('../css/app.css')).text();
  assert(css.indexOf('pointer: coarse') >= 0, '缺 coarse 媒体查询');
  assert(css.indexOf('touch-action: none') >= 0, '缺 touch-action');
  assert(css.indexOf(':focus-visible') >= 0, '缺焦点环');
  return 'ok';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
