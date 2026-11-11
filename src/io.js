/**
 * 导入导出：PNG / 项目 JSON / 规格清单
 */

import { renderPage } from './nodes.js';
import { getDevice } from './model.js';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function safeName(s) {
  return String(s || 'prototype').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);
}

/**
 * 把页面渲染成 PNG dataURL（2 倍图）。导出与自测共用。
 */
export async function renderPageToDataURL(page) {
  const device = getDevice(page.deviceId);
  const host = renderPage(page, { device });

  host.style.width = device.w + 'px';
  host.style.height = device.h + 'px';
  host.style.background = page.bg || '#ffffff';

  const xml = new XMLSerializer().serializeToString(host);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + device.w + '" height="' + device.h + '">' +
    '<foreignObject x="0" y="0" width="' + device.w + '" height="' + device.h + '">' +
    '<div xmlns="http://www.w3.org/1999/xhtml">' + xml + '</div>' +
    '</foreignObject></svg>';

  const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

  const dataUrl = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = device.w * scale;
        canvas.height = device.h * scale;
        const g = canvas.getContext('2d');
        g.scale(scale, scale);
        g.fillStyle = page.bg || '#ffffff';
        g.fillRect(0, 0, device.w, device.h);
        g.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('SVG 转 PNG 失败'));
    img.src = svgUrl;
  });

  return { dataUrl, width: device.w * 2, height: device.h * 2 };
}

/** 批量导出所有页面 PNG（间隔触发，避免浏览器拦截多文件下载） */
export async function exportAllPagesPNG(project, onProgress) {
  const pages = project.pages;
  let ok = 0;
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    if (onProgress) onProgress(i + 1, pages.length, page.name);
    const { dataUrl } = await renderPageToDataURL(page);
    const base64 = dataUrl.split(',')[1];
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k += 1) bytes[k] = bin.charCodeAt(k);
    const name = safeName(project.name + '-' + (i + 1) + '-' + page.name) + '.png';
    downloadBlob(new Blob([bytes], { type: 'image/png' }), name);
    ok += 1;
    await new Promise((r) => setTimeout(r, 420));
  }
  return ok;
}

/** 把页面导出成 PNG 文件 */
export async function exportPagePNG(page, projectName) {
  const { dataUrl } = await renderPageToDataURL(page);
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  downloadBlob(new Blob([bytes], { type: 'image/png' }), safeName(projectName + '-' + page.name) + '.png');
}

export function exportProjectJSON(project) {
  const text = JSON.stringify(project, null, 2);
  downloadBlob(new Blob([text], { type: 'application/json' }), safeName(project.name) + '.modao.json');
}

export function readProjectFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(String(reader.result))); } catch (e) { reject(new Error('不是合法的 JSON 项目文件')); }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file, 'utf-8');
  });
}

/** 生成人可读的规格清单，可直接贴进作业答案 */
export function buildSpecText(page, projectName) {
  const device = getDevice(page.deviceId);
  const lines = [];
  lines.push('【' + (projectName || '原型') + ' · ' + page.name + '】');
  lines.push('画布：' + device.label + '（' + device.w + '×' + device.h + '）');
  lines.push('');

  for (let i = 0; i < page.nodes.length; i += 1) {
    const n = page.nodes[i];
    const parts = [];
    parts.push('位置 (' + n.x + ', ' + n.y + ')');
    parts.push('尺寸 ' + n.w + '×' + n.h);

    if (n.text) parts.push('文字「' + n.text + '」');
    if (['text', 'button', 'input', 'textarea', 'badge', 'listitem', 'navbar', 'image'].indexOf(n.type) >= 0) {
      parts.push('字号 ' + n.fontSize);
      if (n.fontWeight >= 700) parts.push('加粗');
      parts.push('颜色 ' + n.color);
    }
    if (n.bg && n.bg !== 'transparent') parts.push('填充 ' + n.bg);
    if (n.radius) parts.push('圆角 ' + n.radius + 'px');
    if (n.borderWidth) parts.push('描边 ' + n.borderWidth + 'px ' + n.borderColor);
    if (n.type === 'tabbar') parts.push('标签 ' + (n.tabs || []).join('/') + '，选中第 ' + ((n.activeIndex || 0) + 1) + ' 个');
    if (n.type === 'icon') parts.push('图标 ' + n.icon);
    if (n.link && n.link.action && n.link.action !== 'none') {
      if (n.link.action === 'navigate') {
        const t = (page.nodes && null) || null;
        void t;
        parts.push('交互：点击跳转页面');
      } else {
        parts.push('交互：点击' + ({ show: '显示', hide: '隐藏', toggle: '切换' }[n.link.action] || n.link.action));
      }
    }
    lines.push((i + 1) + '. ' + typeLabel(n.type) + '：' + parts.join('，'));
  }

  if (!page.nodes.length) lines.push('（本页还没有元素）');
  return lines.join('\n');
}

export function typeLabel(type) {
  const map = {
    text: '文本', rect: '矩形', circle: '圆形', line: '分割线', image: '图片',
    button: '按钮', input: '输入框', textarea: '多行输入框', checkbox: '复选框',
    switch: '开关', icon: '图标', badge: '标签', card: '卡片', listitem: '列表项',
    navbar: '导航栏', tabbar: '标签栏'
  };
  return map[type] || type;
}
