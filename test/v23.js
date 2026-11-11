/**
 * v2.3 自测：真动态组件（分组每个状态一套子元素）
 */

import { Store } from '../src/store.js';
import { createProject, createNode, getDevice, currentGroupChildren, currentState } from '../src/model.js';
import { createNodeEl } from '../src/nodes.js';
import { createPreviewRuntime } from '../src/links.js';
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

/** 建一个含两个子元素的分组 */
function makeGroup() {
  const s = new Store();
  s.state.project = createProject('dyn');
  const a = s.addNode('text', { x: 20, y: 20, w: 100, h: 24, text: 'A文字' });
  const b = s.addNode('rect', { x: 20, y: 60, w: 100, h: 40, bg: '#1677ff' });
  s.select([a.id, b.id]);
  const g = s.groupSelected();
  return { s, g, a, b };
}

/* ================= 数据层 ================= */
await check('添加状态会快照当前子元素', () => {
  const { s, g } = makeGroup();
  assert(!g.states, '初始不该有状态');
  const st = s.addGroupState(g.id, '未登录');
  assert(g.states && g.states.length === 1, '状态数=' + (g.states && g.states.length));
  assert(Array.isArray(st.children), '状态里没有 children');
  assert(st.children.length === g.children.length, '快照数量=' + st.children.length);
  assert(g.activeStateId === st.id, '没设为当前');
  return st.children.length + ' 个子元素';
});

await check('快照是深拷贝，改原组不影响状态', () => {
  const { s, g } = makeGroup();
  const st = s.addGroupState(g.id, 'S1');
  const before = st.children[0].text;
  g.children[0].text = '改过了';
  assert(st.children[0].text === before, '快照被连带改了');
  return 'ok';
});

await check('currentGroupChildren 按当前状态取', () => {
  const { s, g } = makeGroup();
  const st = s.addGroupState(g.id, 'S1');
  // 造一个不同内容的状态
  st.children = [createNode('text', device, { x: 0, y: 0, w: 100, h: 20, text: '状态内文字' })];
  const kids = currentGroupChildren(g);
  assert(kids.length === 1, '子元素数=' + kids.length);
  assert(currentState(g).id === st.id, '当前状态不对');
  return '1 个';
});

/* ================= 渲染 ================= */
await check('渲染使用当前状态的子元素', () => {
  const { s, g } = makeGroup();
  const st1 = s.addGroupState(g.id, 'S1');
  st1.children = [createNode('text', device, { x: 0, y: 0, w: 120, h: 20, text: '登录态文字' })];

  const st2 = s.addGroupState(g.id, 'S2');
  st2.children = [createNode('text', device, { x: 0, y: 0, w: 120, h: 20, text: '未登录文字' })];

  s.setGroupState(g.id, st2.id);
  const el = createNodeEl(g, { interactive: true });
  assert(el.textContent.indexOf('未登录文字') >= 0, '没渲染 S2 内容：' + el.textContent);
  assert(el.textContent.indexOf('登录态文字') < 0, '渲染到了 S1 内容');

  s.setGroupState(g.id, st1.id);
  const el2 = createNodeEl(g, { interactive: true });
  assert(el2.textContent.indexOf('登录态文字') >= 0, '切换后没渲染 S1');
  return 'S1/S2 切换正常';
});

await check('没有状态时回退到组自己的 children', () => {
  const { g } = makeGroup();
  const kids = currentGroupChildren(g);
  assert(kids === g.children, '没回退到 node.children');
  const el = createNodeEl(g, { interactive: true });
  assert(el.children.length === 2, '渲染子元素数=' + el.children.length);
  return '回退 ok';
});

/* ================= 增删改 ================= */
await check('用选中元素替换状态内容（坐标转相对）', () => {
  const { s, g } = makeGroup();
  const st = s.addGroupState(g.id, 'S1');
  const extra1 = s.addNode('text', { x: g.x + 30, y: g.y + 20, w: 100, h: 20, text: '新元素1' });
  const extra2 = s.addNode('rect', { x: g.x + 30, y: g.y + 60, w: 100, h: 40 });

  s.select([extra1.id, extra2.id]);
  const n = s.replaceGroupStateFromSelection(g.id, st.id);
  assert(n === 2, '替换数量=' + n);
  assert(st.children.length === 2, '状态里子元素数=' + st.children.length);
  assert(st.children[0].x === 30 && st.children[0].y === 20, '坐标没转相对：' + st.children[0].x + ',' + st.children[0].y);
  assert(st.children[0].text === '新元素1', '内容不对');
  return '2 个元素，相对坐标 30,20';
});

