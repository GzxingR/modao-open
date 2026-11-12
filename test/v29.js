/**
 * v2.9 自测：图标库扩充、分类选择器、图标 SVG 导出
 */

import { Store } from '../src/store.js';
import { createProject, ICONS, ICON_NAMES, ICON_GROUPS } from '../src/model.js';
import { renderInspector } from '../src/inspector.js';
import { renderPage } from '../src/nodes.js';
import { buildIconSvgText, exportIconSVG } from '../src/io.js';

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

/* ================= 图标库规模 ================= */
await check('图标数量达到 60 以上', () => {
  assert(ICON_NAMES.length >= 60, '只有 ' + ICON_NAMES.length + ' 个');
  return ICON_NAMES.length + ' 个';
});

await check('每个图标都被分到某个分类里', () => {
  const grouped = new Set();
  for (const names of Object.values(ICON_GROUPS)) {
    names.forEach((n) => grouped.add(n));
  }
  const missing = ICON_NAMES.filter((n) => !grouped.has(n));
  assert(missing.length === 0, '没归类的：' + missing.join(','));
  const ghost = Array.from(grouped).filter((n) => !ICONS[n]);
  assert(ghost.length === 0, '分类里有不存在的图标：' + ghost.join(','));
  return Object.keys(ICON_GROUPS).length + ' 个分类';
});

await check('所有 path 数据非空且形状合法', () => {
  const bad = [];
  for (const [name, d] of Object.entries(ICONS)) {
    if (typeof d !== 'string' || d.trim().length < 6) { bad.push(name + '(空)'); continue; }
    // 必须只含 path 指令字母与数字/符号
    if (!/^[MmLlHhVvCcSsQqTtAaZz0-9\s.,\-+eE]+$/.test(d)) bad.push(name + '(非法字符)');
  }
  assert(bad.length === 0, '有问题：' + bad.join(', '));
  return Object.keys(ICONS).length + ' 个 path 全部合法';
});

await check('每个图标都能真的渲染成 SVG', () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  let ok = 0;
  for (const name of ICON_NAMES) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', ICONS[name]);
    svg.appendChild(p);
    host.appendChild(svg);
    const box = p.getBBox();
    assert(box.width > 0 || box.height > 0, name + ' 渲染出来是空的');
    ok += 1;
  }
  host.remove();
  return ok + ' 个都能画出形状';
});

/* ================= 导出 SVG ================= */
await check('图标导出为合法矢量 SVG 文本', () => {
  const node = { type: 'icon', icon: 'chat', w: 40, h: 40, color: '#1677ff', strokeWidth: 2 };
  const text = buildIconSvgText(node);
  assert(text.indexOf('<?xml') === 0, '缺 XML 声明');
  assert(text.indexOf('xmlns="http://www.w3.org/2000/svg"') >= 0, '缺 xmlns');
  assert(text.indexOf('viewBox="0 0 24 24"') >= 0, '缺 viewBox');
  assert(text.indexOf('width="40"') >= 0 && text.indexOf('height="40"') >= 0, '尺寸不对');
  assert(text.indexOf('stroke="#1677ff"') >= 0, '颜色没带上');
  assert(text.indexOf('stroke-width="2"') >= 0, '线宽没带上');
  assert(text.indexOf('<path d="' + ICONS.chat + '"') >= 0, 'path 内容不对');
  assert(text.trim().endsWith('</svg>'), '结尾不对');
  return text.split('\n').length + ' 行';
});

await check('未知图标名回退到 heart 不报错', () => {
  const text = buildIconSvgText({ type: 'icon', icon: '不存在的图标', w: 24, h: 24 });
  assert(text.indexOf(ICONS.heart) >= 0, '没回退到 heart');
  return 'ok';
});

await check('导出的 SVG 文本大小合理（不真的触发下载）', () => {
  const text = buildIconSvgText({ type: 'icon', icon: 'mail', w: 24, h: 24 });
  assert(text.length > 100, '太小：' + text.length);
  // 能被 DOMParser 解析成 SVG 根元素
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  assert(root && root.tagName.toLowerCase() === 'svg', '解析后根节点不是 svg：' + (root && root.tagName));
  assert(root.querySelector('path'), '解析后没有 path');
  assert(doc.querySelector('parsererror') === null, 'XML 有语法错误');
  return text.length + ' 字节，XML 合法';
});

/* ================= 面板选择器 ================= */
function renderIconInspector(iconName) {
  const s = new Store();
  s.state.project = createProject('icons');
  const n = s.addNode('icon', { x: 10, y: 10, w: 30, h: 30, icon: iconName });
  s.select([n.id]);
  const box = document.getElementById('inspectorBox');
  renderInspector(box, s, {
    update() {}, toast() {}, align() {},
    bringForward() {}, sendBackward() {}, bringToFront() {}, sendToBack() {}
  });
  return box;
}

await check('图标面板是分组网格而不是长下拉', () => {
  const box = renderIconInspector('chat');
  assert(box.querySelector('.icon-picker'), '没有图标选择器');
  const groups = box.querySelectorAll('.icon-group-title');
  assert(groups.length === Object.keys(ICON_GROUPS).length, '分组数=' + groups.length);
  const cells = box.querySelectorAll('.icon-cell');
  assert(cells.length === ICON_NAMES.length, '格子数=' + cells.length + ' / ' + ICON_NAMES.length);
  return groups.length + ' 组 / ' + cells.length + ' 个格子';
});

await check('当前图标在网格里高亮', () => {
  const box = renderIconInspector('chat');
  const on = box.querySelectorAll('.icon-cell.on');
  assert(on.length === 1, '高亮数=' + on.length);
  assert(on[0].getAttribute('title') === 'chat', '高亮的不是 chat：' + on[0].getAttribute('title'));
  return 'chat 高亮';
});

await check('图标元素能渲染进画布', () => {
  const s = new Store();
  s.state.project = createProject('iconrender');
  s.addNode('icon', { x: 10, y: 10, w: 32, h: 32, icon: 'camera', color: '#ff0000' });
  const host = renderPage(s.page, { device: s.device });
  const svg = host.querySelector('svg');
  assert(svg, '没渲染出 svg');
  const path = svg.querySelector('path');
  assert(path && path.getAttribute('d') === ICONS.camera, 'path 不是 camera');
  return 'ok';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
