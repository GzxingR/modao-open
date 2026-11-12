/**
 * 入口装配：工具栏、快捷键、拖放、预览、导入导出、AI
 */

import { store } from './store.js';
import { DEVICES, getDevice, createNode } from './model.js';
import { createCanvas } from './canvas.js';
import { renderPageList, renderLibrary, renderLayerList } from './library.js';
import { renderInspector } from './inspector.js';
import { renderLinks, createPreviewRuntime } from './links.js';
import { exportPagePNG, exportAllPagesPNG, exportProjectJSON, readProjectFile, buildSpecText, buildNodeSpecText, exportNodePNG, exportIconSVG } from './io.js';
import { renderAIPanel, generatePage } from './ai.js';
import { buildStandaloneHtml, downloadStandaloneHtml } from './exportHtml.js';
import { downloadProjectPDF } from './pdf.js';
import { openMenu, hideMenu, isMenuOpen } from './contextmenu.js';
import { decideEscape, ariaLabels } from './keys.js';
import { initResizers } from './resizer.js';
import { applyTheme, cycleTheme, getStoredTheme } from './theme.js';
import { renderHelpContent } from './help.js';
import { TEMPLATES, buildTemplate } from './templates.js';
import { buildFlowSvg, describeFlow } from './flowchart.js';
import { listSnapshots, saveSnapshot, getSnapshot, deleteSnapshot, snapshotsBytes, formatBytes, formatTime, MAX_SNAPSHOTS } from './snapshots.js';
import { loadViewState, saveViewState, captureViewState, applyViewState, restoreScroll } from './viewstate.js';

const APP_VERSION = '2.4.0';
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
function toast(msg, action) {
  clearTimeout(toastTimer);
  toastEl.textContent = '';
  const text = document.createElement('span');
  text.textContent = msg;
  toastEl.appendChild(text);
  if (action && action.label) {
    const b = document.createElement('button');
    b.className = 'toast-action';
    b.textContent = action.label;
    b.addEventListener('click', () => {
      toastEl.classList.remove('show');
      try { action.onClick(); } catch (e) { console.error('[toast action]', e); }
    });
    toastEl.appendChild(b);
  }
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), action ? 5200 : 2000);
}

function showRenderError(err) {
  const bar = document.getElementById('errorBar');
  const txt = document.getElementById('errorText');
  if (!bar || !txt) return;
  txt.textContent = '渲染出错：' + ((err && err.message) || err) + '　数据没有丢，建议先「导出 → 项目 JSON」备份，再刷新页面。';
  bar.hidden = false;
}

const errorCloseBtn = document.getElementById('errorClose');
if (errorCloseBtn) {
  errorCloseBtn.addEventListener('click', () => {
    const bar = document.getElementById('errorBar');
    if (bar) bar.hidden = true;
  });
}

/* ---------------- 保存状态指示 ---------------- */
let lastSaveError = null;
function updateSaveIndicator(state) {
  const dot = document.getElementById('saveDot');
  if (!dot) return;
  dot.classList.toggle('saving', state.saveState === 'saving');
  dot.classList.toggle('error', state.saveState === 'error');
  if (state.saveState === 'error') {
    dot.title = '保存失败：' + (state.saveError || '未知原因');
  } else if (state.saveState === 'saving') {
    dot.title = '保存中…';
  } else {
    dot.title = '已自动保存到本机';
  }
  if (state.saveState === 'error' && state.saveError !== lastSaveError) {
    lastSaveError = state.saveError;
    toast('保存失败：' + state.saveError + '，建议先「导出 → 项目 JSON」备份');
  }
  if (state.saveState === 'saved') lastSaveError = null;
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
const canvas = createCanvas({
  canvasHost,
  nodesLayer,
  hintsLayer,
  store,
  onInspect(node) { openInspect(node); },
  onContextMenu(x, y, nodeId) { openCanvasMenu(x, y, nodeId); }
});

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
  insertComponent(defId) {
    const node = store.insertComponentInstance(defId);
    if (node) toast('已插入组件「' + node.name + '」，拖动它摆位置');
  },
  removeComponent(defId) {
    store.removeComponentDef(defId);
    toast('已删除组件定义；页面里的实例保留，只是不再联动');
  },
  toast
};

/* ---------------- 组件库搜索 ---------------- */
let libKeyword = '';

