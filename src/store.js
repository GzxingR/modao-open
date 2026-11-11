/**
 * 状态仓库：项目数据 + 选择 + 视图状态，带撤销/重做与本地持久化。
 * 所有修改都走 mutate()，保证快照一致。
 */

import { createProject, createPage, createNode, getDevice, cloneNode, normalizeProject } from './model.js';

const STORAGE_KEY = 'modao-open:project:v1';

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

export class Store {
  constructor() {
    this.state = {
      project: createProject(),
      selection: [],          // 选中节点 id 数组
      zoom: 1,
      showGrid: true,
      showLinks: true,
      fitRequested: true
    };
    this.listeners = new Set();
    this.undoStack = [];
    this.redoStack = [];
    this.pending = false;
    this.maxHistory = 80;
  }

  /* ---------- 订阅 ---------- */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(reason = 'change') {
    for (const fn of this.listeners) {
      try { fn(this.state, reason); } catch (e) { console.error('[store] listener error', e); }
    }
  }

  /* ---------- 基础访问 ---------- */
  get project() { return this.state.project; }

  get page() {
    const id = this.state.project.activePageId;
    return this.state.project.pages.find((p) => p.id === id) || this.state.project.pages[0];
  }

  get device() { return getDevice(this.page.deviceId); }

  get selectedNodes() {
    const ids = new Set(this.state.selection);
    return this.page.nodes.filter((n) => ids.has(n.id));
  }

  get selectedNode() { return this.selectedNodes[0] || null; }

  nodeById(id) { return this.page.nodes.find((n) => n.id === id) || null; }

  isSelected(id) { return this.state.selection.indexOf(id) >= 0; }

  /* ---------- 历史 ---------- */
  snapshot() {
    return JSON.stringify({ project: this.state.project, activePageId: this.state.project.activePageId });
  }

  pushHistory() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo() {
    if (!this.undoStack.length) return false;
    this.redoStack.push(this.snapshot());
    this.restore(this.undoStack.pop());
    return true;
  }

  redo() {
    if (!this.redoStack.length) return false;
    this.undoStack.push(this.snapshot());
    this.restore(this.redoStack.pop());
    return true;
  }

  restore(json) {
    const data = JSON.parse(json);
    this.state.project = data.project;
    this.state.selection = [];
    this.emit('restore');
    this.persist();
  }

  /**
   * 统一修改入口。history=true 时先压栈（一次用户操作 = 一条历史）。
   */
  mutate(fn, options = {}) {
    const { history = true, reason = 'mutate' } = options;
    if (history) this.pushHistory();
    fn(this.state.project, this.state);
    this.emit(reason);
    this.persist();
  }

  /* ---------- 选择 ---------- */
  select(ids, additive = false) {
    const list = Array.isArray(ids) ? ids : (ids ? [ids] : []);
    if (additive) {
      const set = new Set(this.state.selection);
      for (const id of list) {
        if (set.has(id)) set.delete(id); else set.add(id);
      }
      this.state.selection = Array.from(set);
    } else {
      this.state.selection = list.slice();
    }
    this.emit('selection');
  }

  clearSelection() { this.select([]); }

  /* ---------- 节点操作 ---------- */
  addNode(type, patch = {}) {
    const device = this.device;
    const node = createNode(type, device, patch);
    node.y = this.nextFreeY(node.h);
    this.mutate((project) => {
      const page = this.page;
      page.nodes.push(node);
    }, { reason: 'add-node' });
    this.select([node.id]);
    return node;
  }

  addNodeObject(node) {
    this.mutate(() => { this.page.nodes.push(node); }, { reason: 'add-node' });
    this.select([node.id]);
    return node;
  }

  nextFreeY(h) {
    const nodes = this.page.nodes;
    if (!nodes.length) return 80;
    let maxBottom = 0;
    for (const n of nodes) if (!n.hidden) maxBottom = Math.max(maxBottom, n.y + n.h);
    return Math.min(maxBottom + 16, Math.max(80, this.device.h - h - 24));
  }

  updateNode(id, patch, options = {}) {
    const node = this.nodeById(id);
    if (!node) return;
    this.mutate(() => { Object.assign(node, patch); }, options);
  }

  updateSelected(patch, options = {}) {
    const nodes = this.selectedNodes;
    if (!nodes.length) return;
    this.mutate(() => { for (const n of nodes) Object.assign(n, patch); }, options);
  }

  deleteSelected() {
    if (!this.state.selection.length) return;
    const ids = new Set(this.state.selection);
    this.mutate(() => {
      const page = this.page;
      page.nodes = page.nodes.filter((n) => !ids.has(n.id));
    }, { reason: 'delete' });
    this.state.selection = [];
    this.emit('selection');
  }

  duplicateSelected() {
    const nodes = this.selectedNodes;
    if (!nodes.length) return;
    const copies = nodes.map((n) => {
      const c = cloneNode(n);
      c.x = n.x + 16;
      c.y = n.y + 16;
      return c;
    });
    this.mutate(() => { this.page.nodes.push(...copies); }, { reason: 'duplicate' });
    this.select(copies.map((c) => c.id));
  }

  /* 层级 */
  bringForward(id) {
    const list = this.page.nodes;
    const i = list.findIndex((n) => n.id === id);
    if (i < 0 || i === list.length - 1) return;
    this.mutate(() => { const [n] = list.splice(i, 1); list.splice(i + 1, 0, n); }, { reason: 'order' });
  }

  sendBackward(id) {
    const list = this.page.nodes;
    const i = list.findIndex((n) => n.id === id);
    if (i <= 0) return;
    this.mutate(() => { const [n] = list.splice(i, 1); list.splice(i - 1, 0, n); }, { reason: 'order' });
  }

