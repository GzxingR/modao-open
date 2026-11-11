/**
 * 无依赖 PDF 导出：每页渲染成 JPEG，嵌进最小 PDF 结构（DCTDecode）。
 * 不引入任何库，生成的就是标准 PDF，可直接打印或发给别人。
 */

import { renderPageToDataURL } from './io.js';
import { resolveDevice } from './model.js';

const PT_PER_PX = 0.75; // 96dpi → 72dpi

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片解码失败'));
    img.src = src;
  });
}

async function pageToJpeg(page) {
  const { dataUrl } = await renderPageToDataURL(page);
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const g = canvas.getContext('2d');
  g.fillStyle = page.bg || '#ffffff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(img, 0, 0);
  const jpeg = canvas.toDataURL('image/jpeg', 0.92);
  return {
    bytes: b64ToBytes(jpeg.split(',')[1]),
    pxW: img.width,
    pxH: img.height
  };
}

function assemblePDF(pages, title) {
  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let offset = 0;

  function push(data) {
    const u8 = typeof data === 'string' ? enc.encode(data) : data;
    chunks.push(u8);
    offset += u8.length;
  }

  function obj(n, body) {
    offsets[n] = offset;
    push(n + ' 0 obj\n');
    push(body);
    push('\nendobj\n');
  }

  // 头部 + 二进制标记注释
  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const count = pages.length;
  const kids = [];
  for (let i = 0; i < count; i += 1) kids.push((3 + i * 3) + ' 0 R');

  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + count + ' >>');

  for (let i = 0; i < count; i += 1) {
    const p = pages[i];
    const pageNum = 3 + i * 3;
    const contentNum = pageNum + 1;
    const imgNum = pageNum + 2;
    const w = (p.ptW).toFixed(2);
    const h = (p.ptH).toFixed(2);

    obj(pageNum, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + w + ' ' + h +
      '] /Resources << /XObject << /Im0 ' + imgNum + ' 0 R >> >> /Contents ' + contentNum + ' 0 R >>');

    const content = 'q\n' + w + ' 0 0 ' + h + ' 0 0 cm\n/Im0 Do\nQ\n';
    const contentBytes = enc.encode(content);
    obj(contentNum, '<< /Length ' + contentBytes.length + ' >>\nstream\n' + content + 'endstream');

    // 图像对象要把 header 和二进制分开推
    offsets[imgNum] = offset;
    push(imgNum + ' 0 obj\n');
    push('<< /Type /XObject /Subtype /Image /Width ' + p.pxW + ' /Height ' + p.pxH +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpg.length + ' >>\nstream\n');
    push(p.jpg);
    push('\nendstream\nendobj\n');
  }

  // 文档信息
  const infoNum = 3 + count * 3;
  const safeTitle = String(title || 'prototype').replace(/[\\()]/g, ' ');
  obj(infoNum, '<< /Title (' + safeTitle + ') /Producer (modao-open) >>');

  const totalObjects = infoNum;
  const xrefStart = offset;

  let xref = 'xref\n0 ' + (totalObjects + 1) + '\n';
  xref += '0000000000 65535 f \n';
  for (let n = 1; n <= totalObjects; n += 1) {
    const off = String(offsets[n] || 0).padStart(10, '0');
    xref += off + ' 00000 n \n';
  }
  push(xref);

  push('trailer\n<< /Size ' + (totalObjects + 1) + ' /Root 1 0 R /Info ' + infoNum + ' 0 R >>\n');
  push('startxref\n' + xrefStart + '\n%%EOF\n');

  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const c of chunks) {
    out.set(c, cursor);
    cursor += c.length;
  }
  return out;
}

export async function buildProjectPDF(project, onProgress) {
  const pages = [];
  for (let i = 0; i < project.pages.length; i += 1) {
    const page = project.pages[i];
    if (onProgress) onProgress(i + 1, project.pages.length, page.name);
    const dev = resolveDevice(page);
    const jpg = await pageToJpeg(page);
    pages.push({
      jpg: jpg.bytes,
      pxW: jpg.pxW,
      pxH: jpg.pxH,
      ptW: dev.w * PT_PER_PX,
      ptH: dev.h * PT_PER_PX
    });
    await new Promise((r) => setTimeout(r, 40));
  }
  return assemblePDF(pages, project.name);
}

export async function downloadProjectPDF(project, onProgress) {
  const bytes = await buildProjectPDF(project, onProgress);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = String(project.name || 'prototype').replace(/[\\/:*?"<>|]+/g, '_') + '.pdf';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return bytes.length;
}