/* ---------------- 渲染 ---------------- */
function renderAll(reason) {
  projectNameInput.value = store.project.name;
  deviceSelect.value = store.page.deviceId;
  // 只跟位置/尺寸有关的变化：列表类面板不必重建
  const positionOnly = reason === 'move' || reason === 'resize';

  if (!positionOnly) {
    renderPageList(pageListEl, store, handlers);
    renderLayerList(document.getElementById('layerList'), store, handlers);
    renderLibrary(libraryEl, store, handlers, libKeyword);
  }

  canvas.render();

  if (!positionOnly) {
    renderLinks(linksLayer, store);
  }

  // 正在属性面板里打字时不要重建它，否则输入框会失焦
  const active = document.activeElement;
  const typingInPanel = !!(active && inspectorEl.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
  if (!typingInPanel) {
    renderInspector(inspectorEl, store, handlers);
  }
  zoomLabel.textContent = Math.round(store.state.zoom * 100) + '%';
  $('gridBtn').classList.toggle('on', !!store.state.showGrid);
  $('linkBtn').classList.toggle('on', !!store.state.showLinks);
  $('inspectBtn').classList.toggle('on', !!store.state.inspectMode);
  canvasHost.style.cursor = store.state.inspectMode ? 'crosshair' : (store.state.spacePanning ? 'grab' : 'default');

  const guide = document.getElementById('emptyGuide');
  if (guide) guide.hidden = store.page.nodes.length > 0;

  updateSaveIndicator(store.state);
  void reason;
}

store.subscribe((state, reason) => {
  try {
    if (reason === 'zoom') {
      zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
      canvas.applyZoom();
      scheduleViewSave();
      return;
    }
    if (reason === 'save') {
      updateSaveIndicator(state);
      return;
    }
    renderAll(reason);
    scheduleViewSave();
  } catch (err) {
    console.error('[render]', err);
    showRenderError(err);
  }
});

/* 视图状态记忆：缩放 / 选中 / 滚动 */
let viewSaveTimer = null;
const stageScrollEl = document.getElementById('stageScroll');

function scheduleViewSave() {
  clearTimeout(viewSaveTimer);
  viewSaveTimer = setTimeout(() => {
    saveViewState(captureViewState(store, stageScrollEl));
  }, 400);
}

window.addEventListener('beforeunload', () => {
  saveViewState(captureViewState(store, stageScrollEl));
});

if (stageScrollEl) {
  stageScrollEl.addEventListener('scroll', scheduleViewSave, { passive: true });
}

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
  else if (act === 'inspect') store.toggleInspect();
  else if (act === 'theme') cycleTheme();
  else if (act === 'help') openHelp();
});

document.querySelector('.right-actions').addEventListener('click', async (e) => {
  const t = e.target;
  if (!t.dataset || !t.dataset.act) return;
  const act = t.dataset.act;

  if (act === 'preview') return openPreview();
  if (act === 'spec') return openSpec();
  if (act === 'export') return openExportMenu();
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
    loadAssignmentPreset();
    return;
  }
  if (act === 'templates') {
    openTemplates();
    return;
  }
  if (act === 'flow') {
    openFlow();
    return;
  }
  if (act === 'snapshots') {
    openSnapshots();
    return;
  }
});

/** 载入课程作业四页示例 */
function loadAssignmentPreset() {
  if (!confirm('载入课程作业四页示例会覆盖当前项目，继续？')) return;
  store.loadProject(buildAssignmentProject());
  renderAll('restore');
  canvas.fit();
  toast('已载入作业示例（4 页）');
}

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

// 空状态引导里的按钮
const guideEl = document.getElementById('emptyGuide');
if (guideEl) {
  guideEl.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.act === 'preset') loadAssignmentPreset();
  });
}

// 存为组件
const saveComponentBtn = document.getElementById('saveComponentBtn');
if (saveComponentBtn) {
  saveComponentBtn.addEventListener('click', () => {
    if (!store.state.selection.length) {
      toast('先在画布上选中要存成组件的元素');
      return;
    }
    const name = prompt('组件名称', '我的组件');
    if (name === null) return;
    const def = store.addComponentDef(name.trim() || '我的组件');
    if (def) toast('已存为组件「' + def.name + '」，在左上「我的组件」里点它插入实例');
  });
}

// 组件库搜索框
const libSearchEl = document.getElementById('libSearch');
if (libSearchEl) {
  libSearchEl.addEventListener('input', () => {
    libKeyword = libSearchEl.value;
    renderLibrary(libraryEl, store, handlers, libKeyword);
  });
}

/* ---------------- 左栏可拖拽分栏 ---------------- */
// 逻辑在 src/resizer.js，这里只负责初始化