  bringToFront(id) {
    const list = this.page.nodes;
    const i = list.findIndex((n) => n.id === id);
    if (i < 0 || i === list.length - 1) return;
    this.mutate(() => { const [n] = list.splice(i, 1); list.push(n); }, { reason: 'order' });
  }

  sendToBack(id) {
    const list = this.page.nodes;
    const i = list.findIndex((n) => n.id === id);
    if (i <= 0) return;
    this.mutate(() => { const [n] = list.splice(i, 1); list.unshift(n); }, { reason: 'order' });
  }

  /* ---------- 对齐（基于当前选中，或用画布） ---------- */
  align(kind) {
    const nodes = this.selectedNodes;
    if (!nodes.length) return;
    const dev = this.device;
    const bounds = this.selectionBounds();
    this.mutate(() => {
      for (const n of nodes) {
        if (kind === 'left') n.x = 16;
        else if (kind === 'right') n.x = dev.w - 16 - n.w;
        else if (kind === 'hcenter') n.x = Math.round((dev.w - n.w) / 2);
        else if (kind === 'top') n.y = 16;
        else if (kind === 'bottom') n.y = dev.h - 16 - n.h;
        else if (kind === 'vcenter') n.y = Math.round((dev.h - n.h) / 2);
        else if (kind === 'distribute-h' && nodes.length > 1) { /* 下面单独处理 */ }
        else if (kind === 'distribute-v' && nodes.length > 1) { /* 下面单独处理 */ }
      }
      if (kind === 'distribute-h' && nodes.length > 1) {
        const sorted = nodes.slice().sort((a, b) => a.x - b.x);
        const left = sorted[0].x;
        const right = sorted[sorted.length - 1].x + sorted[sorted.length - 1].w;
        const totalW = sorted.reduce((s, n) => s + n.w, 0);
        const gap = (right - left - totalW) / (sorted.length - 1);
        let cursor = left;
        for (const n of sorted) { n.x = Math.round(cursor); cursor += n.w + gap; }
      }
      if (kind === 'distribute-v' && nodes.length > 1) {
        const sorted = nodes.slice().sort((a, b) => a.y - b.y);
        const top = sorted[0].y;
        const bottom = sorted[sorted.length - 1].y + sorted[sorted.length - 1].h;
        const totalH = sorted.reduce((s, n) => s + n.h, 0);
        const gap = (bottom - top - totalH) / (sorted.length - 1);
        let cursor = top;
        for (const n of sorted) { n.y = Math.round(cursor); cursor += n.h + gap; }
      }
      void bounds;
    }, { reason: 'align' });
  }

  selectionBounds() {
    const nodes = this.selectedNodes;
    if (!nodes.length) return null;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const n of nodes) {
      x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y);
      x2 = Math.max(x2, n.x + n.w); y2 = Math.max(y2, n.y + n.h);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  /* ---------- 页面 ---------- */
  addPage(name) {
    const page = createPage(name || ('页面 ' + (this.project.pages.length + 1)), this.page.deviceId);
    this.mutate((project) => {
      project.pages.push(page);
      project.activePageId = page.id;
    }, { reason: 'page' });
    this.state.selection = [];
    this.emit('selection');
    return page;
  }

  deletePage(id) {
    if (this.project.pages.length <= 1) return false;
    this.mutate((project) => {
      project.pages = project.pages.filter((p) => p.id !== id);
      if (project.activePageId === id) project.activePageId = project.pages[0].id;
    }, { reason: 'page' });
    this.state.selection = [];
    this.emit('selection');
    return true;
  }

  setActivePage(id) {
    if (this.page.id === id) return;
    this.mutate((project) => { project.activePageId = id; }, { history: false, reason: 'page' });
    this.state.selection = [];
    this.emit('selection');
  }

  renamePage(id, name) {
    const page = this.project.pages.find((p) => p.id === id);
    if (!page) return;
    this.mutate(() => { page.name = name; }, { reason: 'page' });
  }

  setDevice(deviceId) {
    this.mutate((project) => {
      for (const p of project.pages) {
        if (p.id === project.activePageId) p.deviceId = getDevice(deviceId).id;
      }
    }, { reason: 'device' });
  }

  setProjectName(name) {
    this.mutate((project) => { project.name = name; }, { reason: 'meta' });
  }

  setPageBg(color) {
    this.mutate(() => { this.page.bg = color; }, { reason: 'meta' });
  }

  /* ---------- 视图 ---------- */
  setZoom(z) {
    this.state.zoom = Math.max(0.1, Math.min(3, z));
    this.state.fitRequested = false;
    this.emit('zoom');
  }

  requestFit() {
    this.state.fitRequested = true;
    this.emit('zoom');
  }

  toggleGrid() { this.state.showGrid = !this.state.showGrid; this.emit('view'); }

  toggleLinks() { this.state.showLinks = !this.state.showLinks; this.emit('view'); }

  /* ---------- 持久化 ---------- */
  persist() {
    try {
      const payload = JSON.stringify(this.project);
      localStorage.setItem(STORAGE_KEY, payload);
    } catch (e) {
      console.warn('[store] 保存失败', e);
    }
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      this.state.project = normalizeProject(JSON.parse(raw));
      this.state.selection = [];
      this.emit('restore');
      return true;
    } catch (e) {
      console.warn('[store] 读取本地项目失败', e);
      return false;
    }
  }

  loadProject(raw) {
    this.state.project = normalizeProject(raw);
    this.state.selection = [];
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.emit('restore');
    this.persist();
  }

  exportJSON() {
    return JSON.stringify(this.project, null, 2);
  }
}

export const store = new Store();
