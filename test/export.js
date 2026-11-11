/**
 * 导出链路自测：SVG foreignObject → canvas → PNG dataURL，并回读像素确认内容真的画上了。
 */

import { createPage, createNode, getDevice } from '../src/model.js';
import { renderPageToDataURL } from '../src/io.js';
import { buildAssignmentProject } from '../src/presets.js';

const results = [];
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then((d) => { results.push('PASS  ' + name + (d ? '  (' + d + ')' : '')); })
    .catch((e) => { results.push('FAIL  ' + name + '  -> ' + (e && e.message ? e.message : e)); });
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('PNG 无法解码'));
    img.src = dataUrl;
  });
}

function pixelAt(img, cssX, cssY) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const scale = img.width / (img.width / 2);
  void scale;
  const px = g.getImageData(Math.round(cssX * 2), Math.round(cssY * 2), 1, 1).data;
  return { r: px[0], g: px[1], b: px[2], a: px[3] };
}

function near(actual, expect, tol) {
  return Math.abs(actual - expect) <= (tol || 6);
}

async function main() {
  /* ---------- 1. 登录页导出 ---------- */
  const dev = getDevice('iphone17');
  const page = createPage('导出测试', 'iphone17');
  page.nodes.push(createNode('text', dev, {
    x: 0, y: 96, w: 402, h: 40, text: '校园助手', fontSize: 28, fontWeight: 700, align: 'center'
  }));
  page.nodes.push(createNode('button', dev, {
    x: 41, y: 436, w: 320, h: 44, text: '登录', bg: '#1677ff', radius: 8
  }));

  let dataUrl = null;
  await check('renderPageToDataURL 返回 PNG dataURL', async () => {
    const r = await renderPageToDataURL(page);
    dataUrl = r.dataUrl;
    assert(dataUrl.indexOf('data:image/png;base64,') === 0, '前缀不对：' + String(dataUrl).slice(0, 30));
    assert(r.width === 804, 'width=' + r.width);
    assert(r.height === 1748, 'height=' + r.height);
    return (dataUrl.length / 1024).toFixed(0) + ' KB';
  });

  await check('导出的 PNG 可被浏览器解码且尺寸正确', async () => {
    assert(dataUrl, '上一步没产出');
    const img = await loadImage(dataUrl);
    assert(img.naturalWidth === 804, 'naturalWidth=' + img.naturalWidth);
    assert(img.naturalHeight === 1748, 'naturalHeight=' + img.naturalHeight);
    return img.naturalWidth + '×' + img.naturalHeight;
  });

  await check('按钮颜色真的画进了图里', async () => {
    const img = await loadImage(dataUrl);
    const p = pixelAt(img, 70, 458); // 按钮内左侧，避开「登录」白字
    assert(near(p.r, 22, 14) && near(p.g, 119, 16) && near(p.b, 255, 10),
      '像素是 rgb(' + p.r + ',' + p.g + ',' + p.b + ')，期望接近 #1677ff');
    return 'rgb(' + p.r + ',' + p.g + ',' + p.b + ')';
  });

  await check('文字区域不是空白', async () => {
    const img = await loadImage(dataUrl);
    // 标题「校园助手」附近，找非白像素
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 180, 804, 120).data; // y≈90~150 css
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) dark += 1;
    }
    assert(dark > 200, '标题区域深色像素只有 ' + dark);
    return dark + ' 个深色像素';
  });

  /* ---------- 2. 弹窗页（半透明遮罩）---------- */
  await check('半透明遮罩页也能导出', async () => {
    const proj = buildAssignmentProject();
    const dialog = proj.pages.find((p) => p.name === '退出确认弹窗');
    assert(dialog, '找不到弹窗页');
    const r = await renderPageToDataURL(dialog);
    assert(r.dataUrl.indexOf('data:image/png') === 0, '不是 png');
    const img = await loadImage(r.dataUrl);
    assert(img.naturalWidth === 780, 'width=' + img.naturalWidth);
    // 遮罩区域应比纯白暗
    const p = pixelAt(img, 10, 60);
    assert(p.r < 200, '遮罩区域太亮：' + p.r);
    return 'rgb(' + p.r + ',' + p.g + ',' + p.b + ')';
  });

  /* ---------- 3. 作业四页全量导出 ---------- */
  await check('作业四页都能导出', async () => {
    const proj = buildAssignmentProject();
    let total = 0;
    for (const p of proj.pages) {
      const r = await renderPageToDataURL(p);
      const img = await loadImage(r.dataUrl);
      assert(img.naturalWidth > 0, p.name + ' 尺寸异常');
      total += 1;
    }
    assert(total === 4, '页数=' + total);
    return total + ' 页';
  });

  const out = document.getElementById('out');
  const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
  out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
}

main().catch((e) => {
  document.getElementById('out').textContent = 'FATAL ' + (e && e.message);
});
