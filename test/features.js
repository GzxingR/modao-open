/**
 * 新功能自测：组件状态（动态组件）、剪贴板、离线演示 HTML、预览运行时。
 */

import { Store } from '../src/store.js';
import { createProject, createNode, getDevice, viewOf, STATE_STYLE_KEYS } from '../src/model.js';
import { createNodeEl } from '../src/nodes.js';
import { buildStandaloneHtml } from '../src/exportHtml.js';
import { createPreviewRuntime } from '../src/links.js';

const results = [];
function check(name, fn) {
  try {
    const d = fn();
    results.push('PASS  ' + name + (d ? '  (' + d + ')' : ''));
  } catch (e) {
    results.push('FAIL  ' + name + '  -> ' + (e && e.message ? e.message : e));
  }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }

const device = getDevice('iphone17');

/* ================= 组件状态 ================= */
check('添加状态并自动设为当前', () => {
  const s = new Store();
  s.state.project = createProject('st');
  const n = s.addNode('button');
  const st = s.addState(n.id, '选中态');
  assert(n.states && n.states.length === 1, 'states=' + (n.states && n.states.length));
  assert(n.activeStateId === st.id, '没有设为当前');
  return st.name;
});

check('把当前外观存进状态后 viewOf 生效', () => {
  const s = new Store();
  s.state.project = createProject('st');
  const n = s.addNode('button', { bg: '#1677ff', text: '登录' });
  const st = s.addState(n.id, '按下态');
  n.bg = '#0b5cd5';
  n.text = '登录中';
  s.captureStateStyle(n.id, st.id, STATE_STYLE_KEYS);
  const view = viewOf(n);
  assert(view.bg === '#0b5cd5', 'view.bg=' + view.bg);
  assert(view.text === '登录中', 'view.text=' + view.text);
  assert(n.bg === '#0b5cd5', '原对象被意外改动');
  return view.bg + '/' + view.text;
});

check('切换状态改变渲染外观', () => {
  const s = new Store();
  s.state.project = createProject('st');
  const n = s.addNode('button', { bg: '#1677ff' });
  const a = s.addState(n.id, 'A');
  n.bg = '#ff0000';
  s.captureStateStyle(n.id, a.id, STATE_STYLE_KEYS);
  const b = s.addState(n.id, 'B');
  n.bg = '#00ff00';
  s.captureStateStyle(n.id, b.id, STATE_STYLE_KEYS);

  s.setActiveState(n.id, a.id);
  const elA = createNodeEl(n, { interactive: true });
  assert(elA.style.background.indexOf('255, 0, 0') >= 0 || elA.style.background === 'rgb(255, 0, 0)',
    'A 背景=' + elA.style.background);

  s.setActiveState(n.id, b.id);
  const elB = createNodeEl(n, { interactive: true });
  assert(elB.style.background.indexOf('0, 255, 0') >= 0 || elB.style.background === 'rgb(0, 255, 0)',
    'B 背景=' + elB.style.background);
  return 'A=' + elA.style.background + ' / B=' + elB.style.background;
});

check('删掉最后一个状态后回到普通组件', () => {
  const s = new Store();
  s.state.project = createProject('st');
  const n = s.addNode('button');
  const st = s.addState(n.id);
  s.removeState(n.id, st.id);
  assert(n.states === null, 'states 没清空：' + JSON.stringify(n.states));
  assert(n.activeStateId === null, 'activeStateId 没清空');
  return 'ok';
});

/* ================= 剪贴板 ================= */
check('复制粘贴产生偏移副本', () => {
  const s = new Store();
  s.state.project = createProject('cb');
  const n = s.addNode('rect', { x: 40, y: 60 });
  s.select([n.id]);
  const copied = s.copySelected();
  assert(copied === 1, '复制数量=' + copied);
  const pasted = s.pasteClipboard();
  assert(pasted === 1, '粘贴数量=' + pasted);
  assert(s.page.nodes.length === 2, '节点数=' + s.page.nodes.length);
  const p = s.page.nodes[1];
  assert(p.id !== n.id, 'id 重复');
  assert(p.x === 56 && p.y === 76, '偏移=' + p.x + ',' + p.y);
  return 'Δ=16,16';
});

check('连续粘贴逐次错开', () => {
  const s = new Store();
  s.state.project = createProject('cb2');
  const n = s.addNode('rect', { x: 0, y: 0 });
  s.select([n.id]);
  s.copySelected();
  s.pasteClipboard();
  s.pasteClipboard();
  const xs = s.page.nodes.map((x) => x.x);
  assert(s.page.nodes.length === 3, '节点数=' + s.page.nodes.length);
  assert(xs[2] === xs[1] + 16, '第二次粘贴没继续偏移：' + xs.join(','));
  return xs.join(',');
});

