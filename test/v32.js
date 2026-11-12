/**
 * v3.2 自测：自定义组件（母版 + 实例 + 同步）与交互跳转总览
 */

import { Store } from '../src/store.js';
import { createProject, normalizeProject } from '../src/model.js';
import { buildFlowModel, buildFlowSvg, describeFlow } from '../src/flowchart.js';

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
  s.state.project = createProject('comp');
  return s;
}

/* ================= 母版 ================= */
await check('把选中元素存成母版（尺寸与相对坐标）', () => {
  const s = makeStore();
  const a = s.addNode('rect', { x: 40, y: 100, w: 120, h: 44, bg: '#1677ff' });
  const b = s.addNode('text', { x: 40, y: 150, w: 120, h: 24, text: '按钮' });
  s.select([a.id, b.id]);

  const def = s.addComponentDef('主按钮');
  assert(def, '没生成母版');
  assert(def.name === '主按钮', '名字不对：' + def.name);
  assert(def.w === 120, '宽=' + def.w);
  assert(Math.abs(def.h - 74) <= 1, '高=' + def.h);
  assert(def.children.length === 2, '子元素数=' + def.children.length);
  assert(def.children[0].x === 0 && def.children[0].y === 0, '第一个子元素应相对到 0,0：' + def.children[0].x + ',' + def.children[0].y);
  assert(def.children[1].x === 0 && def.children[1].y === 50, '第二个子元素相对坐标不对：' + def.children[1].x + ',' + def.children[1].y);
  return def.w + '×' + def.h + '，' + def.children.length + ' 个子元素';
});

await check('没选中时不能存组件', () => {
  const s = makeStore();
  s.select([]);
  const def = s.addComponentDef('空');
  assert(def === null, '应返回 null');
  assert((s.project.components || []).length === 0, '不该写入');
  return 'ok';
});

/* ================= 实例 ================= */
await check('插入实例：分组带 masterId，内容是副本', () => {
  const s = makeStore();
  const a = s.addNode('rect', { x: 40, y: 100, w: 100, h: 40 });
  s.select([a.id]);
  const def = s.addComponentDef('块');

  const inst = s.insertComponentInstance(def.id, 30, 300);
  assert(inst, '没插入');
  assert(inst.type === 'group', '实例不是分组：' + inst.type);
  assert(inst.masterId === def.id, '没带 masterId');
  assert(inst.x === 30 && inst.y === 300, '位置不对');
  assert(inst.children.length === 1, '子元素数=' + inst.children.length);
  assert(inst.children[0].id !== a.id, '子元素应是副本（新 id）');
  assert(s.page.nodes.some((n) => n.id === inst.id), '没进页面');
  return 'ok';
});

await check('同一母版可插多个实例', () => {
  const s = makeStore();
  const a = s.addNode('rect', { x: 10, y: 10, w: 80, h: 30 });
  s.select([a.id]);
  const def = s.addComponentDef('条');
  const i1 = s.insertComponentInstance(def.id, 20, 100);
  const i2 = s.insertComponentInstance(def.id, 20, 200);
  assert(i1.id !== i2.id, '实例 id 重复');
  assert(i1.masterId === def.id && i2.masterId === def.id, 'masterId 不对');
  const count = s.page.nodes.filter((n) => n.masterId === def.id).length;
  assert(count === 2, '实例数=' + count);
  return '2 个实例';
});

/* ================= 同步 ================= */
await check('改母版后同步所有实例（跨页面）', () => {
  const s = makeStore();
  const a = s.addNode('rect', { x: 10, y: 10, w: 100, h: 40, bg: '#111111' });
  s.select([a.id]);
  const def = s.addComponentDef('卡片');

  s.insertComponentInstance(def.id, 20, 120);
  s.addPage('第二页');
  s.setActivePage(s.project.pages[1].id);
  s.insertComponentInstance(def.id, 20, 120);

  // 改母版颜色
  def.children[0].bg = '#ff0000';
  const n = s.syncInstances(def.id);
  assert(n === 2, '同步数量=' + n);

  let reds = 0;
  for (const page of s.project.pages) {
    for (const node of page.nodes) {
      if (node.masterId === def.id && node.children[0].bg === '#ff0000') reds += 1;
    }
  }
  assert(reds === 2, '真正变色的实例数=' + reds);
  return '2 个实例（跨 2 页）都同步了';
});

await check('用实例反哺母版并同步其它实例', () => {
  const s = makeStore();
  const a = s.addNode('text', { x: 10, y: 10, w: 100, h: 24, text: '旧文字' });
  s.select([a.id]);
  const def = s.addComponentDef('标题');

  const i1 = s.insertComponentInstance(def.id, 20, 100);
  const i2 = s.insertComponentInstance(def.id, 20, 200);

  // 改第一个实例的内容，再反哺
  i1.children[0].text = '新文字';
  const n = s.updateDefFromInstance(i1.id);
  assert(n === 2, '同步数量=' + n);
  assert(def.children[0].text === '新文字', '母版没更新：' + def.children[0].text);
  const inst2 = s.page.nodes.find((x) => x.id === i2.id);
  assert(inst2.children[0].text === '新文字', '另一个实例没同步');
  return 'ok';
});

