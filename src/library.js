/**
 * 左侧面板：页面列表 + 图层树 + 组件库
 */

import { COMPONENTS } from './model.js';

const NS = 'http://www.w3.org/2000/svg';

/** 图层行用的 16×16 线性图标（path d） */
const LAYER_ICONS = {
  text: 'M4 6h16M12 6v13',
  rect: 'M4 6h16v12H4z',
  circle: 'M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z',
  line: 'M4 12h16',
  image: 'M4 6h16v12H4zM7 15l3-3 2.5 2.5L15 12l2 3',
  button: 'M3.5 8h17v8h-17z',
  input: 'M3.5 8h17v8h-17zM7 10v4',
  textarea: 'M3.5 6h17v12h-17zM7 10h10M7 13.5h7',
  checkbox: 'M4.5 4.5h15v15h-15zM8 12l2.6 2.6L16 9.8',
  switch: 'M3 9h18v6H3zM16 12a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z',
  icon: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z',
  badge: 'M4 9h16v6H4z',
  card: 'M4 6h16v12H4zM4 10h16',
  listitem: 'M4 8h16v8H4zM7 12h7',
  navbar: 'M3.5 5h17v5h-17zM3.5 14h17',
  tabbar: 'M3.5 15h17v4.5h-17zM8 17.2h.01M12 17.2h.01M16 17.2h.01',
  group: 'M4 4h9v9H4zM11 11h9v9h-9z'
};

const LAYER_LABELS = {
  text: '文本', rect: '矩形', circle: '圆形', line: '分割线', image: '图片',
  button: '按钮', input: '输入框', textarea: '多行框', checkbox: '复选框', switch: '开关',
  icon: '图标', badge: '标签', card: '卡片', listitem: '列表项', navbar: '导航栏',
  tabbar: '标签栏', group: '分组'
};

const EYE_ON = 'M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12zM12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z';
const EYE_OFF = 'M4 4l16 16M9.8 5.6A9.6 9.6 0 0 1 12 5.4c6 0 9.5 6.6 9.5 6.6a17 17 0 0 1-3 3.6M6.4 7.4C3.9 9.2 2.5 12 2.5 12s3.5 5.5 9.5 5.5c1.3 0 2.5-.3 3.6-.7';
const LOCK_ON = 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3';
const LOCK_OFF = 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 5.6-1.5';

function svgIcon(d, size) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(size || 13));
  svg.setAttribute('height', String(size || 13));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', d);
  svg.appendChild(p);
  return svg;
}

export function renderPageList(container, store, handlers) {
  container.textContent = '';
  const project = store.project;

  for (const page of project.pages) {
    const row = document.createElement('div');
    row.className = 'page-item' + (page.id === project.activePageId ? ' active' : '');

    const dot = document.createElement('span');
    dot.className = 'p-icon';
    dot.appendChild(svgIcon('M4 5h16v14H4zM4 9h16', 12));
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
      const pageName = page.name;
      store.deletePage(page.id);
      handlers.toast('已删除页面「' + pageName + '」', { label: '撤销', onClick: () => store.undo() });
    });
    row.appendChild(del);

    row.addEventListener('click', () => store.setActivePage(page.id));
    container.appendChild(row);
  }
}

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
    const path = LAYER_ICONS[node.type] || LAYER_ICONS.rect;
    const label = LAYER_LABELS[node.type] || node.type;

    const row = document.createElement('div');
    row.className = 'layer-item' + (store.isSelected(node.id) ? ' active' : '');
    if (node.hidden) row.classList.add('is-hidden');

    const g = document.createElement('span');
    g.className = 'l-icon';
    g.appendChild(svgIcon(path, 13));
    row.appendChild(g);

    const name = document.createElement('span');
    name.className = 'l-name';
    const text = (node.text || '').replace(/\s+/g, ' ').trim();
    if (node.type === 'group') {
      name.textContent = '分组（' + ((node.children && node.children.length) || 0) + '）';
    } else {
      name.textContent = text ? text.slice(0, 14) : label;
    }
    name.title = label + (text ? '：' + text : '');
    row.appendChild(name);

    const eye = document.createElement('button');
    eye.className = 'mini l-btn';
    eye.appendChild(svgIcon(node.hidden ? EYE_OFF : EYE_ON, 12));
    eye.title = node.hidden ? '显示' : '隐藏';
    eye.addEventListener('click', (e) => {
      e.stopPropagation();
      store.updateNode(node.id, { hidden: !node.hidden });
    });
    row.appendChild(eye);

    const lock = document.createElement('button');
    lock.className = 'mini l-btn';
    lock.appendChild(svgIcon(node.locked ? LOCK_ON : LOCK_OFF, 12));
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

