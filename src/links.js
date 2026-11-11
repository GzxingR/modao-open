/**
 * 交互连线（画面上的可视化）与预览运行时
 */

import { createNodeEl } from './nodes.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

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
    const from = { x: node.x + node.w, y: node.y + node.h / 2 };

    let to = null;
    let label = '';

    if (node.link.action === 'navigate') {
      const target = store.project.pages.find((p) => p.id === node.link.targetPageId);
      if (!target) continue;
      to = { x: device.w - 10, y: from.y };
      label = '→ ' + target.name;
    } else if (node.link.action === 'state') {
      const target = page.nodes.find((n) => n.id === node.link.targetNodeId);
      if (!target) continue;
      to = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
      let stName = '下一个状态';
      if (node.link.targetStateId && target.states) {
        const st = target.states.find((s) => s.id === node.link.targetStateId);
        if (st) stName = st.name;
      }
      label = '切状态 → ' + stName;
    } else {
      const target = page.nodes.find((n) => n.id === node.link.targetNodeId);
      if (!target) continue;
      to = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
      label = node.link.action === 'show' ? '显示' : (node.link.action === 'hide' ? '隐藏' : '切换');
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
    text.setAttribute('x', String(node.link.action === 'navigate' ? Math.max(8, to.x - 96) : to.x + 6));
    text.setAttribute('y', String(to.y - 6));
    text.setAttribute('fill', '#1677ff');
    text.setAttribute('stroke', 'rgba(255,255,255,0.92)');
    text.setAttribute('stroke-width', '3');
    text.setAttribute('paint-order', 'stroke');
    text.setAttribute('font-size', '10');
    text.setAttribute('font-family', 'Microsoft YaHei, sans-serif');
    text.textContent = label;
    svg.appendChild(text);

    count += 1;
  }

  layer.appendChild(svg);
  layer.dataset.count = String(count);
}

/**
 * 预览运行时：页面跳转、显隐切换、组件状态切换。
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

    function bind(node, el) {
      el.style.cursor = node.link ? 'pointer' : 'default';
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        runLink(node);
      });
    }

    function rerenderNode(node) {
      const old = nodeEls.get(node.id);
      if (!old) return;
      const fresh = createNodeEl(node, { interactive: true });
      if (hiddenState.get(node.id) === true) fresh.style.display = 'none';
      bind(node, fresh);
      old.replaceWith(fresh);
      nodeEls.set(node.id, fresh);
    }

    function runLink(node) {
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
      }
    }

    for (const node of page.nodes) {
      if (node.hidden) continue;
      const el = createNodeEl(node, { interactive: true });
      if (hiddenState.get(node.id) === true) el.style.display = 'none';
      bind(node, el);
      host.appendChild(el);
      nodeEls.set(node.id, el);
    }

    mount.appendChild(host);
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
