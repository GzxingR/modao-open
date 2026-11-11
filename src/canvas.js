/**
 * 画布：渲染、选择、拖拽、缩放、对齐参考线、缩放比例
 */

import { createNodeEl } from './nodes.js';

const SNAP = 4;

export function createCanvas(ctx) {
  const { canvasHost, nodesLayer, hintsLayer, store } = ctx;

  let dragging = null;   // { startX, startY, items:[{node,x,y}], moved }
  let resizing = null;   // { id, dir, startX, startY, origin }
  let nodeEls = new Map();

  /* ---------------- 渲染 ---------------- */

  function render() {
    const page = store.page;
    const device = store.device;
    canvasHost.style.width = device.w + 'px';
    canvasHost.style.height = device.h + 'px';
    canvasHost.style.background = page.bg || '#ffffff';
    canvasHost.classList.toggle('grid', !!store.state.showGrid);

    nodesLayer.textContent = '';
    nodeEls = new Map();

    for (const node of page.nodes) {
      const el = createNodeEl(node, { interactive: true });
      if (store.isSelected(node.id)) el.classList.add('sel');
      if (node.locked) el.classList.add('locked');
      el.addEventListener('pointerdown', (e) => onNodePointerDown(e, node));
      nodesLayer.appendChild(el);
      nodeEls.set(node.id, el);
    }

    renderSelectionHandles();
    applyZoom();
  }

  function renderSelectionHandles() {
    for (const [id, el] of nodeEls) {
      const old = el.querySelectorAll(':scope > .handle');
      for (const o of old) o.remove();
      if (!store.isSelected(id)) continue;
      const node = store.nodeById(id);
      if (!node || node.locked) continue;
      for (const dir of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
        const h = document.createElement('div');
        h.className = 'handle ' + dir;
        h.dataset.dir = dir;
        h.addEventListener('pointerdown', (e) => onHandlePointerDown(e, node, dir));
        el.appendChild(h);
      }
    }
  }

  /* ---------------- 缩放 ---------------- */

  function applyZoom() {
    const z = store.state.zoom;
    canvasHost.style.transform = 'scale(' + z + ')';
    const wrap = canvasHost.parentElement;
    if (wrap) {
      wrap.style.width = (store.device.w * z) + 'px';
      wrap.style.height = (store.device.h * z) + 'px';
    }
  }

  function fit() {
    const scroller = document.getElementById('stageScroll');
    if (!scroller) return;
    const pad = 64;
    const availW = Math.max(120, scroller.clientWidth - pad);
    const availH = Math.max(120, scroller.clientHeight - pad);
    const dev = store.device;
    const z = Math.min(availW / dev.w, availH / dev.h);
    store.state.zoom = Math.max(0.1, Math.min(2, z));
    store.state.fitRequested = false;
    applyZoom();
    store.emit('zoom');
  }

  /* ---------------- 选择 ---------------- */

  function hitTest(target) {
    let el = target;
    while (el && el !== nodesLayer) {
      if (el.dataset && el.dataset.id) return el.dataset.id;
      el = el.parentElement;
    }
    return null;
  }

  let marquee = null;

  function onCanvasPointerDown(e) {
    if (e.button !== 0) return;
    const id = hitTest(e.target);
    if (id) return; // 点到节点，由节点自己处理

    // 点到空白：立即清空选择（shift 保留，用于框选追加）
    if (!e.shiftKey) store.clearSelection();

    const rect = canvasHost.getBoundingClientRect();
    const zoom = store.state.zoom;
    const sx = (e.clientX - rect.left) / zoom;
    const sy = (e.clientY - rect.top) / zoom;
    marquee = { sx, sy, cx: sx, cy: sy, additive: !!e.shiftKey, box: null, moved: false };
    window.addEventListener('pointermove', onMarqueeMove);
    window.addEventListener('pointerup', onMarqueeUp, { once: true });
  }

  function onMarqueeMove(e) {
    if (!marquee) return;
    const rect = canvasHost.getBoundingClientRect();
    const zoom = store.state.zoom;
    marquee.cx = (e.clientX - rect.left) / zoom;
    marquee.cy = (e.clientY - rect.top) / zoom;
    if (Math.abs(marquee.cx - marquee.sx) > 3 || Math.abs(marquee.cy - marquee.sy) > 3) marquee.moved = true;
    if (!marquee.moved) return;

    if (!marquee.box) {
      const box = document.createElement('div');
      box.style.position = 'absolute';
      box.style.border = '1px dashed #1677ff';
      box.style.background = 'rgba(22,119,255,0.08)';
      box.style.pointerEvents = 'none';
      box.style.zIndex = '8';
      hintsLayer.appendChild(box);
      marquee.box = box;
    }
    const x = Math.min(marquee.sx, marquee.cx);
    const y = Math.min(marquee.sy, marquee.cy);
    marquee.box.style.left = x + 'px';
    marquee.box.style.top = y + 'px';
    marquee.box.style.width = Math.abs(marquee.cx - marquee.sx) + 'px';
    marquee.box.style.height = Math.abs(marquee.cy - marquee.sy) + 'px';
  }

  function onMarqueeUp() {
    window.removeEventListener('pointermove', onMarqueeMove);
    if (!marquee) return;
    const m = marquee;
    marquee = null;
    if (m.box) m.box.remove();

    if (!m.moved) {
      return; // 只是单击空白，上面已经在 pointerdown 时清空了选择
    }

    const x1 = Math.min(m.sx, m.cx);
    const x2 = Math.max(m.sx, m.cx);
    const y1 = Math.min(m.sy, m.cy);
    const y2 = Math.max(m.sy, m.cy);
    const hits = store.page.nodes
      .filter((n) => !n.hidden && !(n.x > x2 || n.x + n.w < x1 || n.y > y2 || n.y + n.h < y1))
      .map((n) => n.id);
    store.select(hits, m.additive);
  }

  function onNodePointerDown(e, node) {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (node.locked) return;

    if (e.shiftKey) {
      store.select([node.id], true);
    } else if (!store.isSelected(node.id)) {
      store.select([node.id]);
    }
    renderSelectionHandles();
    for (const [id, el] of nodeEls) el.classList.toggle('sel', store.isSelected(id));

    const zoom = store.state.zoom;
    const items = store.selectedNodes.map((n) => ({ id: n.id, x: n.x, y: n.y }));
    dragging = { startX: e.clientX, startY: e.clientY, items, moved: false, pushed: false, zoom };
    e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp, { once: true });
  }

  function onDragMove(e) {
    if (!dragging) return;
    const dx = (e.clientX - dragging.startX) / dragging.zoom;
    const dy = (e.clientY - dragging.startY) / dragging.zoom;
    if (!dragging.moved && Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    if (!dragging.moved) {
      dragging.moved = true;
      store.pushHistory();
    }

    const primary = dragging.items[0];
    const target = { x: Math.round(primary.x + dx), y: Math.round(primary.y + dy) };
    const snapped = snapNode(primary.id, target, dragging.items);

    for (const item of dragging.items) {
      const node = store.nodeById(item.id);
      if (!node) continue;
      const isPrimary = item.id === primary.id;
      node.x = isPrimary ? snapped.x : Math.round(item.x + dx + (snapped.x - target.x));
      node.y = isPrimary ? snapped.y : Math.round(item.y + dy + (snapped.y - target.y));
      const el = nodeEls.get(node.id);
      if (el) {
        el.style.left = node.x + 'px';
        el.style.top = node.y + 'px';
      }
    }
    renderHints(snapped.hints);
  }

  function onDragUp() {
    window.removeEventListener('pointermove', onDragMove);
    if (dragging && dragging.moved) {
      dragging = null;
      clearHints();
      store.emit('move');
      store.persist();
      render();
      return;
    }
    dragging = null;
    clearHints();
  }

  /* ---------------- 对齐吸附 ---------------- */

  function snapNode(id, pos, items) {
    const exclude = new Set(items.map((i) => i.id));
    const node = store.nodeById(id);
    if (!node) return { x: pos.x, y: pos.y, hints: [] };
    const device = store.device;
    const targets = [];

    // 画布中心与边距
    targets.push({ kind: 'v', value: Math.round(device.w / 2), label: '画布中心' });
    targets.push({ kind: 'v', value: 16, label: '左边距' });
    targets.push({ kind: 'v', value: device.w - 16, label: '右边距' });
    targets.push({ kind: 'h', value: 16, label: '上边距' });
    targets.push({ kind: 'h', value: device.h - 16, label: '下边距' });

    for (const other of store.page.nodes) {
      if (exclude.has(other.id) || other.hidden) continue;
      targets.push({ kind: 'v', value: other.x, label: other.name || other.type });
      targets.push({ kind: 'v', value: other.x + other.w / 2, label: other.name || other.type });
      targets.push({ kind: 'v', value: other.x + other.w, label: other.name || other.type });
      targets.push({ kind: 'h', value: other.y, label: other.name || other.type });
      targets.push({ kind: 'h', value: other.y + other.h / 2, label: other.name || other.type });
      targets.push({ kind: 'h', value: other.y + other.h, label: other.name || other.type });
    }

    const hints = [];
    let x = pos.x;
    let y = pos.y;

    const myV = [pos.x, pos.x + node.w / 2, pos.x + node.w];
    const myH = [pos.y, pos.y + node.h / 2, pos.y + node.h];

    let bestV = null;
    for (const t of targets) {
      if (t.kind !== 'v') continue;
      for (let i = 0; i < myV.length; i += 1) {
        const d = Math.abs(myV[i] - t.value);
        if (d <= SNAP && (!bestV || d < bestV.d)) bestV = { d, delta: t.value - myV[i], value: t.value, label: t.label };
      }
    }
    if (bestV) {
      x += Math.round(bestV.delta);
      hints.push({ kind: 'v', value: bestV.value, label: bestV.label });
    }

    let bestH = null;
    for (const t of targets) {
      if (t.kind !== 'h') continue;
      for (let i = 0; i < myH.length; i += 1) {
        const d = Math.abs(myH[i] - t.value);
        if (d <= SNAP && (!bestH || d < bestH.d)) bestH = { d, delta: t.value - myH[i], value: t.value, label: t.label };
      }
    }
    if (bestH) {
      y += Math.round(bestH.delta);
      hints.push({ kind: 'h', value: bestH.value, label: bestH.label });
    }

    return { x, y, hints };
  }

  function renderHints(hints) {
    clearHints();
    if (!hints || !hints.length) return;
    const device = store.device;
    for (const hint of hints) {
      const line = document.createElement('div');
      line.className = 'hint-line';
      if (hint.kind === 'v') {
        line.style.left = hint.value + 'px';
        line.style.top = '0';
        line.style.width = '1px';
        line.style.height = device.h + 'px';
      } else {
        line.style.top = hint.value + 'px';
        line.style.left = '0';
        line.style.height = '1px';
        line.style.width = device.w + 'px';
      }
      hintsLayer.appendChild(line);
    }
  }

  function clearHints() {
    hintsLayer.textContent = '';
  }

  /* ---------------- 缩放节点 ---------------- */

  function onHandlePointerDown(e, node, dir) {
    e.stopPropagation();
    e.preventDefault();
    resizing = {
      id: node.id,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      zoom: store.state.zoom,
      origin: { x: node.x, y: node.y, w: node.w, h: node.h },
      pushed: false
    };
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', onResizeUp, { once: true });
  }

  function onResizeMove(e) {
    if (!resizing) return;
    const dx = (e.clientX - resizing.startX) / resizing.zoom;
    const dy = (e.clientY - resizing.startY) / resizing.zoom;
    const o = resizing.origin;
    const node = store.nodeById(resizing.id);
    if (!node) return;

    if (!resizing.pushed) { store.pushHistory(); resizing.pushed = true; }

    let x = o.x, y = o.y, w = o.w, h = o.h;
    if (resizing.dir.indexOf('e') >= 0) w = Math.max(4, Math.round(o.w + dx));
    if (resizing.dir.indexOf('s') >= 0) h = Math.max(2, Math.round(o.h + dy));
    if (resizing.dir.indexOf('w') >= 0) {
      w = Math.max(4, Math.round(o.w - dx));
      x = Math.round(o.x + (o.w - w));
    }
    if (resizing.dir.indexOf('n') >= 0) {
      h = Math.max(2, Math.round(o.h - dy));
      y = Math.round(o.y + (o.h - h));
    }
    node.x = x; node.y = y; node.w = w; node.h = h;

    const el = nodeEls.get(node.id);
    if (el) {
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.width = w + 'px';
      el.style.height = h + 'px';
    }
  }

  function onResizeUp() {
    window.removeEventListener('pointermove', onResizeMove);
    resizing = null;
    store.emit('resize');
    store.persist();
    render();
  }

  /* ---------------- 初始化 ---------------- */

  canvasHost.addEventListener('pointerdown', onCanvasPointerDown);

  return { render, fit, applyZoom };
}
