/**
 * 状态仓库：项目数据 + 选择 + 视图状态，带撤销/重做与本地持久化。
 * 所有修改都走 mutate()，保证快照一致。
 */

import { createProject, createPage, createNode, getDevice, resolveDevice, cloneNode, normalizeProject, uid } from './model.js';

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
      inspectMode: false,
      spacePanning: false,
      fitRequested: true
    };
    this.listeners = new Set();
    this.undoStack = [];
    this.redoStack = [];
    this.clipboard = [];
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

  get device() { return resolveDevice(this.page); }

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
    // 只有调用方没指定 y 时才自动找空位（拖放到画布时必须尊重落点）
    if (patch.y === undefined) node.y = this.nextFreeY(node.h);
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

  /* ---------- 组件状态（动态组件 · 外观变体） ---------- */
  addState(nodeId, name) {
    const node = this.nodeById(nodeId);
    if (!node) return null;
    const st = {
      id: uid('s'),
      name: name || ('状态 ' + ((node.states ? node.states.length : 0) + 1)),
      style: {}
    };
    this.mutate(() => {
      if (!node.states) node.states = [];
      node.states.push(st);
      node.activeStateId = st.id;
    }, { reason: 'state' });
    return st;
  }

  setActiveState(nodeId, stateId) {
    const node = this.nodeById(nodeId);
    if (!node || !node.states) return;
    this.mutate(() => { node.activeStateId = stateId; }, { reason: 'state' });
  }

  removeState(nodeId, stateId) {
    const node = this.nodeById(nodeId);
    if (!node || !node.states) return;
    this.mutate(() => {
      node.states = node.states.filter((s) => s.id !== stateId);
      if (!node.states.length) { node.states = null; node.activeStateId = null; return; }
      if (node.activeStateId === stateId) node.activeStateId = node.states[0].id;
    }, { reason: 'state' });
  }

  renameState(nodeId, stateId, name) {
    const node = this.nodeById(nodeId);
    if (!node || !node.states) return;
    this.mutate(() => {
      for (const s of node.states) if (s.id === stateId) s.name = name;
    }, { reason: 'state' });
  }

  /** 把当前外观存进某个状态（覆盖该状态的 style） */
  captureStateStyle(nodeId, stateId, keys) {
    const node = this.nodeById(nodeId);
    if (!node || !node.states) return;
    const style = {};
    for (const k of keys) style[k] = node[k];
    this.mutate(() => {
      for (const s of node.states) if (s.id === stateId) s.style = style;
    }, { reason: 'state' });
  }

  /* ---------- 组合 / 解组 ---------- */
  makeGroupNode(x, y, w, h) {
    return {
      id: uid('g'),
      type: 'group',
      name: '分组',
      x, y, w, h,
      rotation: 0,
      opacity: 1,
      bg: 'transparent',
      radius: 0,
      borderWidth: 0,
      borderColor: '#e5e5e5',
      shadow: 'none',
      text: '',
      fontSize: 16,
      fontWeight: 400,
      color: '#222222',
      align: 'left',
      verticalAlign: 'center',
      lineHeight: 1.4,
      paddingX: 0,
      src: '',
      locked: false,
      hidden: false,
      states: null,
      activeStateId: null,
      link: null,
      children: []
    };
  }

  /** 把当前选中的多个元素打成一个组 */
  groupSelected() {
    const nodes = this.selectedNodes;
    if (nodes.length < 2) return null;

    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;
    for (const n of nodes) {
      x1 = Math.min(x1, n.x);
      y1 = Math.min(y1, n.y);
      x2 = Math.max(x2, n.x + n.w);
      y2 = Math.max(y2, n.y + n.h);
    }

    const group = this.makeGroupNode(Math.round(x1), Math.round(y1), Math.round(x2 - x1), Math.round(y2 - y1));
    const ids = new Set(nodes.map((n) => n.id));

    this.mutate(() => {
      const page = this.page;
      const kept = [];
      for (const n of page.nodes) {
        if (ids.has(n.id)) {
          n.x = n.x - group.x;
          n.y = n.y - group.y;
          group.children.push(n);
        } else {
          kept.push(n);
        }
      }
      kept.push(group);
      page.nodes = kept;
    }, { reason: 'group' });

    this.select([group.id]);
    return group;
  }

  /** 解散选中的组，子元素回到页面坐标 */
  ungroupSelected() {
    const groups = this.selectedNodes.filter((n) => n.type === 'group' && Array.isArray(n.children) && n.children.length);
    if (!groups.length) return 0;
    let count = 0;

    this.mutate(() => {
      const page = this.page;
      const next = [];
      for (const n of page.nodes) {
        if (groups.indexOf(n) >= 0) {
          for (const c of n.children) {
            c.x = c.x + n.x;
            c.y = c.y + n.y;
            next.push(c);
            count += 1;
          }
        } else {
          next.push(n);
        }
      }
      page.nodes = next;
    }, { reason: 'ungroup' });

    this.select([]);
    return count;
  }

  isGrouped(node) {
    return !!(node && node.type === 'group' && Array.isArray(node.children));
  }

  /* ---------- 剪贴板 ---------- */
  copySelected() {
    const nodes = this.selectedNodes;
    if (!nodes.length) return 0;
    this.clipboard = JSON.parse(JSON.stringify(nodes));
    return nodes.length;
  }

  pasteClipboard() {
    const cb = this.clipboard;
    if (!cb || !cb.length) return 0;
    const copies = cb.map((n) => {
      const c = JSON.parse(JSON.stringify(n));
      c.id = uid();
      c.x = (c.x || 0) + 16;
      c.y = (c.y || 0) + 16;
      return c;
    });
    this.mutate(() => { this.page.nodes.push(...copies); }, { reason: 'paste' });
    this.select(copies.map((c) => c.id));
    this.clipboard = copies.map((c) => JSON.parse(JSON.stringify(c)));
    return copies.length;
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
        if (p.id === project.activePageId) {
          p.deviceId = getDevice(deviceId).id;
          p.customW = null;
          p.customH = null;
        }
      }
    }, { reason: 'device' });
  }

  /** 页面级自定义画布尺寸 */
  setCustomSize(w, h) {
    const W = Math.max(120, Math.min(4000, Math.round(Number(w) || 0)));
    const H = Math.max(200, Math.min(6000, Math.round(Number(h) || 0)));
    this.mutate(() => {
      this.page.customW = W;
      this.page.customH = H;
    }, { reason: 'device' });
  }

  clearCustomSize() {
    this.mutate(() => {
      this.page.customW = null;
      this.page.customH = null;
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

  /** 标注模式：点元素看规格、导切图 */
  toggleInspect() {
    this.state.inspectMode = !this.state.inspectMode;
    this.emit('view');
  }

  /** 空格按住进入平移模式 */
  setSpacePanning(on) {
    if (this.state.spacePanning === on) return;
    this.state.spacePanning = on;
    this.emit('view');
  }

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
