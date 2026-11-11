/**
 * 入口装配：工具栏、快捷键、拖放、预览、导入导出、AI
 */

import { store } from './store.js';
import { DEVICES, getDevice, createNode } from './model.js';
import { createCanvas } from './canvas.js';
import { renderPageList, renderLibrary } from './library.js';
import { renderInspector } from './inspector.js';
import { renderLinks, createPreviewRuntime } from './links.js';
import { exportPagePNG, exportProjectJSON, readProjectFile, buildSpecText } from './io.js';
import { renderAIPanel, generatePage } from './ai.js';
import { buildAssignmentProject } from './presets.js';

/* ---------------- DOM ---------------- */
const $ = (id) => document.getElementById(id);
const canvasHost = $('canvasHost');
const nodesLayer = $('nodesLayer');
const hintsLayer = $('hintsLayer');
const linksLayer = $('linksLayer');
const pageListEl = $('pageList');
const libraryEl = $('library');
const inspectorEl = $('inspector');
const toastEl = $('toast');
const modal = $('modal');
const modalTitle = $('modalTitle');
const modalBody = $('modalBody');
const modalFoot = $('modalFoot');
const deviceSelect = $('deviceSelect');
const projectNameInput = $('projectName');
const zoomLabel = $('zoomLabel');

/* ---------------- 小工具 ---------------- */
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2000);
}

let modalCleanup = null;
function openModal(title, buildBody, buildFoot) {
  modalTitle.textContent = title;
  modalBody.textContent = '';
  modalFoot.textContent = '';
  const body = buildBody();
  if (body) modalBody.appendChild(body);
  const foot = buildFoot ? buildFoot() : null;
  if (foot) modalFoot.appendChild(foot);
  modal.hidden = false;
  return {
    close() { modal.hidden = true; if (modalCleanup) { modalCleanup(); modalCleanup = null; } }
  };
}

function closeModal() {
  modal.hidden = true;
  if (modalCleanup) { modalCleanup(); modalCleanup = null; }
}

$('modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

function btn(label, onClick, cls) {
  const b = document.createElement('button');
  b.className = 'tb' + (cls ? ' ' + cls : '');
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/* ---------------- 画布 ---------------- */
const canvas = createCanvas({ canvasHost, nodesLayer, hintsLayer, store });

const handlers = {
  addComponent(type) {
    store.addNode(type);
    toast('已添加：' + type);
  },
  update(id, patch) {
    store.updateNode(id, patch);
  },
  bringForward: (id) => store.bringForward(id),
  sendBackward: (id) => store.sendBackward(id),
  bringToFront: (id) => store.bringToFront(id),
  sendToBack: (id) => store.sendToBack(id),
  align: (kind) => store.align(kind),
  toast
};

/* ---------------- 渲染 ---------------- */
function renderAll(reason) {
  projectNameInput.value = store.project.name;
  deviceSelect.value = store.page.deviceId;
  renderPageList(pageListEl, store, handlers);
  renderLibrary(libraryEl, store, handlers);
  canvas.render();
  renderLinks(linksLayer, store);
  renderInspector(inspectorEl, store, handlers);
  zoomLabel.textContent = Math.round(store.state.zoom * 100) + '%';
  $('gridBtn').classList.toggle('on', !!store.state.showGrid);
  $('linkBtn').classList.toggle('on', !!store.state.showLinks);
  void reason;
}

store.subscribe((state, reason) => {
  if (reason === 'zoom') {
    zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
    canvas.applyZoom();
    return;
  }
  renderAll(reason);
});

/* ---------------- 工具栏 ---------------- */
function fillDeviceSelect() {
  deviceSelect.textContent = '';
  for (const d of DEVICES) {
    const o = document.createElement('option');
    o.value = d.id;
    o.textContent = d.label;
    deviceSelect.appendChild(o);
  }
  deviceSelect.value = store.page.deviceId;
}

document.getElementById('toolbar').addEventListener('click', (e) => {
  const t = e.target;
  if (!t.dataset || !t.dataset.act) return;
  const act = t.dataset.act;
  if (act === 'undo') { if (!store.undo()) toast('没有可撤销的操作'); }
  else if (act === 'redo') { if (!store.redo()) toast('没有可重做的操作'); }
  else if (act === 'zoom-in') store.setZoom(store.state.zoom + 0.1);
  else if (act === 'zoom-out') store.setZoom(store.state.zoom - 0.1);
  else if (act === 'zoom-fit') canvas.fit();
  else if (act === 'toggle-grid') store.toggleGrid();
  else if (act === 'toggle-links') store.toggleLinks();
});

document.querySelector('.right-actions').addEventListener('click', async (e) => {
  const t = e.target;
  if (!t.dataset || !t.dataset.act) return;
  const act = t.dataset.act;

  if (act === 'preview') return openPreview();
  if (act === 'spec') return openSpec();
  if (act === 'export-png') {
    try {
      await exportPagePNG(store.page, store.project.name);
      toast('PNG 已导出');
    } catch (err) {
      console.error(err);
      toast('导出失败：' + err.message);
    }
    return;
  }
  if (act === 'save') {
    exportProjectJSON(store.project);
    toast('项目 JSON 已保存');
    return;
  }
  if (act === 'open') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const raw = await readProjectFile(file);
        store.loadProject(raw);
        renderAll('restore');
        toast('已打开：' + store.project.name);
      } catch (err) {
        toast(err.message);
      }
    });
    input.click();
    return;
  }
  if (act === 'ai') return openAI();
  if (act === 'preset') {
    if (!confirm('载入课程作业四页示例会覆盖当前项目，继续？')) return;
    store.loadProject(buildAssignmentProject());
    renderAll('restore');
    canvas.fit();
    toast('已载入作业示例（4 页）');
    return;
  }
});

