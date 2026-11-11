/**
 * v2.7 自测：渲染性能（增量复用 + 脏检查）
 */

import { Store } from '../src/store.js';
import { createProject } from '../src/model.js';
import { createCanvas } from '../src/canvas.js';

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

function makeCanvas() {
  const s = new Store();
  s.state.project = createProject('perf');
  const host = document.getElementById('host');
  const layer = document.getElementById('nodes');
  layer.textContent = ''; // 清掉上一个用例残留的 DOM
  const cv = createCanvas({
    canvasHost: host,
    nodesLayer: layer,
    hintsLayer: document.getElementById('hints'),
    store: s
  });
  cv.render();
  return { s, cv, host, layer };
}

/* ================= 增量复用 ================= */
await check('只改位置时复用同一个 DOM 节点', () => {
  const { s, cv, layer } = makeCanvas();
  const a = s.addNode('rect', { x: 10, y: 10, w: 100, h: 50 });
  cv.render();
  const el1 = layer.querySelector('[data-id="' + a.id + '"]');
  assert(el1, '没渲染出来');

  a.x = 200;
  a.y = 120;
  cv.render();
  const el2 = layer.querySelector('[data-id="' + a.id + '"]');
  assert(el1 === el2, 'DOM 被重建了（引用不同）');
  assert(el2.style.left === '200px', 'left 没更新：' + el2.style.left);
  assert(el2.style.top === '120px', 'top 没更新：' + el2.style.top);
  return '同引用，位置已更新';
});

await check('改外观时重建该节点', () => {
  const { s, cv, layer } = makeCanvas();
  const a = s.addNode('rect', { x: 10, y: 10, w: 100, h: 50, bg: '#1677ff' });
  cv.render();
  const el1 = layer.querySelector('[data-id="' + a.id + '"]');
  a.bg = '#ff0000';
  cv.render();
  const el2 = layer.querySelector('[data-id="' + a.id + '"]');
  assert(el1 !== el2, '外观变了却没重建');
  assert(el2.style.background.indexOf('255, 0, 0') >= 0, '背景没更新：' + el2.style.background);
  return 'ok';
});

await check('新增与删除节点同步到 DOM', () => {
  const { s, cv, layer } = makeCanvas();
  s.addNode('rect');
  s.addNode('text', { text: '甲' });
  cv.render();
  assert(layer.children.length === 2, '渲染数量=' + layer.children.length);

  const third = s.addNode('button', { text: '乙' });
  cv.render();
  assert(layer.children.length === 3, '新增后数量=' + layer.children.length);

  s.select([third.id]);
  s.deleteSelected();
  cv.render();
  assert(layer.children.length === 2, '删除后数量=' + layer.children.length);
  assert(!layer.querySelector('[data-id="' + third.id + '"]'), '删除的元素还在');
  return '2 → 3 → 2';
});

await check('渲染统计：第二次全复用', () => {
  const { s, cv, host } = makeCanvas();
  for (let i = 0; i < 40; i += 1) {
    s.addNode('rect', { x: (i % 8) * 45, y: Math.floor(i / 8) * 60, w: 40, h: 50 });
  }
  cv.render();
  const created1 = Number(host.dataset.lastRenderCreated);
  assert(created1 === 40, '首次创建数=' + created1);

  cv.render();
  const created2 = Number(host.dataset.lastRenderCreated);
  const reused2 = Number(host.dataset.lastRenderReused);
  assert(created2 === 0, '第二次不该创建：' + created2);
  assert(reused2 === 40, '第二次复用数=' + reused2);
  return '40 全部复用';
});

await check('200 个元素渲染耗时在合理范围', () => {
  const { s, cv, host } = makeCanvas();
  for (let i = 0; i < 200; i += 1) {
    s.addNode('rect', { x: (i % 10) * 38, y: Math.floor(i / 10) * 40, w: 34, h: 34 });
  }
  const t0 = performance.now();
  cv.render();
  const first = performance.now() - t0;

  const t1 = performance.now();
  cv.render();
  const second = performance.now() - t1;

  assert(first < 3000, '首次渲染太慢：' + first.toFixed(0) + 'ms');
  assert(second < 300, '复用渲染太慢：' + second.toFixed(0) + 'ms');
  return '首次 ' + first.toFixed(0) + 'ms / 复用 ' + second.toFixed(0) + 'ms';
});

await check('z-index 跟随图层顺序', () => {
  const { s, cv, layer } = makeCanvas();
  const a = s.addNode('rect', { x: 0, y: 0, w: 50, h: 50 });
  const b = s.addNode('rect', { x: 10, y: 10, w: 50, h: 50 });
  cv.render();
  let elA = layer.querySelector('[data-id="' + a.id + '"]');
  let elB = layer.querySelector('[data-id="' + b.id + '"]');
  assert(Number(elA.style.zIndex) < Number(elB.style.zIndex), '顺序不对：' + elA.style.zIndex + ' vs ' + elB.style.zIndex);

  s.bringForward(a.id);
  cv.render();
  elA = layer.querySelector('[data-id="' + a.id + '"]');
  elB = layer.querySelector('[data-id="' + b.id + '"]');
  assert(Number(elA.style.zIndex) > Number(elB.style.zIndex), '上移后 z-index 没变：' + elA.style.zIndex + ' vs ' + elB.style.zIndex);
  return 'z-index 同步';
});

await check('隐藏的元素复用但 display 为 none', () => {
  const { s, cv, layer } = makeCanvas();
  const a = s.addNode('rect', { x: 0, y: 0, w: 50, h: 50 });
  cv.render();
  const el1 = layer.querySelector('[data-id="' + a.id + '"]');
  a.hidden = true;
  cv.render();
  const el2 = layer.querySelector('[data-id="' + a.id + '"]');
  assert(el1 !== el2, 'hidden 属于结构变化，应重建');
  assert(el2.style.display === 'none', 'display 应为 none：' + el2.style.display);
  return 'ok';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
