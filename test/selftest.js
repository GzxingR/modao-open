/**
 * 无浏览器框架的自测：核心数据与渲染函数。
 * 结果写进 <pre id="out">，可用 chrome --headless --dump-dom 读取。
 */

import { Store } from '../src/store.js';
import { createNode, COMPONENTS, getDevice, createProject, normalizeProject } from '../src/model.js';
import { createNodeEl, renderPage } from '../src/nodes.js';
import { buildSpecText } from '../src/io.js';

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push('PASS  ' + name + (detail ? '  (' + detail + ')' : ''));
  } catch (e) {
    results.push('FAIL  ' + name + '  -> ' + (e && e.message ? e.message : String(e)));
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const device = getDevice('iphone17');
const dev14 = getDevice('iphone14');

/* ---------- model ---------- */
check('createNode 默认值', () => {
  const n = createNode('button', device);
  assert(n.type === 'button');
  assert(n.h === 44, 'h');
  assert(n.bg === '#1677ff', 'bg');
  assert(n.radius === 8, 'radius');
  return n.w + 'x' + n.h;
});

check('全部组件都能创建', () => {
  for (const c of COMPONENTS) {
    const n = createNode(c.type, device);
    assert(n && n.id, c.type + ' 没有 id');
    assert(typeof n.w === 'number' && n.w >= 0, c.type + ' w 非法');
  }
  return COMPONENTS.length + ' 类';
});

check('全部组件都能渲染 DOM', () => {
  for (const c of COMPONENTS) {
    const n = createNode(c.type, device);
    const el = createNodeEl(n, { interactive: false });
    assert(el instanceof HTMLElement, c.type + ' 没返回元素');
    assert(el.style.position === 'absolute', c.type + ' 不是绝对定位');
  }
  return COMPONENTS.length + ' 类';
});

/* ---------- store ---------- */
check('添加节点 + 撤销 + 重做', () => {
  const s = new Store();
  s.state.project = createProject('t');
  const before = s.page.nodes.length;
  s.addNode('text');
  assert(s.page.nodes.length === before + 1, 'add');
  s.undo();
  assert(s.page.nodes.length === before, 'undo');
  s.redo();
  assert(s.page.nodes.length === before + 1, 'redo');
  return 'nodes=' + s.page.nodes.length;
});

check('删除节点', () => {
  const s = new Store();
  s.state.project = createProject('t');
  s.addNode('text');
  s.addNode('rect');
  s.select([s.page.nodes[0].id]);
  s.deleteSelected();
  assert(s.page.nodes.length === 1, '剩余数量不对：' + s.page.nodes.length);
  return 'ok';
});

check('复制节点', () => {
  const s = new Store();
  s.state.project = createProject('t');
  s.addNode('button');
  s.select([s.page.nodes[0].id]);
  s.duplicateSelected();
  assert(s.page.nodes.length === 2, '副本没生成');
  assert(s.page.nodes[0].id !== s.page.nodes[1].id, 'id 重复');
  assert(s.page.nodes[1].x === s.page.nodes[0].x + 16, '偏移不对');
  return 'ok';
});

check('水平居中 / 对齐', () => {
  const s = new Store();
  s.state.project = createProject('t');
  const n = s.addNode('button');
  s.select([n.id]);
  s.align('hcenter');
  const expect = Math.round((device.w - n.w) / 2);
  assert(n.x === expect, 'x=' + n.x + ' 期望 ' + expect);
  return 'ok';
});

check('页面增删保护', () => {
  const s = new Store();
  s.state.project = createProject('t');
  s.addPage('第二页');
  assert(s.project.pages.length === 2, 'addPage');
  s.setActivePage(s.project.pages[1].id);
  s.deletePage(s.project.pages[1].id);
  assert(s.project.pages.length === 1, 'deletePage');
  const r = s.deletePage(s.project.pages[0].id);
  assert(r === false, '最后一个页面不该被删');
  return 'ok';
});

check('序列化往返', () => {
  const s = new Store();
  s.state.project = createProject('往返');
  s.addNode('button');
  s.addNode('navbar');
  const json = JSON.stringify(s.project);
  const back = normalizeProject(JSON.parse(json));
  assert(back.pages.length === 1, 'pages');
  assert(back.pages[0].nodes.length === 2, 'nodes');
  assert(back.name === '往返', 'name');
  return 'ok';
});

check('坏数据被拒绝', () => {
  let threw = false;
  try { normalizeProject({ nope: 1 }); } catch (e) { threw = true; }
  assert(threw, '没有拒绝非法项目');
  return 'ok';
});

/* ---------- 渲染 ---------- */
check('整页渲染尺寸正确', () => {
  const p = createProject('r').pages[0];
  p.deviceId = 'iphone14';
  p.nodes.push(createNode('button', dev14));
  const host = renderPage(p, { device: dev14 });
  assert(host.style.width === '390px', 'w=' + host.style.width);
  assert(host.style.height === '844px', 'h=' + host.style.height);
  assert(host.children.length === 1, 'children');
  return 'ok';
});

/* ---------- 规格清单 ---------- */
check('规格文本包含关键信息', () => {
  const p = createProject('spec').pages[0];
  p.nodes.push(createNode('button', device, { text: '登录', x: 41, y: 300 }));
  const text = buildSpecText(p, 'spec');
  assert(text.indexOf('iPhone 17') >= 0, '缺设备');
  assert(text.indexOf('登录') >= 0, '缺文案');
  assert(text.indexOf('圆角') >= 0, '缺圆角');
  return text.split('\n').length + ' 行';
});

/* ---------- 交互连线数据 ---------- */
check('交互 link 结构可序列化', () => {
  const s = new Store();
  s.state.project = createProject('l');
  const a = s.addNode('button');
  const b = s.addNode('rect');
  s.updateNode(a.id, { link: { action: 'toggle', targetNodeId: b.id } });
  const json = JSON.stringify(s.project);
  assert(json.indexOf('targetNodeId') >= 0, 'link 没写进 JSON');
  return 'ok';
});

/* ---------- 输出 ---------- */
const out = document.getElementById('out');
const summary = results.filter((r) => r.indexOf('PASS') === 0).length + '/' + results.length;
out.textContent = 'RESULT ' + summary + '\n' + results.join('\n');