await check('删除母版后实例保留但解除绑定', () => {
  const s = makeStore();
  const a = s.addNode('rect', { x: 10, y: 10, w: 50, h: 50 });
  s.select([a.id]);
  const def = s.addComponentDef('方块');
  const inst = s.insertComponentInstance(def.id, 10, 100);

  s.removeComponentDef(def.id);
  assert(s.componentDefById(def.id) === null, '母版没删掉');
  const still = s.page.nodes.find((n) => n.id === inst.id);
  assert(still, '实例被删了（不该）');
  assert(!still.masterId, 'masterId 没清：' + still.masterId);
  return '实例保留、绑定解除';
});

await check('组件定义随项目序列化往返', () => {
  const s = makeStore();
  const a = s.addNode('rect', { x: 10, y: 10, w: 60, h: 30 });
  s.select([a.id]);
  s.addComponentDef('往返组件');
  const back = normalizeProject(JSON.parse(JSON.stringify(s.project)));
  assert(back.components.length === 1, '丢了：' + JSON.stringify(back.components));
  assert(back.components[0].name === '往返组件', 'name 丢了');
  assert(Array.isArray(back.components[0].children), 'children 丢了');
  return 'ok';
});

/* ================= 跳转总览 ================= */
function makeFlowProject() {
  const s = makeStore();
  s.addPage('列表页');
  s.addPage('详情页');
  s.setActivePage(s.project.pages[0].id);

  const login = s.project.pages[0];
  const listPage = s.project.pages[1];
  const detailPage = s.project.pages[2];

  const btn = s.addNode('button', { x: 20, y: 20, w: 120, h: 40, text: '登录' });
  s.updateNode(btn.id, { link: { action: 'navigate', trigger: 'click', targetPageId: listPage.id } });

  s.setActivePage(listPage.id);
  const item = s.addNode('listitem', { x: 0, y: 100, w: 300, h: 60, text: '第一项' });
  s.updateNode(item.id, { link: { action: 'navigate', trigger: 'click', targetPageId: detailPage.id } });

  // 再一个到同一页的跳转（应合并成一条边）
  const another = s.addNode('button', { x: 20, y: 200, w: 100, h: 40, text: '也去详情' });
  s.updateNode(another.id, { link: { action: 'navigate', trigger: 'click', targetPageId: detailPage.id } });

  // 自跳转（应忽略）
  const self = s.addNode('button', { x: 20, y: 300, w: 100, h: 40, text: '刷新' });
  s.updateNode(self.id, { link: { action: 'navigate', trigger: 'click', targetPageId: listPage.id } });

  return s;
}

await check('总览模型：页面节点 + 去重后的跳转边', () => {
  const s = makeFlowProject();
  const m = buildFlowModel(s.project);
  assert(m.nodes.length === 3, '页面节点数=' + m.nodes.length);
  assert(m.edges.length === 2, '边数=' + m.edges.length + '（应合并重复、忽略自跳）');
  const keys = m.edges.map((e) => e.from + '>' + e.to);
  const p = s.project.pages;
  assert(keys.indexOf(p[0].id + '>' + p[1].id) >= 0, '缺 登录→列表');
  assert(keys.indexOf(p[1].id + '>' + p[2].id) >= 0, '缺 列表→详情');
  const merged = m.edges.find((e) => e.from === p[1].id && e.to === p[2].id);
  assert(merged.count === 2, '重复跳转没计数：' + merged.count);
  return m.nodes.length + ' 页 / ' + m.edges.length + ' 边';
});

await check('总览能渲染成 SVG（方框数 + 连线数）', () => {
  const s = makeFlowProject();
  const { svg, model } = buildFlowSvg(s.project);
  assert(svg.tagName.toLowerCase() === 'svg', '根节点不是 svg');
  const boxes = svg.querySelectorAll('rect');
  // 页面方框（rx=8）+ marker 里的 path 不是 rect
  assert(boxes.length === model.nodes.length, '方框数=' + boxes.length);
  const paths = svg.querySelectorAll('path');
  assert(paths.length >= model.edges.length, '连线数=' + paths.length);
  const texts = svg.querySelectorAll('text');
  assert(texts.length >= model.nodes.length * 2, '文字标签数=' + texts.length);
  assert(svg.innerHTML.indexOf('marker') >= 0, '缺箭头 marker');
  return boxes.length + ' 个方框 / ' + paths.length + ' 条路径';
});

await check('没有页面或没有跳转时给可读提示', () => {
  const empty = createProject('空');
  empty.pages[0].nodes = [];
  assert(describeFlow(empty).indexOf('还没有任何跳转') >= 0, '缺空跳转提示：' + describeFlow(empty));

  const s = makeFlowProject();
  const text = describeFlow(s.project);
  assert(text.indexOf('3 个页面') >= 0 && text.indexOf('2 条跳转') >= 0, '摘要不对：' + text);
  return text;
});

await check('画布上不存在的目标页不会产生边', () => {
  const s = makeStore();
  const btn = s.addNode('button', { x: 10, y: 10, w: 80, h: 30, text: '坏链接' });
  s.updateNode(btn.id, { link: { action: 'navigate', trigger: 'click', targetPageId: 'page-不存在' } });
  const m = buildFlowModel(s.project);
  assert(m.edges.length === 0, '产生了幽灵边：' + m.edges.length);
  return 'ok';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
