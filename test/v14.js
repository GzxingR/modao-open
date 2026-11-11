/**
 * v1.4 自测：组合 / 解组
 */

import { Store } from '../src/store.js';
import { createProject, getDevice } from '../src/model.js';
import { createNodeEl } from '../src/nodes.js';
import { createCanvas } from '../src/canvas.js';
import { renderPageToDataURL } from '../src/io.js';
import { buildStandaloneHtml } from '../src/exportHtml.js';

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

const device = getDevice('iphone17');

function twoNodes() {
  const s = new Store();
  s.state.project = createProject('grp');
  const a = s.addNode('rect', { x: 20, y: 20, w: 60, h: 60 });
  const b = s.addNode('button', { x: 100, y: 50, w: 40, h: 40, text: 'B' });
  return { s, a, b };
}

/* ================= 组合 ================= */
await check('两个元素组合成组，子坐标转相对', () => {
  const { s, a, b } = twoNodes();
  s.select([a.id, b.id]);
  const g = s.groupSelected();
  assert(g, '没有生成组');
  assert(s.page.nodes.length === 1, '顶层节点数=' + s.page.nodes.length);
  assert(g.children.length === 2, '子元素数=' + g.children.length);
  assert(g.x === 20 && g.y === 20, '组坐标=' + g.x + ',' + g.y);
  const ca = g.children.find((c) => c.id === a.id);
  const cb = g.children.find((c) => c.id === b.id);
  assert(ca.x === 0 && ca.y === 0, 'A 相对坐标=' + ca.x + ',' + ca.y);
  assert(cb.x === 80 && cb.y === 30, 'B 相对坐标=' + cb.x + ',' + cb.y);
  return '组 ' + g.w + '×' + g.h;
});

await check('组尺寸是包围盒', () => {
  const { s, a, b } = twoNodes();
  s.select([a.id, b.id]);
  const g = s.groupSelected();
  assert(g.w === 120 && g.h === 70, '尺寸=' + g.w + '×' + g.h);
  return g.w + '×' + g.h;
});

await check('单个元素不能组合', () => {
  const { s, a } = twoNodes();
  s.select([a.id]);
  const g = s.groupSelected();
  assert(g === null, '居然组合成功了');
  assert(s.page.nodes.length === 2, '节点数被改了');
  return 'ok';
});

/* ================= 渲染 ================= */
await check('组渲染出子元素 DOM', () => {
  const { s, a, b } = twoNodes();
  s.select([a.id, b.id]);
  const g = s.groupSelected();
  const el = createNodeEl(g, { interactive: true });
  assert(el.children.length === 2, '子元素 DOM 数=' + el.children.length);
  const btn = el.querySelector('.node-button');
  assert(btn, '没渲染出按钮');
  assert(btn.textContent.indexOf('B') >= 0, '按钮文案丢了');
  return '2 个子元素';
});

/* ================= 解组 ================= */
await check('解散后坐标还原', () => {
  const { s, a, b } = twoNodes();
  s.select([a.id, b.id]);
  s.groupSelected();
  s.select([s.page.nodes[0].id]);
  const n = s.ungroupSelected();
  assert(n === 2, '拆出数量=' + n);
  assert(s.page.nodes.length === 2, '顶层节点数=' + s.page.nodes.length);
  const ra = s.page.nodes.find((x) => x.id === a.id);
  const rb = s.page.nodes.find((x) => x.id === b.id);
  assert(ra.x === 20 && ra.y === 20, 'A 还原=' + ra.x + ',' + ra.y);
  assert(rb.x === 100 && rb.y === 50, 'B 还原=' + rb.x + ',' + rb.y);
  return '坐标还原 ok';
});

/* ================= 交互 ================= */
await check('点组内子元素选中的是组', () => {
  const { s, a, b } = twoNodes();
  s.select([a.id, b.id]);
  const g = s.groupSelected();
  s.state.zoom = 1;

  const host = document.getElementById('testHost');
  const cv = createCanvas({
    canvasHost: host,
    nodesLayer: document.getElementById('testNodes'),
    hintsLayer: document.getElementById('testHints'),
    store: s
  });
  cv.render();

  const inner = host.querySelector('.node-button');
  assert(inner, '画布上没有按钮');
  inner.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, clientX: 30, clientY: 30, pointerId: 9, button: 0
  }));
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 30, clientY: 30, pointerId: 9 }));
  assert(s.state.selection.length === 1, '选中数=' + s.state.selection.length);
  assert(s.state.selection[0] === g.id, '选中的不是组');
  return '选中组';
});

await check('拖动组时子元素相对位置不变', () => {
  const { s, a, b } = twoNodes();
  s.select([a.id, b.id]);
  const g = s.groupSelected();
  const before = g.children.map((c) => ({ id: c.id, x: c.x, y: c.y }));
  s.state.zoom = 1;

  const host = document.getElementById('testHost');
  const cv = createCanvas({
    canvasHost: host,
    nodesLayer: document.getElementById('testNodes'),
    hintsLayer: document.getElementById('testHints'),
    store: s
  });
  cv.render();

  const el = host.querySelector('[data-id="' + g.id + '"]');
  el.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, clientX: 40, clientY: 40, pointerId: 11, button: 0
  }));
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 140, clientY: 90, pointerId: 11 }));
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 140, clientY: 90, pointerId: 11 }));

  assert(g.x === 120 && g.y === 70, '组位置=' + g.x + ',' + g.y);
  for (const c of g.children) {
    const b0 = before.find((x) => x.id === c.id);
    assert(c.x === b0.x && c.y === b0.y, '子元素相对坐标变了');
  }
  return '组移到 ' + g.x + ',' + g.y;
});

await check('删除组会连子元素一起消失', () => {
  const { s, a, b } = twoNodes();
  s.select([a.id, b.id]);
  s.groupSelected();
  s.select([s.page.nodes[0].id]);
  s.deleteSelected();
  assert(s.page.nodes.length === 0, '还剩 ' + s.page.nodes.length);
  return 'ok';
});

/* ================= 导出 ================= */
await check('导出 PNG 包含组内容', async () => {
  const { s, a, b } = twoNodes();
  s.select([a.id, b.id]);
  s.groupSelected();
  const r = await renderPageToDataURL(s.page);
  assert(r.width === 804, '宽=' + r.width);

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('PNG 解码失败'));
    i.src = r.dataUrl;
  });
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g2 = c.getContext('2d');
  g2.drawImage(img, 0, 0);
  // 按钮区域（组内 B：页面坐标 100,50 + 组内 80,30 → 绝对 100,50）
  const px = g2.getImageData(240, 140, 1, 1).data;
  assert(px[0] < 250 || px[1] < 250 || px[2] < 250, '该区域是纯白，组没画上');
  return 'rgb(' + px[0] + ',' + px[1] + ',' + px[2] + ')';
});

await check('演示 HTML 含组内元素', () => {
  const { s, a, b } = twoNodes();
  s.select([a.id, b.id]);
  s.groupSelected();
  const html = buildStandaloneHtml(s.project);
  assert(html.indexOf('>B<') >= 0 || html.indexOf('B<') >= 0, '组内按钮文案没进演示文件');
  assert(html.indexOf('data-id') >= 0, '缺 data-id');
  return Math.round(html.length / 1024) + ' KB';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