await check('captureGroupChildren 更新快照', () => {
  const { s, g } = makeGroup();
  const st = s.addGroupState(g.id, 'S1');
  st.children = [];
  g.children = [createNode('text', device, { x: 0, y: 0, w: 100, h: 20, text: '新内容' })];
  s.captureGroupChildren(g.id, st.id);
  assert(st.children.length === 1, '没更新：' + st.children.length);
  assert(st.children[0].text === '新内容', '内容不对');
  return 'ok';
});

await check('删除状态后回退到组自己的 children', () => {
  const { s, g } = makeGroup();
  const st = s.addGroupState(g.id, 'S1');
  s.removeGroupState(g.id, st.id);
  assert(g.states === null, 'states 没清空');
  assert(g.activeStateId === null, 'activeStateId 没清空');
  const el = createNodeEl(g, { interactive: true });
  assert(el.children.length === 2, '渲染回退失败');
  return 'ok';
});

/* ================= 预览 ================= */
await check('预览里切换分组状态会换掉子元素', () => {
  const { s, g } = makeGroup();
  const st1 = s.addGroupState(g.id, 'S1');
  st1.children = [createNode('text', device, { x: 0, y: 0, w: 120, h: 20, text: '登录态' })];
  const st2 = s.addGroupState(g.id, 'S2');
  st2.children = [createNode('text', device, { x: 0, y: 0, w: 120, h: 20, text: '未登录态' })];

  const btn = s.addNode('button', { x: 20, y: 300, w: 140, h: 40, text: '切换' });
  s.updateNode(btn.id, {
    link: { action: 'state', trigger: 'click', targetNodeId: g.id, targetStateId: st2.id }
  });
  s.setGroupState(g.id, st1.id);

  const project = JSON.parse(JSON.stringify(s.project));
  for (const p of project.pages) p.device = getDevice(p.deviceId);
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const rt = createPreviewRuntime(project, project.pages[0].id, mount);
  rt.start();

  const gEl = mount.querySelector('[data-id="' + g.id + '"]');
  assert(gEl.textContent.indexOf('登录态') >= 0, '初始状态不对：' + gEl.textContent);

  mount.querySelector('[data-id="' + btn.id + '"]').click();
  const gEl2 = mount.querySelector('[data-id="' + g.id + '"]');
  assert(gEl2.textContent.indexOf('未登录态') >= 0, '切换后内容不对：' + gEl2.textContent);
  mount.remove();
  return '登录态 → 未登录态';
});

/* ================= 导出 ================= */
await check('演示 HTML 每个状态都写进快照', () => {
  const { s, g } = makeGroup();
  const st1 = s.addGroupState(g.id, 'S1');
  st1.children = [createNode('text', device, { x: 0, y: 0, w: 120, h: 20, text: '状态一内容' })];
  const st2 = s.addGroupState(g.id, 'S2');
  st2.children = [createNode('text', device, { x: 0, y: 0, w: 120, h: 20, text: '状态二内容' })];

  const html = buildStandaloneHtml(s.project);
  assert(html.indexOf('状态一内容') >= 0, '缺 S1 内容');
  assert(html.indexOf('状态二内容') >= 0, '缺 S2 内容');
  assert(html.indexOf('"states"') >= 0, '缺 states');
  return Math.round(html.length / 1024) + ' KB';
});

await check('普通组件仍走外观变体（回归）', () => {
  const s = new Store();
  s.state.project = createProject('reg');
  const n = s.addNode('button', { bg: '#1677ff' });
  const st = s.addState(n.id, '按下');
  n.bg = '#000000';
  s.captureStateStyle(n.id, st.id, ['bg', 'text', 'color', 'radius', 'fontSize', 'fontWeight', 'borderColor', 'borderWidth', 'align', 'opacity', 'icon', 'checked', 'on', 'activeIndex']);
  s.setActiveState(n.id, st.id);
  const el = createNodeEl(n, { interactive: true });
  assert(el.style.background.indexOf('0, 0, 0') >= 0, '外观变体失效：' + el.style.background);
  return 'ok';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
