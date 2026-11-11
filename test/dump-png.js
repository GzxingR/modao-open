/**
 * 把导出的 PNG 真的显示出来，用于人工/视觉核对。
 */

import { buildAssignmentProject } from '../src/presets.js';
import { renderPageToDataURL } from '../src/io.js';

const row = document.getElementById('row');
const proj = buildAssignmentProject();

const shown = ['登录页', '退出确认弹窗'];

(async () => {
  for (const name of shown) {
    const page = proj.pages.find((p) => p.name === name);
    if (!page) continue;
    const { dataUrl } = await renderPageToDataURL(page);
    const fig = document.createElement('figure');
    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.width = '260px';
    img.style.height = 'auto';
    const cap = document.createElement('figcaption');
    cap.textContent = name + ' · ' + (dataUrl.length / 1024).toFixed(0) + ' KB';
    fig.appendChild(img);
    fig.appendChild(cap);
    row.appendChild(fig);
  }
  document.title = 'exported ' + shown.length;
})();