deviceSelect.addEventListener('change', () => {
  store.setDevice(deviceSelect.value);
  setTimeout(() => { if (store.state.fitRequested) canvas.fit(); }, 0);
});

projectNameInput.addEventListener('change', () => {
  const v = projectNameInput.value.trim() || '未命名原型';
  store.setProjectName(v);
});

$('addPage').addEventListener('click', () => {
  const name = prompt('新页面名称', '页面 ' + (store.project.pages.length + 1));
  if (name) store.addPage(name.trim());
});

/* ---------------- 键盘 ---------------- */
window.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  const meta = e.ctrlKey || e.metaKey;

  if (meta && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) store.redo(); else store.undo();
    return;
  }
  if (meta && e.key.toLowerCase() === 'y') {
    e.preventDefault(); store.redo(); return;
  }
  if (meta && e.key.toLowerCase() === 'd') {
    e.preventDefault(); store.duplicateSelected(); return;
  }
  if (meta && e.key.toLowerCase() === 's') {
    e.preventDefault(); exportProjectJSON(store.project); toast('项目 JSON 已保存'); return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (store.state.selection.length) { e.preventDefault(); store.deleteSelected(); }
    return;
  }
  if (e.key === 'Escape') { store.clearSelection(); renderAll('selection'); return; }

  if (e.key.indexOf('Arrow') === 0 && store.state.selection.length) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const dx = e.key === 'ArrowLeft' ? -step : (e.key === 'ArrowRight' ? step : 0);
    const dy = e.key === 'ArrowUp' ? -step : (e.key === 'ArrowDown' ? step : 0);
    const nodes = store.selectedNodes;
    store.mutate(() => {
      for (const n of nodes) { n.x += dx; n.y += dy; }
    }, { reason: 'move' });
  }
});

/* ---------------- 拖放组件 ---------------- */
canvasHost.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

canvasHost.addEventListener('drop', (e) => {
  e.preventDefault();
  const type = e.dataTransfer.getData('text/plain');
  if (!type) return;
  const rect = canvasHost.getBoundingClientRect();
  const zoom = store.state.zoom;
  const x = Math.round((e.clientX - rect.left) / zoom);
  const y = Math.round((e.clientY - rect.top) / zoom);
  store.addNode(type, { x, y });
  toast('已添加：' + type);
});

/* ---------------- 预览 ---------------- */
function openPreview() {
  const mask = $('previewMask');
  const host = $('previewHost');
  const device = store.device;
  const maxH = window.innerHeight - 140;
  const maxW = window.innerWidth - 120;
  const scale = Math.min(1, maxH / device.h, maxW / device.w);

  host.style.width = (device.w * scale) + 'px';
  host.style.height = (device.h * scale) + 'px';
  host.textContent = '';

  const inner = document.createElement('div');
  inner.style.transform = 'scale(' + scale + ')';
  inner.style.transformOrigin = 'top left';
  host.appendChild(inner);

  $('previewDevice').textContent = device.label;

  const project = JSON.parse(JSON.stringify(store.project));
  for (const p of project.pages) p.device = getDevice(p.deviceId);

  const runtime = createPreviewRuntime(project, store.page.id, inner);
  runtime.start();

  mask.hidden = false;
  mask._runtime = runtime;
}

