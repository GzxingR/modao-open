/**
 * v1.3 自测：更多触发器（双击/长按/滑动手势/移入移出/载入时）+ 滚动到 + 打开链接
 */

import { Store } from '../src/store.js';
import { createProject, getDevice, TRIGGERS, ACTIONS } from '../src/model.js';
import { createPreviewRuntime, renderLinks } from '../src/links.js';
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 建一个两页项目，第一页放一个带 link 的按钮 */
function makeProject(linkFactory) {
  const s = new Store();
  s.state.project = createProject('trig');
  const btn = s.addNode('button', { x: 20, y: 20, w: 200, h: 44, text: '触发' });
  s.addPage('第二页');
  s.setActivePage(s.project.pages[0].id);
  const target = s.project.pages[1];
  const link = linkFactory(btn, target, s);
  if (link) s.updateNode(btn.id, { link });
  return { store: s, btn, target };
}

function boot(store, mount) {
  const project = JSON.parse(JSON.stringify(store.project));
  for (const p of project.pages) p.device = getDevice(p.deviceId);
  const rt = createPreviewRuntime(project, project.pages[0].id, mount);
  rt.start();
  return rt;
}

/* ================= 常量表 ================= */
await check('触发器与行为表完整', () => {
  assert(TRIGGERS.length === 16, 'TRIGGERS=' + TRIGGERS.length);
  assert(ACTIONS.length === 11, 'ACTIONS=' + ACTIONS.length);
  const names = TRIGGERS.map((t) => t.value).join(',');
  assert(names.indexOf('longpress') >= 0 && names.indexOf('swipeLeft') >= 0 && names.indexOf('load') >= 0, names);
  return TRIGGERS.length + ' 触发 / ' + ACTIONS.length + ' 行为';
});

/* ================= 双击 ================= */
await check('双击跳转页面', async () => {
  const { store, btn, target } = makeProject((b, t) => ({ action: 'navigate', trigger: 'dblclick', targetPageId: t.id }));
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const rt = boot(store, mount);
  const el = mount.querySelector('[data-id="' + btn.id + '"]');
  el.click();                       // 单击不该触发
  assert(rt.currentPage().id !== target.id, '单击误触发了');
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  assert(rt.currentPage().id === target.id, '双击没跳转');
  mount.remove();
  return 'ok';
});

/* ================= 长按 ================= */
await check('长按 500ms 才触发', async () => {
  const { store, btn, target } = makeProject((b, t) => ({ action: 'navigate', trigger: 'longpress', targetPageId: t.id }));
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const rt = boot(store, mount);
  const el = mount.querySelector('[data-id="' + btn.id + '"]');

  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 30, clientY: 30, pointerId: 1 }));
  await sleep(120);
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 30, clientY: 30, pointerId: 1 }));
  assert(rt.currentPage().id !== target.id, '短按误触发了');

  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 30, clientY: 30, pointerId: 2 }));
  await sleep(650);
  assert(rt.currentPage().id === target.id, '长按没触发');
  mount.remove();
  return 'ok';
});

/* ================= 滑动手势 ================= */
await check('右滑触发、上滑不触发', async () => {
  const { store, btn, target } = makeProject((b, t) => ({ action: 'navigate', trigger: 'swipeRight', targetPageId: t.id }));
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const rt = boot(store, mount);
  const el = mount.querySelector('[data-id="' + btn.id + '"]');

  // 上滑（dy 大）→ 不该触发
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 200, pointerId: 3 }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 50, clientY: 100, pointerId: 3 }));
  assert(rt.currentPage().id !== target.id, '上滑误触发');

  // 右滑（dx 大）→ 触发
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 40, pointerId: 4 }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 160, clientY: 45, pointerId: 4 }));
  assert(rt.currentPage().id === target.id, '右滑没触发');
  mount.remove();
  return 'ok';
});

/* ================= 移入移出 ================= */
await check('鼠标移入触发显示', async () => {
  const s = new Store();
  s.state.project = createProject('hover');
  const tip = s.addNode('text', { x: 20, y: 300, w: 200, h: 30, text: '提示文字' });
  s.updateNode(tip.id, { hidden: false });
  const hot = s.addNode('button', { x: 20, y: 100, w: 200, h: 44, text: '悬停我' });
  s.updateNode(hot.id, { link: { action: 'hide', trigger: 'mouseenter', targetNodeId: tip.id } });

  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const rt = boot(s, mount);
  const hotEl = mount.querySelector('[data-id="' + hot.id + '"]');
  const tipEl = mount.querySelector('[data-id="' + tip.id + '"]');
  assert(tipEl.style.display !== 'none', '初始不该隐藏');
  hotEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
  assert(tipEl.style.display === 'none', '移入后没隐藏');
  mount.remove();
  return 'ok';
});

