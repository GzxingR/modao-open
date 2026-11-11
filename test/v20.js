/**
 * v2.0 自测：浮层（打开 / 关闭 / 遮罩 / 默认打开）
 */

import { Store } from '../src/store.js';
import { createProject, getDevice, ACTIONS } from '../src/model.js';
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

/** 建一个「按钮 + 浮层分组」的页面 */
function buildPage(opts) {
  const s = new Store();
  s.state.project = createProject('ov');
  const btn = s.addNode('button', { x: 20, y: 20, w: 120, h: 40, text: '打开' });
  const r1 = s.addNode('rect', { x: 40, y: 300, w: 300, h: 200, bg: '#ffffff' });
  const r2 = s.addNode('text', { x: 60, y: 320, w: 200, h: 30, text: '弹窗内容' });
  s.select([r1.id, r2.id]);
  const ov = s.groupSelected();
  s.setOverlay(ov.id, Object.assign({ overlay: true, overlayMask: true }, opts || {}));
  s.updateNode(btn.id, { link: { action: 'openOverlay', trigger: 'click', targetNodeId: ov.id } });
  return { s, btn, ov };
}

function boot(s) {
  const project = JSON.parse(JSON.stringify(s.project));
  for (const p of project.pages) p.device = getDevice(p.deviceId);
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const rt = createPreviewRuntime(project, project.pages[0].id, mount);
  rt.start();
  return { rt, mount };
}

/* ================= 数据层 ================= */
await check('分组可以设为浮层', () => {
  const { s, ov } = buildPage();
  assert(ov.overlay === true, 'overlay 没设上');
  assert(ov.overlayMask === true, 'mask 没设上');
  assert(ov.defaultOpen === false, '默认应关闭');
  // 也要能取消
  s.setOverlay(ov.id, { overlay: false });
  assert(ov.overlay === false, '取消失败');
  return 'ok';
});

await check('交互行为表包含浮层两项', () => {
  const names = ACTIONS.map((a) => a.value);
  assert(names.indexOf('openOverlay') >= 0, '缺 openOverlay');
  assert(names.indexOf('closeOverlay') >= 0, '缺 closeOverlay');
  return ACTIONS.length + ' 种行为';
});

/* ================= 预览运行时 ================= */
await check('预览里浮层与遮罩默认隐藏', () => {
  const { s, ov } = buildPage();
  const { mount } = boot(s);
  const ovEl = mount.querySelector('[data-id="' + ov.id + '"]');
  assert(ovEl, '没渲染浮层');
  assert(ovEl.style.display === 'none', '浮层初始应隐藏：' + ovEl.style.display);
  const mask = mount.querySelector('.ov-mask');
  assert(mask, '没渲染遮罩');
  assert(mask.style.display === 'none', '遮罩初始应隐藏');
  assert(ovEl.style.zIndex === '901', '浮层层级=' + ovEl.style.zIndex);
  mount.remove();
  return 'ok';
});

await check('点按钮打开浮层（含遮罩）', () => {
  const { s, btn, ov } = buildPage();
  const { mount } = boot(s);
  const ovEl = mount.querySelector('[data-id="' + ov.id + '"]');
  const mask = mount.querySelector('.ov-mask');
  mount.querySelector('[data-id="' + btn.id + '"]').click();
  assert(ovEl.style.display !== 'none', '浮层没打开：' + ovEl.style.display);
  assert(mask.style.display !== 'none', '遮罩没显示');
  mount.remove();
  return 'ok';
});

await check('关闭浮层会一起收起遮罩', () => {
  const { s, btn, ov } = buildPage();
  // 再加一个关闭按钮
  const closeBtn = s.addNode('button', { x: 20, y: 80, w: 120, h: 40, text: '关闭' });
  s.updateNode(closeBtn.id, { link: { action: 'closeOverlay', trigger: 'click', targetNodeId: ov.id } });
  const { mount } = boot(s);
  const ovEl = mount.querySelector('[data-id="' + ov.id + '"]');
  const mask = mount.querySelector('.ov-mask');

  mount.querySelector('[data-id="' + btn.id + '"]').click();
  assert(ovEl.style.display !== 'none', '前置打开失败');

  mount.querySelector('[data-id="' + closeBtn.id + '"]').click();
  assert(ovEl.style.display === 'none', '浮层没关：' + ovEl.style.display);
  assert(mask.style.display === 'none', '遮罩没关');
  mount.remove();
  return 'ok';
});

await check('defaultOpen 的浮层一开始就显示', () => {
  const { s, ov } = buildPage({ defaultOpen: true });
  const { mount } = boot(s);
  const ovEl = mount.querySelector('[data-id="' + ov.id + '"]');
  const mask = mount.querySelector('.ov-mask');
  assert(ovEl.style.display !== 'none', '默认打开的浮层被隐藏了');
  assert(mask.style.display !== 'none', '遮罩没显示');
  mount.remove();
  return 'ok';
});

await check('无遮罩的浮层不生成 mask', () => {
  const { s } = buildPage({ overlayMask: false });
  const { mount } = boot(s);
  assert(!mount.querySelector('.ov-mask'), '不该有遮罩');
  mount.remove();
  return 'ok';
});

await check('浮层始终排在普通元素之后（层级正确）', () => {
  const { s, ov } = buildPage();
  const { mount, rt } = boot(s);
  const host = mount.firstElementChild;
  const children = Array.prototype.slice.call(host.children);
  const ovIndex = children.findIndex((el) => el.dataset && el.dataset.id === ov.id);
  const maskIndex = children.findIndex((el) => el.classList && el.classList.contains('ov-mask'));
  assert(ovIndex > 0, '浮层位置异常');
  assert(maskIndex >= 0 && maskIndex < ovIndex, '遮罩应在浮层之前');
  mount.remove();
  void rt;
  return 'mask@' + maskIndex + ' < overlay@' + ovIndex;
});

/* ================= 导出 ================= */
await check('离线演示 HTML 带浮层元数据与处理逻辑', () => {
  const { s } = buildPage();
  const html = buildStandaloneHtml(s.project);
  assert(html.indexOf('data-ov') >= 0, '缺 data-ov 标记');
  assert(html.indexOf('data-ovm') >= 0, '缺遮罩标记');
  assert(html.indexOf('openOverlay') >= 0, '运行时缺 openOverlay');
  assert(html.indexOf('closeOverlay') >= 0, '运行时缺 closeOverlay');
  assert(html.indexOf('ov-mask') >= 0, '运行时没生成遮罩');
  return Math.round(html.length / 1024) + ' KB';
});

await check('导出里浮层排在普通节点之后', () => {
  const { s } = buildPage();
  const html = buildStandaloneHtml(s.project);
  const marker = 'window.__PROTO__ = ';
  const start = html.indexOf(marker) + marker.length;
  const end = html.indexOf(';</script>', start);
  assert(start > marker.length - 1 && end > start, '找不到数据段');
  const data = JSON.parse(html.slice(start, end));
  const page = data.pages[0];
  assert(page.nodes.length >= 2, '节点数=' + page.nodes.length);
  const last = page.nodes[page.nodes.length - 1];
  assert(last.html.indexOf('data-ov="1"') >= 0, '最后一个节点不是浮层：' + last.html.slice(0, 80));
  const firstIsOverlay = page.nodes[0].html.indexOf('data-ov="1"') >= 0;
  assert(!firstIsOverlay, '浮层跑到最前面了');
  return page.nodes.length + ' 个节点，浮层在末尾';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
