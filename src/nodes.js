/**
 * 节点渲染：把数据模型渲染成真实 DOM（画布与预览共用）
 */

import { ICONS } from './model.js';

function px(v) { return typeof v === 'number' ? v + 'px' : v; }

function svgIcon(name, size, color, strokeWidth) {
  const path = ICONS[name] || ICONS.dot;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', color || '#333333');
  svg.setAttribute('stroke-width', String(strokeWidth || 1.7));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', path);
  svg.appendChild(p);
  return svg;
}

export function baseNodeStyle(node) {
  const s = {
    position: 'absolute',
    left: px(node.x),
    top: px(node.y),
    width: px(node.w),
    height: px(node.h),
    boxSizing: 'border-box',
    background: node.bg === 'transparent' ? 'transparent' : node.bg,
    borderRadius: px(node.radius),
    border: (node.borderWidth || 0) > 0 ? px(node.borderWidth) + ' solid ' + (node.borderColor || '#e5e5e5') : 'none',
    boxShadow: node.shadow && node.shadow !== 'none' ? node.shadow : 'none',
    opacity: node.opacity == null ? 1 : node.opacity,
    overflow: 'hidden',
    fontFamily: '"Microsoft YaHei","PingFang SC",sans-serif',
    color: node.color || '#222222',
    fontSize: px(node.fontSize || 16),
    fontWeight: String(node.fontWeight || 400),
    lineHeight: String(node.lineHeight || 1.4),
    textAlign: node.align || 'left',
    transform: node.rotation ? 'rotate(' + node.rotation + 'deg)' : 'none'
  };
  if (node.hidden) s.display = 'none';
  return s;
}

function applyStyle(el, style) {
  for (const k in style) {
    if (Object.prototype.hasOwnProperty.call(style, k)) el.style[k] = style[k];
  }
}

function flexCenter(el, dir) {
  el.style.display = 'flex';
  el.style.alignItems = dir === 'start' ? 'flex-start' : 'center';
  el.style.justifyContent = 'center';
}

/**
 * 创建节点的 DOM。opts.interactive=false 用于预览/导出（不带 pointer 事件）。
 */