/* ================= 载入时 ================= */
await check('载入时自动触发', async () => {
  const s = new Store();
  s.state.project = createProject('load');
  const rect = s.addNode('rect', { x: 20, y: 20, w: 100, h: 60 });
  s.addPage('第二页');
  s.setActivePage(s.project.pages[0].id);
  const targetPage = s.project.pages[1];
  // 一个隐藏的触发器挂在页面里，载入时跳页
  const trigger = s.addNode('text', { x: 0, y: 0, w: 10, h: 10, text: '' });
  s.updateNode(trigger.id, {
    hidden: true,
    link: { action: 'navigate', trigger: 'load', targetPageId: targetPage.id }
  });

  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const rt = boot(s, mount);
  // 隐藏节点不参与渲染，改为不隐藏来测
  mount.textContent = '';
  const project = JSON.parse(JSON.stringify(s.project));
  project.pages[0].nodes.forEach((n) => { delete n.hidden; });
  for (const p of project.pages) p.device = getDevice(p.deviceId);
  const rt2 = createPreviewRuntime(project, project.pages[0].id, mount);
  rt2.start();
  await sleep(200);
  assert(rt2.currentPage().id === targetPage.id, '载入时没跳转，当前=' + rt2.currentPage().name);
  mount.remove();
  void rt;
  void rect;
  return 'ok';
});

/* ================= 打开链接 ================= */
await check('打开链接调用 window.open', async () => {
  const { store, btn } = makeProject((b) => ({ action: 'url', trigger: 'click', url: 'https://example.com/x' }));
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const rt = boot(store, mount);
  const el = mount.querySelector('[data-id="' + btn.id + '"]');

  const original = window.open;
  let opened = null;
  window.open = (url) => { opened = url; return null; };
  try {
    el.click();
    assert(opened === 'https://example.com/x', 'open 参数=' + opened);
  } finally {
    window.open = original;
  }
  mount.remove();
  void rt;
  return opened;
});

/* ================= 滚动到 ================= */
await check('滚动到调用 scrollIntoView', async () => {
  const s = new Store();
  s.state.project = createProject('scroll');
  const target = s.addNode('rect', { x: 20, y: 600, w: 200, h: 100 });
  const btn = s.addNode('button', { x: 20, y: 100, w: 200, h: 44, text: '滚下去' });
  s.updateNode(btn.id, { link: { action: 'scrollTo', trigger: 'click', targetNodeId: target.id } });

  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const rt = boot(s, mount);
  const tEl = mount.querySelector('[data-id="' + target.id + '"]');
  let called = 0;
  tEl.scrollIntoView = () => { called += 1; };
  mount.querySelector('[data-id="' + btn.id + '"]').click();
  assert(called === 1, 'scrollIntoView 调用次数=' + called);
  mount.remove();
  void rt;
  return 'ok';
});

/* ================= 连线标签 ================= */
await check('连线标签带触发方式', () => {
  const { store } = makeProject((b, t) => ({ action: 'navigate', trigger: 'longpress', targetPageId: t.id }));
  const layer = document.createElement('div');
  store.state.showLinks = true;
  renderLinks(layer, store);
  const text = layer.textContent;
  assert(text.indexOf('长按') >= 0, '标签没有触发方式：' + text);
  assert(text.indexOf('第二页') >= 0, '标签没有目标页');
  return text.trim();
});

/* ================= 演示 HTML ================= */
await check('演示 HTML 写入触发器与链接', () => {
  const { store } = makeProject((b) => ({ action: 'url', trigger: 'dblclick', url: 'https://example.com/y' }));
  const html = buildStandaloneHtml(store.project);
  assert(html.indexOf('data-t') >= 0, '没有 data-t');
  assert(html.indexOf('dblclick') >= 0, '没有触发器值');
  assert(html.indexOf('https://example.com/y') >= 0, '没有链接地址');
  assert(html.indexOf('swipe') >= 0, '运行时里没有手势逻辑');
  return Math.round(html.length / 1024) + ' KB';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
