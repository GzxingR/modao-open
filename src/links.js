/**
 * 交互连线（画面上的可视化）与预览运行时
 */

import { createNodeEl } from './nodes.js';
import { triggerLabel, actionLabel } from './model.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const LONG_PRESS_MS = 500;
const SWIPE_MIN = 30;

/** 给预览/导出用的触发器绑定；fire 是真正的行为执行函数 */
export function bindTriggers(el, link, fire) {
  const trigger = (link && link.trigger) || 'click';
  el.style.cursor = 'pointer';

  if (trigger === 'click') {
    el.addEventListener('click', (e) => { e.stopPropagation(); fire(); });
  } else if (trigger === 'dblclick') {
    el.addEventListener('dblclick', (e) => { e.stopPropagation(); fire(); });
  } else if (trigger === 'mouseenter') {
    el.addEventListener('mouseenter', () => fire());
  } else if (trigger === 'mouseleave') {
    el.addEventListener('mouseleave', () => fire());
  } else if (trigger === 'longpress') {
    let timer = null;
    const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      clear();
      timer = setTimeout(() => { timer = null; fire(); }, LONG_PRESS_MS);
    });
    el.addEventListener('pointerup', clear);
    el.addEventListener('pointerleave', clear);
    el.addEventListener('pointercancel', clear);
  } else if (trigger.indexOf('swipe') === 0) {
    let sx = 0;
    let sy = 0;
    let tracking = false;
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      sx = e.clientX;
      sy = e.clientY;
      tracking = true;
    });
    el.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const horiz = Math.abs(dx) > Math.abs(dy);
      const dist = horiz ? Math.abs(dx) : Math.abs(dy);
      if (dist < SWIPE_MIN) return;
      const dir = horiz ? (dx > 0 ? 'Right' : 'Left') : (dy > 0 ? 'Down' : 'Up');
      if ('swipe' + dir === trigger) fire();
    });
  }
  // 'load' 由调用方在渲染后立即触发，不需要绑定
}

export function renderLinks(layer, store) {
  layer.textContent = '';
  if (!store.state.showLinks) return;

  const page = store.page;
  const device = store.device;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(device.w));
  svg.setAttribute('height', String(device.h));
  svg.style.position = 'absolute';
  svg.style.inset = '0';
  svg.style.overflow = 'visible';

  let count = 0;

  for (const node of page.nodes) {
    if (!node.link || !node.link.action || node.link.action === 'none') continue;
    const trig = triggerLabel(node.link.trigger || 'click');
    const from = { x: node.x + node.w, y: node.y + node.h / 2 };

    let to = null;
    let label = '';

    if (node.link.action === 'navigate') {
      const target = store.project.pages.find((p) => p.id === node.link.targetPageId);
      if (!target) continue;
      to = { x: device.w - 10, y: from.y };
      label = trig + ' → ' + target.name;
    } else if (node.link.action === 'url') {
      to = { x: device.w - 10, y: from.y };
      label = trig + ' → 链接';
    } else if (node.link.action === 'state') {
      const target = page.nodes.find((n) => n.id === node.link.targetNodeId);
      if (!target) continue;
      to = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
      let stName = '下一个状态';
      if (node.link.targetStateId && target.states) {
        const st = target.states.find((s) => s.id === node.link.targetStateId);
        if (st) stName = st.name;
      }
      label = trig + ' → ' + stName;
    } else {
      const target = page.nodes.find((n) => n.id === node.link.targetNodeId);
      if (!target) continue;
      to = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
      label = trig + ' → ' + actionLabel(node.link.action);
    }

    const path = document.createElementNS(SVG_NS, 'path');
    const dx = Math.max(24, Math.abs(to.x - from.x) * 0.45);
    const d = 'M ' + from.x + ' ' + from.y +
      ' C ' + (from.x + dx) + ' ' + from.y + ', ' + (to.x - dx) + ' ' + to.y + ', ' + to.x + ' ' + to.y;
    path.setAttribute('d', d);
    path.setAttribute('class', 'link-path');
    svg.appendChild(path);

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(from.x));
    circle.setAttribute('cy', String(from.y));
    circle.setAttribute('r', '3');
    circle.setAttribute('fill', '#1677ff');
    svg.appendChild(circle);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('class', 'link-label');
    // 标签居中在连线中点，并夹在画布内，避免贴边被裁掉
    const midX = (from.x + to.x) / 2;
    text.setAttribute('x', String(Math.max(40, Math.min(device.w - 40, midX))));
    text.setAttribute('y', String((from.y + to.y) / 2 - 6));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#1677ff');
    text.setAttribute('font-size', '10');
    text.setAttribute('font-family', 'Microsoft YaHei, sans-serif');
    text.textContent = label;
    svg.appendChild(text);

    count += 1;
  }

  layer.appendChild(svg);

  // 给标签补一层白色胶囊底，避免压在元素上不好读
  try {
    for (const t of svg.querySelectorAll('text.link-label')) {
      const bb = t.getBBox();
      const bg = document.createElementNS(SVG_NS, 'rect');
      bg.setAttribute('x', String(bb.x - 4));
      bg.setAttribute('y', String(bb.y - 1.5));
      bg.setAttribute('width', String(bb.width + 8));
      bg.setAttribute('height', String(bb.height + 3));
      bg.setAttribute('rx', '3');
      bg.setAttribute('fill', 'rgba(255,255,255,0.94)');
      bg.setAttribute('stroke', 'rgba(22,119,255,0.35)');
      bg.setAttribute('stroke-width', '0.6');
      t.parentNode.insertBefore(bg, t);
    }
  } catch (e) { /* getBBox 在未布局时可能抛错，忽略 */ }

  layer.dataset.count = String(count);
}

