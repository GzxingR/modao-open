/**
 * 左侧面板：页面列表 + 组件库
 */

import { COMPONENTS } from './model.js';

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