/* ---------------- 键盘 ---------------- */
window.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  const meta = e.ctrlKey || e.metaKey;

  if (e.key === 'Escape') {
    const action = decideEscape({
      menuOpen: isMenuOpen(),
      previewOpen: !$('previewMask').hidden,
      modalOpen: !modal.hidden,
      hasSelection: store.state.selection.length > 0
    });
    if (action === 'close-menu') hideMenu();
    else if (action === 'close-preview') closePreview();
    else if (action === 'close-modal') closeModal();
    else if (action === 'clear-selection') store.select([]);
    if (action !== 'none') e.preventDefault();
    return;
  }

  if (e.code === 'Space') {
    e.preventDefault();
    store.setSpacePanning(true);
    return;
  }
  if (meta && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    store.select(store.page.nodes.map((n) => n.id));
    return;
  }
  if (e.key === '?') {
    e.preventDefault();
    openHelp();
    return;
  }

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
  if (meta && e.key.toLowerCase() === 'g') {
    e.preventDefault();
    if (e.shiftKey) {
      const n = store.ungroupSelected();
      if (n) toast('已解散，拆出 ' + n + ' 个元素');
    } else {
      const g = store.groupSelected();
      toast(g ? '已组合 ' + g.children.length + ' 个元素' : '至少选两个元素才能组合');
    }
    return;
  }
  if (meta && e.key.toLowerCase() === 'c') {
    if (store.state.selection.length) {
      e.preventDefault();
      const n = store.copySelected();
      toast('已复制 ' + n + ' 个元素');
    }
    return;
  }
  if (meta && e.key.toLowerCase() === 'v') {
    e.preventDefault();
    const n = store.pasteClipboard();
    if (n) toast('已粘贴 ' + n + ' 个元素');
    return;
  }
  if (meta && e.key.toLowerCase() === 's') {
    e.preventDefault(); exportProjectJSON(store.project); toast('项目 JSON 已保存'); return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (store.state.selection.length) {
      e.preventDefault();
      const n = store.state.selection.length;
      store.deleteSelected();
      toast('已删除 ' + n + ' 个元素', { label: '撤销', onClick: () => store.undo() });
    }
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

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') store.setSpacePanning(false);
});

