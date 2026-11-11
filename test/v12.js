/**
 * v1.2 自测：自定义画布尺寸 + 图片上传链路
 */

import { Store } from '../src/store.js';
import { createProject, createNode, getDevice, resolveDevice } from '../src/model.js';
import { createNodeEl } from '../src/nodes.js';
import { renderPageToDataURL, buildSpecText, compressImageFile } from '../src/io.js';
import { buildStandaloneHtml } from '../src/exportHtml.js';
import { createCanvas } from '../src/canvas.js';
import { renderLayerList } from '../src/library.js';

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

/* ================= 自定义画布尺寸 ================= */
await check('setCustomSize 改变实际画布尺寸', () => {
  const s = new Store();
  s.state.project = createProject('cs');
  assert(s.device.w === 402, '初始 w=' + s.device.w);
  s.setCustomSize(1200, 800);
  assert(s.device.w === 1200, 'w=' + s.device.w);
  assert(s.device.h === 800, 'h=' + s.device.h);
  return s.device.w + '×' + s.device.h;
});

await check('resolveDevice 标记 custom 且保留预设计信息', () => {
  const s = new Store();
  s.state.project = createProject('cs2');
  s.setCustomSize(500, 900);
  const dev = resolveDevice(s.page);
  assert(dev.custom === true, '没有 custom 标记');
  assert(dev.label.indexOf('自定义') >= 0, 'label=' + dev.label);
  assert(dev.w === 500 && dev.h === 900, '尺寸不对');
  return dev.label;
});

await check('尺寸有上下限保护', () => {
  const s = new Store();
  s.state.project = createProject('cs3');
  s.setCustomSize(10, 10);
  assert(s.device.w === 120, '下限 w=' + s.device.w);
  assert(s.device.h === 200, '下限 h=' + s.device.h);
  s.setCustomSize(99999, 99999);
  assert(s.device.w === 4000, '上限 w=' + s.device.w);
  assert(s.device.h === 6000, '上限 h=' + s.device.h);
  return 'ok';
});

await check('切换预设设备会清掉自定义尺寸', () => {
  const s = new Store();
  s.state.project = createProject('cs4');
  s.setCustomSize(500, 900);
  s.setDevice('iphone14');
  assert(s.page.customW === null, 'customW 没清');
  assert(s.device.w === 390, '设备尺寸=' + s.device.w);
  return 'ok';
});

await check('自定义尺寸影响导出 PNG 尺寸', async () => {
  const s = new Store();
  s.state.project = createProject('cs5');
  s.setCustomSize(500, 900);
  s.addNode('button', { text: '测试' });
  const r = await renderPageToDataURL(s.page);
  assert(r.width === 1000, '导出宽=' + r.width);
  assert(r.height === 1800, '导出高=' + r.height);
  return r.width + '×' + r.height;
});

await check('规格文本使用自定义尺寸', () => {
  const s = new Store();
  s.state.project = createProject('cs6');
  s.setCustomSize(500, 900);
  const text = buildSpecText(s.page, 'cs6');
  assert(text.indexOf('500×900') >= 0, '规格里没有自定义尺寸：' + text.split('\n')[1]);
  return text.split('\n')[1];
});

await check('自定义尺寸随项目序列化保存', () => {
  const s = new Store();
  s.state.project = createProject('cs7');
  s.setCustomSize(640, 1280);
  const json = JSON.stringify(s.project);
  const back = JSON.parse(json);
  assert(back.pages[0].customW === 640, 'customW 丢了');
  assert(back.pages[0].customH === 1280, 'customH 丢了');
  return 'ok';
});

/* ================= 图片 ================= */
await check('图片节点没有 src 时渲染占位', () => {
  const n = createNode('image', device, { text: '商品主图' });
  const el = createNodeEl(n, { interactive: true });
  assert(!el.querySelector('img'), '不该有 img');
  assert(el.textContent.indexOf('商品主图') >= 0, '占位文案丢了');
  return '占位';
});

await check('图片节点有 src 时渲染真实 img', () => {
  const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const n = createNode('image', device, { src: px, fit: 'contain' });
  const el = createNodeEl(n, { interactive: true });
  const img = el.querySelector('img');
  assert(img, '没有 img');
  assert(img.style.objectFit === 'contain', 'fit=' + img.style.objectFit);
  assert(img.getAttribute('src') === px, 'src 丢了');
  return 'img ok';
});

