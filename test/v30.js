/**
 * v3.0 自测：多选批量编辑、对齐增强、等间距分布
 */

import { Store } from '../src/store.js';
import { createProject } from '../src/model.js';
import { renderInspector } from '../src/inspector.js';

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

function makeStore() {
  const s = new Store();
  s.state.project = createProject('multi');
  return s;
}

/* ================= 批量编辑 ================= */
await check('批量改填充/圆角/透明度', () => {
  const s = makeStore();
  const a = s.addNode('rect', { x: 10, y: 10, w: 50, h: 50, bg: '#111111', radius: 0 });
  const b = s.addNode('rect', { x: 70, y: 10, w: 50, h: 50, bg: '#222222', radius: 0 });
  const c = s.addNode('button', { x: 130, y: 10, w: 50, h: 50, bg: '#333333' });
  s.select([a.id, b.id, c.id]);

  const n = s.batchUpdate({ bg: '#ff7d00', radius: 8, opacity: 60 });
  assert(n === 3, '影响数量=' + n);
  for (const node of [a, b, c]) {
    assert(node.bg === '#ff7d00', '填充没改：' + node.bg);
    assert(node.radius === 8, '圆角没改：' + node.radius);
    assert(node.opacity === 60, '透明度没改：' + node.opacity);
  }
  return '3 个元素一次改完';
});

await check('批量改不会动 id / type / 位置', () => {
  const s = makeStore();
  const a = s.addNode('rect', { x: 33, y: 44, w: 50, h: 50 });
  const b = s.addNode('text', { x: 99, y: 88, w: 50, h: 50, text: 'B' });
  s.select([a.id, b.id]);
  s.batchUpdate({ id: 'hacked', type: 'button', bg: '#00ff00', fontSize: 20 });
  assert(a.id !== 'hacked' && b.id !== 'hacked', 'id 被改了');
  assert(a.type === 'rect' && b.type === 'text', 'type 被改了');
  assert(a.x === 33 && b.y === 88, '位置被改了');
  assert(a.bg === '#00ff00' && b.fontSize === 20, '正常属性没生效');
  return 'ok';
});

await check('批量统一宽高与锁定', () => {
  const s = makeStore();
  const a = s.addNode('rect', { x: 10, y: 10, w: 100, h: 40 });
  const b = s.addNode('rect', { x: 10, y: 100, w: 200, h: 80 });
  s.select([a.id, b.id]);
  s.batchUpdate({ w: a.w, h: a.h });
  assert(b.w === 100 && b.h === 40, '宽高没统一：' + b.w + '×' + b.h);
  s.batchUpdate({ locked: true });
  assert(a.locked && b.locked, '锁定没生效');
  return 'ok';
});

/* ================= 对齐 ================= */
await check('多选时相对选区对齐（左/右/居中）', () => {
  const s = makeStore();
  const a = s.addNode('rect', { x: 40, y: 10, w: 60, h: 30 });
  const b = s.addNode('rect', { x: 200, y: 60, w: 100, h: 30 });
  s.select([a.id, b.id]);

  s.align('left');
  assert(a.x === 40 && b.x === 40, '左对齐失败：' + a.x + ',' + b.x);

  // 重新摆开（对齐会改变选区边界，每个方向单独验证）
  a.x = 40; b.x = 200;
  s.align('right');
  assert(a.x + a.w === 300 && b.x + b.w === 300, '右对齐失败：' + (a.x + a.w) + ',' + (b.x + b.w));

  a.x = 40; b.x = 200;
  s.align('hcenter');
  assert(a.x + a.w / 2 === 170 && b.x + b.w / 2 === 170, '水平居中失败：' + (a.x + a.w / 2) + ',' + (b.x + b.w / 2));
  return 'ok';
});

await check('多选时相对选区对齐（顶/底/居中）', () => {
  const s = makeStore();
  const a = s.addNode('rect', { x: 10, y: 30, w: 50, h: 40 });
  const b = s.addNode('rect', { x: 100, y: 200, w: 50, h: 60 });
  s.select([a.id, b.id]);

  s.align('top');
  assert(a.y === 30 && b.y === 30, '顶对齐失败：' + a.y + ',' + b.y);

  a.y = 30; b.y = 200;
  s.align('bottom');
  assert(a.y + a.h === 260 && b.y + b.h === 260, '底对齐失败：' + (a.y + a.h) + ',' + (b.y + b.h));

  a.y = 30; b.y = 200;
  s.align('vcenter');
  // 选区 y 范围 30~260，中心 145
  assert(a.y + a.h / 2 === 145 && b.y + b.h / 2 === 145, '垂直居中失败：' + (a.y + a.h / 2) + ',' + (b.y + b.h / 2));
  return 'ok';
});

