/**
 * v3.1 自测：页面模板库
 */

import { Store } from '../src/store.js';
import { createProject, getDevice } from '../src/model.js';
import { TEMPLATES, buildTemplate } from '../src/templates.js';

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

const DEVICES = ['iphone17', 'iphone14', 'ipad'];
const VALID_TYPES = ['text', 'rect', 'circle', 'line', 'image', 'button', 'input', 'textarea', 'checkbox', 'switch', 'icon', 'badge', 'card', 'listitem', 'navbar', 'tabbar'];

/* ================= 模板目录 ================= */
await check('模板目录完整（8 个，字段齐全）', () => {
  assert(TEMPLATES.length === 8, '模板数=' + TEMPLATES.length);
  for (const t of TEMPLATES) {
    assert(t.id && t.name && t.desc, '字段缺失：' + JSON.stringify(t).slice(0, 60));
    assert(typeof t.build === 'function', t.id + ' 没有 build');
  }
  const ids = TEMPLATES.map((t) => t.id);
  assert(new Set(ids).size === ids.length, 'id 有重复');
  return TEMPLATES.map((t) => t.name).join(' / ');
});

await check('每个模板都能生成至少 3 个元素', () => {
  const dev = getDevice('iphone17');
  const counts = [];
  for (const t of TEMPLATES) {
    const nodes = buildTemplate(t.id, dev);
    assert(Array.isArray(nodes) && nodes.length >= 3, t.id + ' 只生成了 ' + (nodes && nodes.length));
    counts.push(t.id + ':' + nodes.length);
  }
  return counts.join(' ');
});

await check('生成的元素类型都合法且有唯一 id', () => {
  const dev = getDevice('iphone17');
  for (const t of TEMPLATES) {
    const nodes = buildTemplate(t.id, dev);
    const ids = new Set();
    for (const n of nodes) {
      assert(VALID_TYPES.indexOf(n.type) >= 0, t.id + ' 里出现未知类型：' + n.type);
      assert(n.id, t.id + ' 有元素没有 id');
      assert(!ids.has(n.id), t.id + ' 里 id 重复：' + n.id);
      ids.add(n.id);
    }
  }
  return '全部合法';
});

await check('三种设备下元素都不越界', () => {
  const report = [];
  for (const devId of DEVICES) {
    const dev = getDevice(devId);
    for (const t of TEMPLATES) {
      const nodes = buildTemplate(t.id, dev);
      for (const n of nodes) {
        assert(n.x >= -1, devId + '/' + t.id + ' x 越界：' + n.x);
        assert(n.y >= -1, devId + '/' + t.id + ' y 越界：' + n.y);
        assert(n.x + n.w <= dev.w + 1, devId + '/' + t.id + ' 右边越界：' + (n.x + n.w) + ' > ' + dev.w);
        assert(n.y + n.h <= dev.h + 1, devId + '/' + t.id + ' 下边越界：' + (n.y + n.h) + ' > ' + dev.h);
      }
    }
    report.push(devId + ' ✓');
  }
  return report.join(' / ');
});

await check('未知模板 id 返回空数组', () => {
  const nodes = buildTemplate('不存在的模板', getDevice('iphone17'));
  assert(Array.isArray(nodes) && nodes.length === 0, '应返回空数组');
  return 'ok';
});

/* ================= 插入到项目 ================= */
await check('插入模板：新建页面 + 元素到位', () => {
  const s = new Store();
  s.state.project = createProject('tpl');
  const before = s.project.pages.length;

  s.addPage('登录页');
  const nodes = buildTemplate('login', s.device);
  const n = s.appendNodes(nodes);

  assert(s.project.pages.length === before + 1, '页面数=' + s.project.pages.length);
  assert(n === nodes.length, 'appendNodes 返回=' + n);
  assert(s.page.nodes.length === nodes.length, '当前页元素数=' + s.page.nodes.length);
  assert(s.page.name === '登录页', '当前页不对：' + s.page.name);
  assert(s.state.selection.length === 0, '插入后不该有选中');
  return n + ' 个元素';
});

await check('插入模板可一次撤销', () => {
  const s = new Store();
  s.state.project = createProject('tpl2');
  s.addPage('空页');
  const beforeCount = s.page.nodes.length;
  s.appendNodes(buildTemplate('list', s.device));
  assert(s.page.nodes.length > beforeCount, '没插进去');
  s.undo();
  assert(s.page.nodes.length === beforeCount, '撤销后数量=' + s.page.nodes.length);
  return 'ok';
});

await check('模板元素能渲染成 DOM', async () => {
  const { renderPage } = await import('../src/nodes.js');
  const s = new Store();
  s.state.project = createProject('tpl3');
  s.addPage('模板页');
  s.appendNodes(buildTemplate('profile', s.device));
  const host = renderPage(s.page, { device: s.device });
  assert(host.children.length === s.page.nodes.length, 'DOM 数=' + host.children.length);
  assert(host.textContent.indexOf('我的订单') >= 0, '内容没渲染出来');
  return host.children.length + ' 个 DOM 元素';
});

await check('模板面板卡片能渲染（DOM 结构）', () => {
  // 模拟 openTemplates 里的卡片构造
  const wrap = document.createElement('div');
  wrap.className = 'tpl-grid';
  for (const t of TEMPLATES) {
    const card = document.createElement('button');
    card.className = 'tpl-card';
    const name = document.createElement('div');
    name.className = 'tpl-name';
    name.textContent = t.name;
    const desc = document.createElement('div');
    desc.className = 'tpl-desc';
    desc.textContent = t.desc;
    card.appendChild(name);
    card.appendChild(desc);
    wrap.appendChild(card);
  }
  document.body.appendChild(wrap);
  assert(wrap.children.length === TEMPLATES.length, '卡片数=' + wrap.children.length);
  assert(wrap.textContent.indexOf('登录页') >= 0, '缺登录页卡片');
  wrap.remove();
  return TEMPLATES.length + ' 张卡片';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