/* ================= 离线演示 HTML ================= */
check('演示 HTML 结构完整', () => {
  const s = new Store();
  s.state.project = createProject('demo');
  const btn = s.addNode('button', { text: '去第二页' });
  s.addPage('第二页');
  s.setActivePage(s.project.pages[0].id);
  s.updateNode(btn.id, { link: { action: 'navigate', targetPageId: s.project.pages[1].id } });

  const html = buildStandaloneHtml(s.project);
  assert(html.indexOf('<!DOCTYPE html>') === 0, '不是完整 HTML');
  assert(html.indexOf('__PROTO__') > 0, '缺数据');
  assert(html.indexOf('data-la') > 0, '缺交互标记');
  assert(html.indexOf('去第二页') > 0, '缺文案');
  return Math.round(html.length / 1024) + ' KB';
});

check('演示 HTML 含组件状态快照', () => {
  const s = new Store();
  s.state.project = createProject('demo2');
  const n = s.addNode('button', { bg: '#1677ff' });
  const a = s.addState(n.id, '常态');
  s.captureStateStyle(n.id, a.id, STATE_STYLE_KEYS);
  const b = s.addState(n.id, '按下');
  n.bg = '#000000';
  s.captureStateStyle(n.id, b.id, STATE_STYLE_KEYS);

  const html = buildStandaloneHtml(s.project);
  assert(html.indexOf('"states"') > 0, '没写 states');
  assert(html.indexOf('rgb(0, 0, 0)') > 0 || html.indexOf('#000000') > 0, '状态外观没进快照');
  return 'ok';
});

check('演示 HTML 可被浏览器解析', () => {
  const s = new Store();
  s.state.project = createProject('demo3');
  s.addNode('navbar', { text: '首页' });
  s.addNode('tabbar', { tabs: ['一', '二', '三'] });
  const html = buildStandaloneHtml(s.project);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  assert(doc.getElementById('stage'), '没有 stage');
  assert(doc.querySelector('script'), '没有脚本');
  assert(doc.title.indexOf('原型演示') >= 0, 'title=' + doc.title);
  return 'ok';
});

/* ================= 预览运行时 ================= */
check('预览里点击可切换组件状态', () => {
  const s = new Store();
  s.state.project = createProject('pv');
  const rect = s.addNode('rect', { x: 20, y: 100, w: 100, h: 60, bg: '#1677ff' });
  const a = s.addState(rect.id, '蓝');
  s.captureStateStyle(rect.id, a.id, STATE_STYLE_KEYS);
  const b = s.addState(rect.id, '红');
  rect.bg = '#ff0000';
  s.captureStateStyle(rect.id, b.id, STATE_STYLE_KEYS);
  s.setActiveState(rect.id, a.id);

  const btn = s.addNode('button', { x: 20, y: 300, w: 100, h: 44, text: '切' });
  s.updateNode(btn.id, { link: { action: 'state', targetNodeId: rect.id, targetStateId: b.id } });

  const project = JSON.parse(JSON.stringify(s.project));
  for (const p of project.pages) p.device = getDevice(p.deviceId);

  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const rt = createPreviewRuntime(project, project.pages[0].id, mount);
  rt.start();

  const before = mount.querySelector('[data-id="' + rect.id + '"]');
  assert(before, '预览里没渲染出 rect');
  assert(before.style.background.indexOf('22, 119, 255') >= 0, '初始不是蓝色：' + before.style.background);

  const btnEl = mount.querySelector('[data-id="' + btn.id + '"]');
  assert(btnEl, '预览里没渲染出按钮');
  btnEl.click();

  const after = mount.querySelector('[data-id="' + rect.id + '"]');
  assert(after.style.background.indexOf('255, 0, 0') >= 0, '点击后不是红色：' + after.style.background);
  mount.remove();
  return before.style.background + ' → ' + after.style.background;
});

check('预览里点击可跳转页面', () => {
  const s = new Store();
  s.state.project = createProject('pv2');
  const btn = s.addNode('button', { text: '去下一页' });
  s.addPage('第二页');
  s.setActivePage(s.project.pages[0].id);
  const targetPage = s.project.pages[1];
  s.updateNode(btn.id, { link: { action: 'navigate', targetPageId: targetPage.id } });

  const project = JSON.parse(JSON.stringify(s.project));
  for (const p of project.pages) p.device = getDevice(p.deviceId);

  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const rt = createPreviewRuntime(project, project.pages[0].id, mount);
  rt.start();
  const btnEl = mount.querySelector('[data-id="' + btn.id + '"]');
  btnEl.click();
  assert(rt.currentPage().id === targetPage.id, '没跳转，当前=' + rt.currentPage().name);
  mount.remove();
  return rt.currentPage().name;
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