await check('单选时相对画布对齐', () => {
  const s = makeStore();
  const a = s.addNode('rect', { x: 77, y: 99, w: 100, h: 40 });
  s.select([a.id]);
  s.align('left');
  assert(a.x === 16, '左对齐不是 16：' + a.x);
  s.align('hcenter');
  assert(a.x === Math.round((s.device.w - a.w) / 2), '水平居中不对：' + a.x);
  return 'ok';
});

/* ================= 等间距 ================= */
await check('水平等间距：三个不同宽度的元素间隙相等', () => {
  const s = makeStore();
  const a = s.addNode('rect', { x: 0, y: 10, w: 40, h: 40 });
  const b = s.addNode('rect', { x: 100, y: 10, w: 80, h: 40 });
  const c = s.addNode('rect', { x: 300, y: 10, w: 40, h: 40 });
  s.select([a.id, b.id, c.id]);

  s.align('distribute-h');
  const sorted = [a, b, c].sort((m, n) => m.x - n.x);
  const gap1 = sorted[1].x - (sorted[0].x + sorted[0].w);
  const gap2 = sorted[2].x - (sorted[1].x + sorted[1].w);
  assert(Math.abs(gap1 - gap2) <= 1, '间隙不等：' + gap1 + ' vs ' + gap2);
  assert(sorted[0].x === 0, '起点被移动了：' + sorted[0].x);
  assert(sorted[2].x + sorted[2].w === 340, '终点被移动了');
  return 'gap≈' + gap1;
});

await check('垂直等间距', () => {
  const s = makeStore();
  const a = s.addNode('rect', { x: 10, y: 0, w: 40, h: 30 });
  const b = s.addNode('rect', { x: 10, y: 90, w: 40, h: 60 });
  const c = s.addNode('rect', { x: 10, y: 260, w: 40, h: 30 });
  s.select([a.id, b.id, c.id]);
  s.align('distribute-v');
  const sorted = [a, b, c].sort((m, n) => m.y - n.y);
  const gap1 = sorted[1].y - (sorted[0].y + sorted[0].h);
  const gap2 = sorted[2].y - (sorted[1].y + sorted[1].h);
  assert(Math.abs(gap1 - gap2) <= 1, '间隙不等：' + gap1 + ' vs ' + gap2);
  return 'gap≈' + gap1;
});

await check('单个元素做分布不报错也不动', () => {
  const s = makeStore();
  const a = s.addNode('rect', { x: 50, y: 50, w: 40, h: 40 });
  s.select([a.id]);
  const n = s.align('distribute-h');
  assert(n === 1, '返回值=' + n);
  assert(a.x === 50, '位置被改了：' + a.x);
  return 'ok';
});

/* ================= 面板 ================= */
function renderWithSelection(count) {
  const s = makeStore();
  const ids = [];
  for (let i = 0; i < count; i += 1) {
    ids.push(s.addNode('rect', { x: i * 60, y: 10, w: 50, h: 50, bg: '#1677ff' }).id);
  }
  s.select(ids);
  const box = document.getElementById('inspectorBox');
  renderInspector(box, s, {
    update() {}, toast() {}, align() {},
    bringForward() {}, sendBackward() {}, bringToFront() {}, sendToBack() {}
  });
  return box;
}

await check('多选时出现「批量编辑」组', () => {
  const box = renderWithSelection(3);
  const titles = Array.from(box.querySelectorAll('.group-head')).map((x) => x.textContent.trim());
  const hit = titles.filter((t) => t.indexOf('批量编辑') >= 0);
  assert(hit.length === 1, '批量编辑组数=' + hit.length + '（标题：' + titles.join(' / ') + '）');
  assert(hit[0].indexOf('3') >= 0, '标题里没带数量：' + hit[0]);
  return hit[0];
});

await check('单选时不显示批量编辑组', () => {
  const box = renderWithSelection(1);
  const titles = Array.from(box.querySelectorAll('.group-head')).map((x) => x.textContent.trim());
  assert(titles.filter((t) => t.indexOf('批量编辑') >= 0).length === 0, '单选却出现了批量组');
  return 'ok';
});

await check('排列组包含六向对齐与两种分布', () => {
  const box = renderWithSelection(2);
  const text = box.textContent;
  ['左对齐', '水平居中', '右对齐', '顶对齐', '垂直居中', '底对齐', '水平等间距', '垂直等间距'].forEach((label) => {
    assert(text.indexOf(label) >= 0, '缺按钮：' + label);
  });
  return '8 个按钮都在';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