/* ---------------- 拖放组件 ---------------- */canvasHost.addEventListener('dragover', (e) => {
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

$('previewClose').addEventListener('click', closePreview);

function closePreview() {
  const mask = $('previewMask');
  if (mask._runtime && mask._runtime.destroy) mask._runtime.destroy();
  mask._runtime = null;
  mask.hidden = true;
}
$('previewRestart').addEventListener('click', () => {
  const mask = $('previewMask');
  if (mask._runtime) mask._runtime.restart();
});

/* ---------------- 版本快照 ---------------- */
function openSnapshots() {
  function renderBody() {
    const wrap = document.createElement('div');
    const list = listSnapshots();

    const desc = document.createElement('div');
    desc.className = 'hint';
    desc.textContent = list.length
      ? ('共 ' + list.length + ' 个版本，占 ' + formatBytes(snapshotsBytes()) + '（最多保留 ' + MAX_SNAPSHOTS + ' 个）')
      : '还没有版本。存一份之后，改崩了可以随时回到这一刻。';
    wrap.appendChild(desc);

    const bar = document.createElement('div');
    bar.className = 'row';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'tb';
    saveBtn.textContent = '＋ 存一个版本';
    saveBtn.style.flex = '1';
    saveBtn.addEventListener('click', () => {
      const name = prompt('版本名称', '第 ' + (listSnapshots().length + 1) + ' 版');
      if (name === null) return;
      const r = saveSnapshot(store.project, name);
      if (!r.ok) { toast('保存失败：' + r.error); return; }
      toast('已保存「' + r.snapshot.name + '」' + (r.dropped ? '，清理了 ' + r.dropped + ' 个旧版本' : ''));
      refresh();
    });
    bar.appendChild(saveBtn);
    wrap.appendChild(bar);

    const listBox = document.createElement('div');
    listBox.className = 'snap-list';
    for (const s of list) {
      const row = document.createElement('div');
      row.className = 'snap-row';

      const info = document.createElement('div');
      info.className = 'snap-info';
      const nameEl = document.createElement('div');
      nameEl.className = 'snap-name';
      nameEl.textContent = s.name;
      const metaEl = document.createElement('div');
      metaEl.className = 'snap-meta';
      metaEl.textContent = formatTime(s.at) + ' · ' + s.pages + ' 页 ' + s.nodes + ' 元素 · ' + formatBytes(s.bytes);
      info.appendChild(nameEl);
      info.appendChild(metaEl);
      row.appendChild(info);

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'tb';
      restoreBtn.textContent = '恢复';
      restoreBtn.addEventListener('click', () => {
        saveSnapshot(store.project, '恢复前自动备份');
        const snap = getSnapshot(s.id);
        if (!snap) { toast('这个版本已经不在了'); return; }
        store.loadProject(snap.project);
        closeModal();
        toast('已恢复到「' + s.name + '」；恢复前的状态也留了一份');
      });
      row.appendChild(restoreBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'mini';
      delBtn.textContent = '✕';
      delBtn.title = '删除这个版本';
      delBtn.addEventListener('click', () => {
        deleteSnapshot(s.id);
        refresh();
      });
      row.appendChild(delBtn);

      listBox.appendChild(row);
    }
    wrap.appendChild(listBox);
    return wrap;
  }

  function refresh() {
    openModal('版本快照', renderBody, () => {
      const box = document.createElement('div');
      box.appendChild(btn('关闭', () => closeModal()));
      return box;
    });
  }

  refresh();
}

/* ---------------- 交互跳转总览 ---------------- */
function openFlow() {
  openModal('交互跳转总览', () => {
    const wrap = document.createElement('div');
    const desc = document.createElement('div');
    desc.className = 'hint';
    desc.textContent = describeFlow(store.project);
    wrap.appendChild(desc);
    const { svg } = buildFlowSvg(store.project);
    wrap.appendChild(svg);
    return wrap;
  }, () => {
    const box = document.createElement('div');
    box.appendChild(btn('关闭', () => closeModal()));
    return box;
  });
}

/* ---------------- 页面模板库 ---------------- */
function applyTemplate(tplId) {
  const tpl = TEMPLATES.find((t) => t.id === tplId);
  if (!tpl) return;
  store.addPage(tpl.name);
  const n = store.appendNodes(buildTemplate(tplId, store.device));
  closeModal();
  toast('已新建「' + tpl.name + '」并放入 ' + n + ' 个元素，直接改就行');
}

function openTemplates() {
  openModal('页面模板', () => {
    const wrap = document.createElement('div');
    wrap.className = 'tpl-grid';
    for (const t of TEMPLATES) {
      const card = document.createElement('button');
      card.className = 'tpl-card';
      const name = document.createElement('div');
      name.className = 'tpl-name';
      name.textContent = t.name;
      const desc = document.createElement('div');
      desc.className = 'tpl-desc';
      desc.textContent = t.desc;
      card.appendChild(name);
      card.appendChild(desc);
      card.addEventListener('click', () => applyTemplate(t.id));
      wrap.appendChild(card);
    }
    return wrap;
  }, () => {
    const box = document.createElement('div');
    box.appendChild(btn('取消', () => closeModal()));
    return box;
  });
}

/* ---------------- 右键菜单 ---------------- */
function openCanvasMenu(x, y, nodeId) {
  const node = nodeId ? store.nodeById(nodeId) : null;
  const sel = store.selectedNodes;
  const items = [];

  if (node) {
    items.push({ label: '复制一份', hint: 'Ctrl+D', action: () => store.duplicateSelected() });
    items.push({ label: '复制', hint: 'Ctrl+C', action: () => { const n = store.copySelected(); if (n) toast('已复制 ' + n + ' 个元素'); } });
    items.push({
      label: '删除',
      hint: 'Del',
      danger: true,
      action: () => {
        const n = store.state.selection.length;
        store.deleteSelected();
        toast('已删除 ' + n + ' 个元素', { label: '撤销', onClick: () => store.undo() });
      }
    });
    items.push({ divider: true });
    items.push({ label: '上移一层', action: () => store.bringForward(node.id) });
    items.push({ label: '下移一层', action: () => store.sendBackward(node.id) });
    items.push({ label: '置顶', action: () => store.bringToFront(node.id) });
    items.push({ label: '置底', action: () => store.sendToBack(node.id) });
    items.push({ divider: true });
    if (sel.length >= 2) {
      items.push({
        label: '组合选中（' + sel.length + ' 个）',
        hint: 'Ctrl+G',
        action: () => { const g = store.groupSelected(); if (g) toast('已组合 ' + g.children.length + ' 个元素'); }
      });
    }
    if (node.type === 'group') {
      items.push({
        label: '解散分组',
        hint: 'Ctrl+Shift+G',
        action: () => { const n = store.ungroupSelected(); if (n) toast('已解散，拆出 ' + n + ' 个元素'); }
      });
    }
    items.push({ label: node.locked ? '解锁' : '锁定', action: () => store.updateNode(node.id, { locked: !node.locked }) });
    items.push({ label: node.hidden ? '显示' : '隐藏', action: () => store.updateNode(node.id, { hidden: !node.hidden }) });
  } else {
    items.push({
      label: '粘贴',
      hint: 'Ctrl+V',
      disabled: !(store.clipboard && store.clipboard.length),
      action: () => { const n = store.pasteClipboard(); if (n) toast('已粘贴 ' + n + ' 个元素'); }
    });
    items.push({ label: '全选', hint: 'Ctrl+A', action: () => store.select(store.page.nodes.map((n) => n.id)) });
    items.push({ divider: true });
    items.push({ label: '适应窗口', action: () => canvas.fit() });
    items.push({
      label: '清空本页',
      danger: true,
      action: () => {
        const total = store.page.nodes.length;
        if (!total) return;
        store.select(store.page.nodes.map((n) => n.id));
        store.deleteSelected();
        toast('已清空 ' + total + ' 个元素', { label: '撤销', onClick: () => store.undo() });
      }
    });
  }

  openMenu(x, y, items);
}

/* ---------------- 帮助 ---------------- */
function openHelp() {
  openModal('帮助与快捷键', () => renderHelpContent('v' + APP_VERSION), () => {
    const box = document.createElement('div');
    box.appendChild(btn('知道了', () => closeModal()));
    return box;
  });
}

/* ---------------- 标注模式 ---------------- */
function openInspect(node) {
  const spec = buildNodeSpecText(node);
  openModal('标注 · ' + (node.text || node.type), () => {
    const wrap = document.createElement('div');
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = '标注模式下点元素即可查看规格；可以复制给开发，也可以只导出这个元素的切图。';
    const ta = document.createElement('textarea');
    ta.value = spec;
    ta.readOnly = true;
    ta.style.minHeight = '220px';
    wrap.appendChild(hint);
    wrap.appendChild(ta);
    return wrap;
  }, () => {
    const box = document.createElement('div');
    box.style.cssText = 'display:flex;gap:8px;';
    box.appendChild(btn('复制规格', async () => {
      try {
        await navigator.clipboard.writeText(spec);
        toast('已复制');
      } catch (e) { toast('复制失败，请手动选中'); }
    }));
    box.appendChild(btn('导出切图', async () => {
      try {
        await exportNodePNG(node, store.project.name);
        toast('切图已导出');
      } catch (e) { toast('失败：' + e.message); }
    }));
    return box;
  });
}

/* ---------------- 导出菜单 ---------------- */
function openExportMenu() {
  const pageCount = store.project.pages.length;
  const items = [
    {
      label: '当前页 PNG（2 倍图）',
      desc: '把「' + store.page.name + '」导出成图片，可直接贴进作业或文档',
      run: async () => {
        await exportPagePNG(store.page, store.project.name);
        toast('已导出当前页 PNG');
      }
    },
    {
      label: '全部页面 PNG（' + pageCount + ' 张）',
      desc: '逐页导出，浏览器会连续下载多个文件',
      run: async () => {
        const n = await exportAllPagesPNG(store.project, (i, total, name) => {
          toast('导出中 ' + i + '/' + total + '：' + name);
        });
        toast('已导出 ' + n + ' 张 PNG');
      }
    },
    {
      label: '当前页所有元素切图（' + store.page.nodes.filter((n) => !n.hidden).length + ' 个）',
      desc: '逐个元素导出 2 倍图，文件名带类型和序号，适合要交「组件切图」的作业',
      run: async () => {
        const nodes = store.page.nodes.filter((n) => !n.hidden);
        if (!nodes.length) { toast('本页还没有元素'); return; }
        for (let i = 0; i < nodes.length; i += 1) {
          toast('切图中 ' + (i + 1) + ' / ' + nodes.length);
          await exportNodePNG(nodes[i], store.project.name);
          await new Promise((r) => setTimeout(r, 220));
        }
        toast('已导出 ' + nodes.length + ' 张元素切图');
      }
    },
    {
      label: '当前页所有图标 → SVG',
      desc: '把本页图标导出成矢量 SVG（单 path，可再编辑），适合交「图标切图」',
      run: () => {
        const icons = store.page.nodes.filter((n) => n.type === 'icon' && !n.hidden);
        if (!icons.length) { toast('本页没有图标元素'); return; }
        icons.forEach((n, i) => {
          setTimeout(() => { exportIconSVG(n, store.project.name); }, i * 260);
        });
        toast('正在导出 ' + icons.length + ' 个图标 SVG');
      }
    },
    {
      label: '离线演示 HTML',
      desc: '单文件，双击即演示，跳转/显隐/状态切换都能点，可以直接发给老师或同学',
      run: () => {
        const size = downloadStandaloneHtml(store.project);
        toast('已导出演示 HTML（' + Math.round(size / 1024) + ' KB）');
      }
    },
    {
      label: '全部页面 PDF',
      desc: '每页一张、按画布尺寸排版，可直接打印或投屏',
      run: async () => {
        const size = await downloadProjectPDF(store.project, (i, total, name) => {
          toast('生成 PDF ' + i + '/' + total + '：' + name);
        });
        toast('PDF 已导出（' + Math.round(size / 1024) + ' KB）');
      }
    },
    {
      label: '项目 JSON',
      desc: '源文件，之后可再导入继续编辑',
      run: () => {
        exportProjectJSON(store.project);
        toast('项目 JSON 已保存');
      }
    }
  ];

  openModal('导出 / 交付', () => {
    const wrap = document.createElement('div');
    for (const it of items) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:12px;align-items:center;padding:11px 12px;border:1px solid var(--line);border-radius:8px;margin-bottom:8px;cursor:pointer;';
      row.addEventListener('mouseenter', () => { row.style.borderColor = 'var(--accent)'; });
      row.addEventListener('mouseleave', () => { row.style.borderColor = 'var(--line)'; });

      const box = document.createElement('div');
      const title = document.createElement('div');
      title.style.cssText = 'font-size:13px;color:var(--text)';
      title.textContent = it.label;
      const desc = document.createElement('div');
      desc.style.cssText = 'font-size:11px;color:var(--text-dim);margin-top:3px';
      desc.textContent = it.desc;
      box.appendChild(title);
      box.appendChild(desc);
      row.appendChild(box);

      row.addEventListener('click', async () => {
        closeModal();
        try { await it.run(); } catch (e) { toast('失败：' + e.message); }
      });
      wrap.appendChild(row);
    }
    return wrap;
  });
}

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
  const urlTheme = (/[?&]theme=(dark|light|auto)/.exec(location.search) || [])[1];
  applyTheme(urlTheme || getStoredTheme());
  const autoPreset = /[?&]preset=(1|demo)/.test(location.search);
  const autoEmpty = /[?&]empty=1/.test(location.search);
  if (autoPreset) {
    store.loadProject(buildAssignmentProject());
  } else if (autoEmpty) {
    // 保持空项目，用于看空状态引导
  } else {
    const loaded = store.loadFromStorage();
    if (!loaded) seedFirstProject();
  }
  // 恢复上次的缩放与选中（示例/空项目模式不恢复，避免干扰）
  const view = (autoPreset || autoEmpty) ? null : loadViewState();
  const restored = view ? applyViewState(store, view) : null;

  if (/[?&]inspect=1/.test(location.search)) store.state.inspectMode = true;

  try {
    renderAll('boot');
    initResizers();
    ariaLabels();
  } catch (err) {
    console.error('[boot]', err);
    showRenderError(err);
  }

  if (store.state.lastLoadError) {
    toast('上次的项目数据读不出来（原始数据已另存备份），已新建空白项目');
  }
  if (view) restoreScroll(stageScrollEl, view);

  if (/[?&]help=1/.test(location.search)) {
    setTimeout(openHelp, 60);
  }
  if (/[?&]templates=1/.test(location.search)) {
    setTimeout(openTemplates, 80);
  }
  if (/[?&]flow=1/.test(location.search)) {
    setTimeout(openFlow, 100);
  }
  if (/[?&]snapshots=1/.test(location.search)) {
    setTimeout(openSnapshots, 120);
  }

  requestAnimationFrame(() => {
    if (restored && restored.zoom) {
      canvas.applyZoom();
    } else {
      canvas.fit();
    }
    zoomLabel.textContent = Math.round(store.state.zoom * 100) + '%';
  });

  window.addEventListener('resize', () => {
    if (store.state.fitRequested) canvas.fit();
  });

  console.log('[modao-open] ready', store.project.pages.length, 'pages');
}

boot();