export function createNodeEl(node, opts = {}) {
  const el = document.createElement('div');
  el.className = 'node node-' + node.type;
  el.dataset.id = node.id;
  applyStyle(el, baseNodeStyle(node));

  switch (node.type) {
    case 'text': {
      const pad = node.paddingX || 0;
      el.style.padding = '0 ' + px(pad);
      el.style.display = 'flex';
      el.style.alignItems = node.verticalAlign === 'top' ? 'flex-start' : 'center';
      el.style.justifyContent = node.align === 'center' ? 'center' : (node.align === 'right' ? 'flex-end' : 'flex-start');
      el.style.whiteSpace = 'pre-wrap';
      el.style.wordBreak = 'break-word';
      el.textContent = node.text || '';
      break;
    }
    case 'rect':
    case 'circle':
    case 'card': {
      if (node.text) {
        flexCenter(el);
        el.textContent = node.text;
      }
      break;
    }
    case 'line': {
      el.style.background = node.bg === 'transparent' ? '#f0f0f0' : node.bg;
      break;
    }
    case 'image': {
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.gap = '6px';
      el.style.color = node.color || '#999999';
      const pic = svgIcon('image' in ICONS ? 'image' : 'dot', Math.min(28, node.h * 0.3), node.color || '#999999', 1.4);
      el.appendChild(pic);
      if (node.text) {
        const t = document.createElement('div');
        t.textContent = node.text;
        t.style.fontSize = px(node.fontSize || 14);
        t.style.color = node.color || '#999999';
        el.appendChild(t);
      }
      break;
    }
    case 'button': {
      flexCenter(el);
      const t = document.createElement('span');
      t.textContent = node.text || '按钮';
      el.appendChild(t);
      break;
    }
    case 'input': {
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.paddingLeft = px(node.paddingX == null ? 14 : node.paddingX);
      el.style.paddingRight = px(node.paddingX == null ? 14 : node.paddingX);
      const t = document.createElement('span');
      t.textContent = node.text || '';
      t.style.color = node.color || '#bbbbbb';
      t.style.fontSize = px(node.fontSize || 15);
      t.style.overflow = 'hidden';
      t.style.whiteSpace = 'nowrap';
      t.style.textOverflow = 'ellipsis';
      el.appendChild(t);
      break;
    }
    case 'textarea': {
      el.style.display = 'flex';
      el.style.alignItems = 'flex-start';
      el.style.padding = '10px ' + px(node.paddingX == null ? 14 : node.paddingX);
      const t = document.createElement('span');
      t.textContent = node.text || '';
      t.style.color = node.color || '#bbbbbb';
      t.style.fontSize = px(node.fontSize || 15);
      t.style.whiteSpace = 'pre-wrap';
      el.appendChild(t);
      break;
    }
    case 'checkbox': {
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      if (node.checked) {
        el.style.background = '#1677ff';
        el.style.borderColor = '#1677ff';
        const c = svgIcon('check', Math.min(node.w, node.h) * 0.7, '#ffffff', 2.4);
        el.appendChild(c);
      }
      break;
    }
    case 'switch': {
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = node.on ? 'flex-end' : 'flex-start';
      el.style.padding = '2px';
      const knob = document.createElement('div');
      const d = Math.max(6, node.h - 6);
      knob.style.width = px(d);
      knob.style.height = px(d);
      knob.style.borderRadius = '999px';
      knob.style.background = '#ffffff';
      knob.style.boxShadow = '0 1px 3px rgba(0,0,0,.25)';
      el.appendChild(knob);
      break;
    }
    case 'icon': {
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      const size = Math.min(node.w, node.h);
      el.appendChild(svgIcon(node.icon || 'heart', size, node.color || '#333333', node.strokeWidth || 1.7));
      break;
    }
    case 'badge': {
      flexCenter(el);
      const t = document.createElement('span');
      t.textContent = node.text || '标签';
      el.appendChild(t);
      break;
    }
    case 'listitem': {
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.paddingLeft = px(node.paddingX == null ? 16 : node.paddingX);
      el.style.paddingRight = px(node.paddingX == null ? 16 : node.paddingX);
      if (node.divider) {
        const line = document.createElement('div');
        line.style.position = 'absolute';
        line.style.left = '0';
        line.style.right = '0';
        line.style.bottom = '0';
        line.style.height = '1px';
        line.style.background = node.dividerColor || '#f0f0f0';
        el.appendChild(line);
      }
      const t = document.createElement('span');
      t.textContent = node.text || '';
      el.appendChild(t);
      break;
    }
    case 'navbar': {
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.position = 'absolute';
      const title = document.createElement('span');
      title.textContent = node.text || '';
      el.appendChild(title);

      if (node.showBack) {
        const back = document.createElement('div');
        back.style.position = 'absolute';
        back.style.left = '12px';
        back.style.top = '50%';
        back.style.transform = 'translateY(-50%)';
        back.style.display = 'flex';
        back.appendChild(svgIcon('arrowLeft', 20, node.color || '#222222', 1.8));
        el.appendChild(back);
      }
      if (node.showAction) {
        const act = document.createElement('div');
        act.style.position = 'absolute';
        act.style.right = '12px';
        act.style.top = '50%';
        act.style.transform = 'translateY(-50%)';
        act.style.display = 'flex';
        act.appendChild(svgIcon(node.actionIcon || 'plus', 20, node.color || '#222222', 1.8));
        el.appendChild(act);
      }
      if (node.bottomLine) {
        const line = document.createElement('div');
        line.style.position = 'absolute';
        line.style.left = '0';
        line.style.right = '0';
        line.style.bottom = '0';
        line.style.height = '1px';
        line.style.background = '#f0f0f0';
        el.appendChild(line);
      }
      break;
    }
    case 'tabbar': {
      el.style.display = 'flex';
      el.style.alignItems = 'stretch';
      if (node.topLine) {
        const line = document.createElement('div');
        line.style.position = 'absolute';
        line.style.left = '0';
        line.style.right = '0';
        line.style.top = '0';
        line.style.height = '1px';
        line.style.background = '#f0f0f0';
        el.appendChild(line);
      }
      const tabs = node.tabs || ['待办', '已完成', '我的'];
      for (let i = 0; i < tabs.length; i += 1) {
        const cell = document.createElement('div');
        cell.style.flex = '1';
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'center';
        cell.style.fontSize = px(node.fontSize || 12);
        cell.style.color = i === (node.activeIndex || 0) ? (node.activeColor || '#1677ff') : (node.inactiveColor || '#999999');
        cell.textContent = tabs[i];
        el.appendChild(cell);
      }
      break;
    }
    default: {
      if (node.text) {
        flexCenter(el);
        el.textContent = node.text;
      }
    }
  }

  if (opts.interactive === false) {
    el.style.pointerEvents = 'none';
  }
  return el;
}

/** 渲染整页（不含交互按钮），供预览与导出 */
export function renderPage(page, opts = {}) {
  const dev = opts.device;
  const host = document.createElement('div');
  host.style.position = 'relative';
  host.style.width = px(dev.w);
  host.style.height = px(dev.h);
  host.style.background = page.bg || '#ffffff';
  host.style.overflow = 'hidden';
  for (const node of page.nodes) {
    if (node.hidden) continue;
    host.appendChild(createNodeEl(node, { interactive: false }));
  }
  return host;
}