$('previewClose').addEventListener('click', () => { $('previewMask').hidden = true; });
$('previewRestart').addEventListener('click', () => {
  const mask = $('previewMask');
  if (mask._runtime) mask._runtime.restart();
});

/* ---------------- 规格 ---------------- */
function openSpec() {
  const text = buildSpecText(store.page, store.project.name);
  openModal('规格清单', () => {
    const wrap = document.createElement('div');
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = '可以直接复制进作业答案，也可以拿去当交付说明。';
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.readOnly = true;
    wrap.appendChild(hint);
    wrap.appendChild(ta);
    return wrap;
  }, () => btn('复制', async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast('已复制');
    } catch (e) {
      toast('复制失败，请手动选中');
    }
  }));
}

/* ---------------- AI ---------------- */
function openAI() {
  let panel = null;
  let controller = null;

  const m = openModal('AI 生成页面（自带 API Key）', () => {
    const wrap = document.createElement('div');
    panel = renderAIPanel(wrap, { store });
    return wrap;
  }, () => {
    const box = document.createElement('div');
    box.style.display = 'flex';
    box.style.gap = '8px';

    const stop = btn('停止', () => {
      if (controller) controller.abort();
      if (panel) panel.setStatus('已取消', true);
    });
    stop.style.display = 'none';

    const run = btn('生成', async () => {
      const settings = panel.getSettings();
      const prompt = panel.getPrompt();
      if (!prompt.trim()) { panel.setStatus('先写点要求', true); return; }

      controller = new AbortController();
      run.disabled = true;
      stop.style.display = '';
      panel.setStatus('正在请求模型…');

      try {
        const result = await generatePage(prompt, settings, store.device, controller.signal);
        if (!result.nodes.length) {
          panel.setStatus('模型没有返回可用的组件', true);
        } else {
          store.mutate(() => {
            const page = store.page;
            page.name = result.name || page.name;
            page.nodes.push(...result.nodes);
          }, { reason: 'ai' });
          store.select(result.nodes.map((n) => n.id));
          panel.setStatus('已生成 ' + result.nodes.length + ' 个组件，画布上看效果。');
          toast('AI 生成完成');
        }
      } catch (err) {
        if (err.name === 'AbortError') panel.setStatus('已取消', true);
        else panel.setStatus('失败：' + err.message, true);
      } finally {
        run.disabled = false;
        stop.style.display = 'none';
        controller = null;
      }
    });

    box.appendChild(stop);
    box.appendChild(run);
    return box;
  });

  modalCleanup = () => { if (controller) controller.abort(); };
  void m;
}

/* ---------------- 启动 ---------------- */
function seedFirstProject() {
  const page = store.page;
  if (page.nodes.length) return;
  const device = store.device;
  const navbar = createNode('navbar', device, { x: 0, y: 0, text: '首页', showBack: false, showAction: true });
  const title = createNode('text', device, {
    x: 16, y: 110, w: device.w - 32, h: 30, text: '欢迎使用开源版墨刀', fontSize: 22, fontWeight: 700
  });
  const tip = createNode('text', device, {
    x: 16, y: 150, w: device.w - 32, h: 60,
    text: '左边点组件加进来，拖动画布里的元素改样式；右侧能设交互，顶部可以预览、导出、AI 生成。',
    fontSize: 14, color: '#666666', lineHeight: 1.6
  });
  const btnNode = createNode('button', device, { x: 41, y: 236, w: device.w - 82, h: 44, text: '开始画' });
  page.nodes.push(navbar, title, tip, btnNode);
}

function boot() {
  fillDeviceSelect();
  const autoPreset = /[?&]preset=(1|demo)/.test(location.search);
  if (autoPreset) {
    store.loadProject(buildAssignmentProject());
  } else {
    const loaded = store.loadFromStorage();
    if (!loaded) seedFirstProject();
  }
  renderAll('boot');

  requestAnimationFrame(() => {
    canvas.fit();
    zoomLabel.textContent = Math.round(store.state.zoom * 100) + '%';
  });

  window.addEventListener('resize', () => {
    if (store.state.fitRequested) canvas.fit();
  });

  console.log('[modao-open] ready', store.project.pages.length, 'pages');
}

boot();
