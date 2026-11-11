/**
 * 左侧面板：页面列表 + 组件库
 */

import { COMPONENTS } from './model.js';

const LAYER_META = {
  text: { icon: 'T', label: '文本' },
  rect: { icon: '▭', label: '矩形' },
  circle: { icon: '◯', label: '圆形' },
  line: { icon: '—', label: '分割线' },
  image: { icon: '🖼', label: '图片' },
  button: { icon: '▢', label: '按钮' },
  input: { icon: '⌷', label: '输入框' },
  textarea: { icon: '⌸', label: '多行框' },
  checkbox: { icon: '☑', label: '复选框' },
  switch: { icon: '⇄', label: '开关' },
  icon: { icon: '★', label: '图标' },
  badge: { icon: '◉', label: '标签' },
  card: { icon: '▤', label: '卡片' },
  listitem: { icon: '☰', label: '列表项' },
  navbar: { icon: '▔', label: '导航栏' },
  tabbar: { icon: '▁', label: '标签栏' }
};

/** 图层列表：当前页所有元素，最上层显示在最前 */
export function renderLayerList(container, store, handlers) {
  if (!container) return;
  container.textContent = '';
  const page = store.page;
  const nodes = page.nodes.slice().reverse();

  if (!nodes.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-hint';
    empty.style.padding = '2px 10px 10px';
    empty.textContent = '本页还没有元素';
    container.appendChild(empty);
    return;
  }

  for (const node of nodes) {
    const meta = LAYER_META[node.type] || { icon: '□', label: node.type };
    const row = document.createElement('div');
    row.className = 'layer-item' + (store.isSelected(node.id) ? ' active' : '');
    if (node.hidden) row.classList.add('is-hidden');

    const g = document.createElement('span');
    g.className = 'l-icon';
    g.textContent = meta.icon;
    row.appendChild(g);

    const name = document.createElement('span');
    name.className = 'l-name';
    const text = (node.text || '').replace(/\s+/g, ' ').trim();
    name.textContent = (text ? text.slice(0, 14) : meta.label);
    name.title = meta.label + (text ? '：' + text : '');
    row.appendChild(name);

    const eye = document.createElement('button');
    eye.className = 'mini l-btn';
    eye.textContent = node.hidden ? '◌' : '◉';
    eye.title = node.hidden ? '显示' : '隐藏';
    eye.addEventListener('click', (e) => {
      e.stopPropagation();
      store.updateNode(node.id, { hidden: !node.hidden });
    });
    row.appendChild(eye);

    const lock = document.createElement('button');
    lock.className = 'mini l-btn';
    lock.textContent = node.locked ? '🔒' : '🔓';
    lock.title = node.locked ? '解锁' : '锁定';
    lock.addEventListener('click', (e) => {
      e.stopPropagation();
      store.updateNode(node.id, { locked: !node.locked });
    });
    row.appendChild(lock);

    row.addEventListener('click', (e) => {
      store.select([node.id], e.shiftKey);
    });

    container.appendChild(row);
  }
}

export function renderPageList(container, store, handlers) {
  container.textContent = '';
  const project = store.project;

  for (const page of project.pages) {
    const row = document.createElement('div');
    row.className = 'page-item' + (page.id === project.activePageId ? ' active' : '');

    const dot = document.createElement('span');
    dot.textContent = '▤';
    dot.style.opacity = '0.6';
    row.appendChild(dot);

    const name = document.createElement('span');
    name.className = 'pname';
    name.textContent = page.name;
    name.title = '双击重命名';
    name.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const next = prompt('页面名称', page.name);
      if (next && next.trim()) store.renamePage(page.id, next.trim());
    });
    row.appendChild(name);

    const del = document.createElement('span');
    del.className = 'del';
    del.textContent = '✕';
    del.title = '删除页面';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (store.project.pages.length <= 1) return handlers.toast('至少保留一个页面');
      if (confirm('删除页面「' + page.name + '」？')) store.deletePage(page.id);
    });
    row.appendChild(del);

    row.addEventListener('click', () => store.setActivePage(page.id));
    container.appendChild(row);
  }
}

export function renderLibrary(container, store, handlers) {
  container.textContent = '';
  for (const comp of COMPONENTS) {
    const item = document.createElement('div');
    item.className = 'lib-item';
    item.title = '添加' + comp.label;
    item.draggable = true;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = comp.icon;
    item.appendChild(svg);

    const label = document.createElement('span');
    label.textContent = comp.label;
    item.appendChild(label);

    item.addEventListener('click', () => handlers.addComponent(comp.type));
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', comp.type);
      e.dataTransfer.effectAllowed = 'copy';
    });
    container.appendChild(item);
  }
}
