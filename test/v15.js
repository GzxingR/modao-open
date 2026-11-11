/**
 * v1.5 自测：标注模式（元素规格 + 切图）与 PDF 导出
 */

import { Store } from '../src/store.js';
import { createProject, getDevice, resolveDevice } from '../src/model.js';
import { renderNodeToDataURL, buildNodeSpecText } from '../src/io.js';
import { buildProjectPDF } from '../src/pdf.js';
import { buildAssignmentProject } from '../src/presets.js';

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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('解码失败'));
    img.src = src;
  });
}

/* ================= 元素切图 ================= */
await check('元素切图尺寸是 2 倍', async () => {
  const s = new Store();
  s.state.project = createProject('cut');
  const n = s.addNode('button', { x: 20, y: 20, w: 200, h: 44, text: '按钮' });
  const r = await renderNodeToDataURL(n);
  assert(r.width === 400 && r.height === 88, '尺寸=' + r.width + '×' + r.height);
  assert(r.dataUrl.indexOf('data:image/png') === 0, '不是 PNG');
  const img = await loadImage(r.dataUrl);
  assert(img.naturalWidth === 400, 'naturalWidth=' + img.naturalWidth);
  return r.width + '×' + r.height;
});

await check('切图内容是干净的单个元素（无画布其它部分）', async () => {
  const s = new Store();
  s.state.project = createProject('cut2');
  const n = s.addNode('rect', { x: 100, y: 300, w: 80, h: 60, bg: '#1677ff' });
  const r = await renderNodeToDataURL(n);
  const img = await loadImage(r.dataUrl);
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const center = g.getImageData(c.width / 2, c.height / 2, 1, 1).data;
  assert(center[0] === 22 && center[1] === 119 && center[2] === 255, '中心像素=' + center.join(','));
  // 角落：元素是矩形，圆角 8 → 左上角应透明
  const corner = g.getImageData(1, 1, 1, 1).data;
  assert(corner[3] < 40, '左上角不是透明：alpha=' + corner[3]);
  return '中心 rgb(' + center[0] + ',' + center[1] + ',' + center[2] + ') / 角 alpha=' + corner[3];
});

/* ================= 标注规格 ================= */
await check('元素规格包含关键信息', () => {
  const s = new Store();
  s.state.project = createProject('spec');
  const n = s.addNode('button', { x: 41, y: 436, w: 320, h: 44, text: '登录', bg: '#1677ff', radius: 8, fontSize: 16 });
  const text = buildNodeSpecText(n);
  assert(text.indexOf('x=41') >= 0, '缺 x：' + text);
  assert(text.indexOf('320 × 44') >= 0, '缺尺寸');
  assert(text.indexOf('#1677ff') >= 0, '缺填充色');
  assert(text.indexOf('圆角：8px') >= 0, '缺圆角');
  assert(text.indexOf('登录') >= 0, '缺文案');
  return text.split('\n').length + ' 行';
});

await check('组也能出规格', () => {
  const s = new Store();
  s.state.project = createProject('spec2');
  const a = s.addNode('rect', { x: 20, y: 20, w: 60, h: 60 });
  const b = s.addNode('rect', { x: 100, y: 20, w: 60, h: 60 });
  s.select([a.id, b.id]);
  const g = s.groupSelected();
  const text = buildNodeSpecText(g);
  assert(text.indexOf('分组：2 个元素') >= 0, '缺分组信息：' + text);
  return 'ok';
});

/* ================= PDF ================= */
await check('PDF 头部与结尾正确', async () => {
  const s = new Store();
  s.state.project = createProject('pdf');
  s.addNode('button', { text: '第一页按钮' });
  const bytes = await buildProjectPDF(s.project);
  assert(bytes.length > 2000, '太小：' + bytes.length);
  const text = new TextDecoder('latin1').decode(bytes);
  assert(text.indexOf('%PDF-1.4') === 0, '头部不对：' + text.slice(0, 12));
  assert(text.trimEnd().endsWith('%%EOF'), '结尾不对');
  return Math.round(bytes.length / 1024) + ' KB';
});

await check('PDF 含 JPEG 图像流与页数', async () => {
  const project = buildAssignmentProject();
  const bytes = await buildProjectPDF(project);
  const text = new TextDecoder('latin1').decode(bytes);
  assert(text.indexOf('/Filter /DCTDecode') >= 0, '没有 DCTDecode');
  assert(text.indexOf('/Count ' + project.pages.length) >= 0, '页数不对，期望 ' + project.pages.length);
  assert(text.indexOf('/Subtype /Image') >= 0, '没有图像对象');
  return project.pages.length + ' 页 / ' + Math.round(bytes.length / 1024) + ' KB';
});

await check('PDF xref 偏移指向正确的 xref 表', async () => {
  const s = new Store();
  s.state.project = createProject('pdf2');
  s.addNode('rect', { x: 10, y: 10, w: 100, h: 100 });
  const bytes = await buildProjectPDF(s.project);
  const text = new TextDecoder('latin1').decode(bytes);

  const at = text.lastIndexOf('startxref');
  assert(at > 0, '没有 startxref');
  const rest = text.slice(at + 9).trim();
  const offset = parseInt(rest.split('\n')[0], 10);
  assert(!isNaN(offset), 'startxref 不是数字');
  assert(text.slice(offset, offset + 4) === 'xref', 'startxref 指向 "' + text.slice(offset, offset + 4) + '"');
  return 'offset=' + offset;
});

await check('PDF 页面尺寸按 96dpi→72dpi 换算', async () => {
  const s = new Store();
  s.state.project = createProject('pdf3');
  s.addNode('button');
  const bytes = await buildProjectPDF(s.project);
  const text = new TextDecoder('latin1').decode(bytes);
  // iPhone 17: 402×874 px → 301.5×655.5 pt
  assert(text.indexOf('/MediaBox [0 0 301.50 655.50]') >= 0, 'MediaBox 不对');
  return '301.50 × 655.50 pt';
});

await check('自定义尺寸页也能出 PDF', async () => {
  const s = new Store();
  s.state.project = createProject('pdf4');
  s.setCustomSize(500, 900);
  s.addNode('text', { text: '自定义' });
  const bytes = await buildProjectPDF(s.project);
  const text = new TextDecoder('latin1').decode(bytes);
  const dev = resolveDevice(s.page);
  assert(dev.w === 500, '尺寸未生效');
  assert(text.indexOf('/MediaBox [0 0 375.00 675.00]') >= 0, 'MediaBox=' + text.match(/MediaBox \[[^\]]+\]/));
  return '375 × 675 pt';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