await check('compressImageFile 压缩到最长边 900', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 600;
  const g = canvas.getContext('2d');
  g.fillStyle = '#1677ff';
  g.fillRect(0, 0, 1200, 600);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], 'x.png', { type: 'image/png' });
  const r = await compressImageFile(file, 900, 0.82);
  assert(r.dataUrl.indexOf('data:image/jpeg') === 0, '不是 jpeg：' + r.dataUrl.slice(0, 30));
  assert(r.width === 900 && r.height === 450, '尺寸=' + r.width + '×' + r.height);
  assert(r.dataUrl.length > 500, 'dataURL 太小');
  return r.width + '×' + r.height + ' / ' + Math.round(r.dataUrl.length / 1024) + ' KB';
});

await check('图片进得了离线演示 HTML', () => {
  const s = new Store();
  s.state.project = createProject('img');
  const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  s.addNode('image', { src: px });
  const html = buildStandaloneHtml(s.project);
  assert(html.indexOf('data:image/png;base64') >= 0, '图片没进演示文件');
  assert(html.indexOf('<img') >= 0, '没有 img 标签');
  return Math.round(html.length / 1024) + ' KB';
});

/* ================= 框选与图层 ================= */
await check('框选只选中相交的节点', () => {
  const s = new Store();
  s.state.project = createProject('mq');
  s.addNode('rect', { x: 20, y: 20, w: 60, h: 60 });
  s.addNode('rect', { x: 300, y: 400, w: 60, h: 60 });
  s.state.zoom = 1;

  const host = document.getElementById('testHost');
  const cv = createCanvas({
    canvasHost: host,
    nodesLayer: document.getElementById('testNodes'),
    hintsLayer: document.getElementById('testHints'),
    store: s
  });
  cv.render();

  host.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, clientX: 5, clientY: 5, pointerId: 2, button: 0
  }));
  window.dispatchEvent(new PointerEvent('pointermove', {
    bubbles: true, clientX: 100, clientY: 100, pointerId: 2
  }));
  window.dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true, clientX: 100, clientY: 100, pointerId: 2
  }));

  assert(s.state.selection.length === 1, '选中数量=' + s.state.selection.length);
  return '选中 1 个';
});

await check('空白点击不误选', () => {
  const s = new Store();
  s.state.project = createProject('mq2');
  s.addNode('rect', { x: 300, y: 400, w: 60, h: 60 });
  s.select([s.page.nodes[0].id]);
  s.state.zoom = 1;

  const host = document.getElementById('testHost');
  const cv = createCanvas({
    canvasHost: host,
    nodesLayer: document.getElementById('testNodes'),
    hintsLayer: document.getElementById('testHints'),
    store: s
  });
  cv.render();

  host.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, clientX: 5, clientY: 5, pointerId: 3, button: 0
  }));
  window.dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true, clientX: 5, clientY: 5, pointerId: 3
  }));
  assert(s.state.selection.length === 0, '没有清空选择');
  return 'ok';
});

await check('图层列表按顶层在前排列', () => {
  const s = new Store();
  s.state.project = createProject('ly');
  s.addNode('button', { text: '底层按钮' });
  s.addNode('text', { text: '顶层文字' });
  const list = document.createElement('div');
  renderLayerList(list, s, { toast() {} });
  assert(list.children.length === 2, '行数=' + list.children.length);
  const first = list.children[0].querySelector('.l-name').textContent;
  const second = list.children[1].querySelector('.l-name').textContent;
  assert(first.indexOf('顶层文字') >= 0, '第一行不是顶层：' + first);
  assert(second.indexOf('底层按钮') >= 0, '第二行不是底层：' + second);
  return first + ' / ' + second;
});

await check('图层行可选中且能切换隐藏', () => {
  const s = new Store();
  s.state.project = createProject('ly2');
  s.addNode('rect');
  const list = document.createElement('div');
  renderLayerList(list, s, { toast() {} });
  const row = list.children[0];
  row.click();
  assert(s.state.selection.length === 1, '点击没选中');

  const eye = row.querySelectorAll('.l-btn')[0];
  eye.click();
  assert(s.page.nodes[0].hidden === true, '隐藏没生效');

  const lock = row.querySelectorAll('.l-btn')[1];
  lock.click();
  assert(s.page.nodes[0].locked === true, '锁定没生效');
  return '选中/隐藏/锁定 ok';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