/**
 * 预览运行时：页面跳转、显隐切换、组件状态切换、滚动到、打开链接。
 * project 传进来的应是深拷贝，运行时允许改动其 activeStateId。
 */
export function createPreviewRuntime(project, startPageId, mount) {
  let currentPageId = startPageId;
  const hiddenState = new Map();

  function pageById(id) {
    return project.pages.find((p) => p.id === id) || project.pages[0];
  }

  function render() {
    const page = pageById(currentPageId);
    mount.textContent = '';

    const dev = page.device || { w: 402, h: 874 };
    const host = document.createElement('div');
    host.style.position = 'relative';
    host.style.width = dev.w + 'px';
    host.style.height = dev.h + 'px';
    host.style.background = page.bg || '#ffffff';
    host.style.overflow = 'hidden';

    const nodeEls = new Map();
    const overlayMasks = new Map();

    function rerenderNode(node) {
      const old = nodeEls.get(node.id);
      if (!old) return;
      const fresh = createNodeEl(node, { interactive: true });
      if (hiddenState.get(node.id) === true) fresh.style.display = 'none';
      attach(node, fresh);
      old.replaceWith(fresh);
      nodeEls.set(node.id, fresh);
    }

    function runAction(node) {
      const link = node.link;
      if (!link || !link.action || link.action === 'none') return;

      if (link.action === 'navigate') {
        if (link.targetPageId && link.targetPageId !== page.id) {
          currentPageId = link.targetPageId;
          hiddenState.clear();
          render();
        }
        return;
      }

      if (link.action === 'url') {
        if (link.url) window.open(link.url, '_blank', 'noopener');
        return;
      }

      const target = page.nodes.find((n) => n.id === link.targetNodeId);
      if (!target) return;

      if (link.action === 'state') {
        if (!target.states || !target.states.length) return;
        if (link.targetStateId) {
          target.activeStateId = link.targetStateId;
        } else {
          const idx = target.states.findIndex((s) => s.id === target.activeStateId);
          const next = target.states[(idx + 1) % target.states.length];
          target.activeStateId = next.id;
        }
        rerenderNode(target);
        return;
      }

      if (link.action === 'openOverlay' || link.action === 'closeOverlay') {
        if (!target.overlay) return;
        const oel = nodeEls.get(target.id);
        const mask = overlayMasks.get(target.id);
        const show = link.action === 'openOverlay';
        if (oel) oel.style.display = show ? '' : 'none';
        if (mask) mask.style.display = show ? '' : 'none';
        return;
      }

      const el = nodeEls.get(target.id);
      if (!el) return;

      if (link.action === 'show') {
        el.style.display = '';
        hiddenState.set(target.id, false);
      } else if (link.action === 'hide') {
        el.style.display = 'none';
        hiddenState.set(target.id, true);
      } else if (link.action === 'toggle') {
        const isHidden = el.style.display === 'none';
        el.style.display = isHidden ? '' : 'none';
        hiddenState.set(target.id, !isHidden);
      } else if (link.action === 'scrollTo') {
        if (el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }

    function attach(node, el) {
      const link = node.link;
      if (link && link.action && link.action !== 'none' && (link.trigger || 'click') !== 'load') {
        bindTriggers(el, link, () => runAction(node));
      } else {
        el.style.cursor = 'default';
      }
    }

    const overlays = [];
    for (const node of page.nodes) {
      if (node.hidden) continue;
      if (node.type === 'group' && node.overlay) { overlays.push(node); continue; }
      const el = createNodeEl(node, { interactive: true });
      if (hiddenState.get(node.id) === true) el.style.display = 'none';
      attach(node, el);
      host.appendChild(el);
      nodeEls.set(node.id, el);
    }

    // 浮层挂到最上层：遮罩 + 浮层本体
    for (const node of overlays) {
      let mask = null;
      if (node.overlayMask) {
        mask = document.createElement('div');
        mask.className = 'ov-mask';
        mask.dataset.for = node.id;
        mask.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.45);z-index:900;';
        if (!node.defaultOpen) mask.style.display = 'none';
        host.appendChild(mask);
      }
      const el = createNodeEl(node, { interactive: true });
      el.style.zIndex = '901';
      if (!node.defaultOpen) el.style.display = 'none';
      attach(node, el);
      host.appendChild(el);
      nodeEls.set(node.id, el);
      overlayMasks.set(node.id, mask);
    }

    mount.appendChild(host);

    // 载入时触发（延后一帧，避免与渲染打架）
    const loads = page.nodes.filter((n) => n.link && n.link.action && n.link.action !== 'none' && (n.link.trigger || 'click') === 'load');
    if (loads.length) {
      setTimeout(() => {
        for (const n of loads) runAction(n);
      }, 60);
    }
  }

  return {
    start() { render(); },
    restart() {
      currentPageId = startPageId;
      hiddenState.clear();
      render();
    },
    currentPage() { return pageById(currentPageId); }
  };
}