const CATEGORY_LABELS = { basic: '基础', form: '表单', layout: '布局', icon: '图标' };
const CATEGORY_ORDER = ['basic', 'form', 'layout', 'icon'];

/** 搜索同义词：搜这些词也能找到对应组件 */
const LIB_TAGS = {
  text: ['文字', '标题', '正文', 'label', 'title', 'heading'],
  rect: ['方块', '方形', '背景', '容器', 'box', 'block'],
  circle: ['圆', '椭圆', '圆形', 'dot', 'avatar'],
  line: ['线', '分割', '分隔', 'divider', 'hr'],
  image: ['图', '图片', '照片', 'picture', 'photo', 'img'],
  button: ['按钮', '按键', '提交', 'btn', 'submit'],
  input: ['输入', '输入框', '单行', 'input', 'field'],
  textarea: ['多行', '文本域', '备注', 'textarea'],
  checkbox: ['勾选', '复选框', '多选', 'check', 'checkbox'],
  switch: ['开关', '切换', 'toggle', 'switch'],
  icon: ['图标', '符号', 'icon', 'symbol'],
  badge: ['标签', '徽标', '标记', 'badge', 'tag', 'chip'],
  card: ['卡片', '卡', '弹窗', '对话框', '弹层', 'dialog', 'modal', 'card'],
  listitem: ['列表', '列表项', '条目', 'list', 'item', 'row'],
  navbar: ['导航', '标题栏', '顶栏', 'navbar', 'header', 'appbar'],
  tabbar: ['标签栏', '底栏', 'tab', 'tabbar', 'bottom'],
  group: ['分组', '组', '容器', 'group', 'overlay', '浮层']
};

function makeLibItem(comp, handlers) {
  const item = document.createElement('div');
  item.className = 'lib-item';
  item.title = '添加' + comp.label;
  item.draggable = true;

  const svg = document.createElementNS(NS, 'svg');
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
  return item;
}

/**
 * 组件库。keyword 非空时按名称/类型过滤并平铺；否则按分类分组显示。
 */
export function renderLibrary(container, store, handlers, keyword) {
  if (!container) return;
  container.textContent = '';

  const kw = String(keyword || '').trim().toLowerCase();
  const list = COMPONENTS.filter((c) => {
    if (!kw) return true;
    if (c.label.toLowerCase().indexOf(kw) >= 0) return true;
    if (c.type.toLowerCase().indexOf(kw) >= 0) return true;
    const tags = LIB_TAGS[c.type] || [];
    return tags.some((t) => t.toLowerCase().indexOf(kw) >= 0);
  });

  /* 我的组件（自定义母版）：非搜索时显示在最前 */
  const defs = (store && store.project && store.project.components) || [];
  if (!kw && defs.length) {
    const title = document.createElement('div');
    title.className = 'lib-group-title';
    title.textContent = '我的组件';
    container.appendChild(title);

    for (const def of defs) {
      const item = document.createElement('div');
      item.className = 'lib-item my-comp';
      item.title = def.name + '（点击插入实例，' + Math.round(def.w) + '×' + Math.round(def.h) + '）';

      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('width', '20');
      svg.setAttribute('height', '20');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.6');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.innerHTML = LAYER_ICONS.group;
      item.appendChild(svg);

      const label = document.createElement('span');
      label.textContent = def.name;
      item.appendChild(label);

      item.addEventListener('click', () => {
        if (handlers.insertComponent) handlers.insertComponent(def.id);
      });

      const del = document.createElement('button');
      del.className = 'mini comp-del';
      del.textContent = '✕';
      del.title = '删除这个组件定义（页面里的实例会保留，只是不再联动）';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (handlers.removeComponent) handlers.removeComponent(def.id);
      });
      item.appendChild(del);

      container.appendChild(item);
    }
  }

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-hint lib-empty';
    empty.style.gridColumn = '1 / -1';
    empty.style.padding = '10px 4px';
    empty.textContent = '没有匹配「' + keyword + '」的组件';
    container.appendChild(empty);
    return;
  }

  if (kw) {
    for (const comp of list) container.appendChild(makeLibItem(comp, handlers));
    return;
  }

  for (const cat of CATEGORY_ORDER) {
    const group = list.filter((c) => (c.category || 'basic') === cat);
    if (!group.length) continue;
    const title = document.createElement('div');
    title.className = 'lib-group-title';
    title.textContent = CATEGORY_LABELS[cat] || cat;
    container.appendChild(title);
    for (const comp of group) container.appendChild(makeLibItem(comp, handlers));
  }
}
