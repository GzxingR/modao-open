/**
 * 右侧属性面板
 */

import { ICON_NAMES, ICONS, DEVICES, currentState, STATE_STYLE_KEYS } from './model.js';

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const k in props) {
    if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
    if (k === 'text') node.textContent = props[k];
    else if (k === 'style') Object.assign(node.style, props[k]);
    else if (k.startsWith('on') && typeof props[k] === 'function') node.addEventListener(k.slice(2).toLowerCase(), props[k]);
    else if (k === 'class') node.className = props[k];
    else if (props[k] != null) node.setAttribute(k, props[k]);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function group(title, rows) {
  const g = el('div', { class: 'group' });
  g.appendChild(el('div', { class: 'group-title', text: title }));
  for (const r of rows) if (r) g.appendChild(r);
  return g;
}

function numField(label, value, onChange, opts = {}) {
  const wrap = el('div', { class: 'field' });
  wrap.appendChild(el('span', { text: label }));
  const input = el('input', {
    type: 'number',
    value: String(value == null ? 0 : value),
    step: opts.step || '1',
    min: opts.min != null ? String(opts.min) : null
  });
  input.addEventListener('change', () => {
    let v = Number(input.value);
    if (!isFinite(v)) v = 0;
    if (opts.min != null) v = Math.max(opts.min, v);
    onChange(v);
  });
  wrap.appendChild(input);
  return wrap;
}

function textField(label, value, onChange) {
  const wrap = el('div', { class: 'field' });
  if (label) wrap.appendChild(el('span', { text: label }));
  const input = el('input', { type: 'text', value: value == null ? '' : String(value) });
  input.addEventListener('change', () => onChange(input.value));
  wrap.appendChild(input);
  return wrap;
}

function colorField(label, value, onChange) {
  const wrap = el('div', { class: 'field' });
  if (label) wrap.appendChild(el('span', { text: label }));
  const picker = el('input', { type: 'color' });
  const text = el('input', { type: 'text', value: value || '#ffffff' });
  const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value || '');
  picker.value = isHex ? (value.length === 4 ? expandHex(value) : value) : '#ffffff';
  picker.addEventListener('input', () => {
    text.value = picker.value;
    onChange(picker.value);
  });
  text.addEventListener('change', () => {
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text.value)) {
      picker.value = text.value.length === 4 ? expandHex(text.value) : text.value;
      onChange(text.value);
    }
  });
  wrap.appendChild(picker);
  wrap.appendChild(text);
  wrap.style.flex = '1';
  return wrap;
}

function expandHex(v) {
  return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
}

function seg(options, activeValue, onPick) {
  const wrap = el('div', { class: 'seg' });
  for (const o of options) {
    const b = el('button', { type: 'button', text: o.label });
    if (o.value === activeValue) b.classList.add('on');
    b.addEventListener('click', () => onPick(o.value));
    wrap.appendChild(b);
  }
  return wrap;
}

export function renderInspector(container, store, handlers) {
  container.textContent = '';
  const node = store.selectedNode;
  const dev = store.device;

  if (!node) {
    const pageRows = [];
    const devSelect = el('select');
    for (const d of DEVICES) {
      const opt = el('option', { value: d.id, text: d.label });
      if (d.id === store.page.deviceId) opt.selected = true;
      devSelect.appendChild(opt);
    }
    devSelect.addEventListener('change', () => store.setDevice(devSelect.value));
    const devWrap = el('div', { class: 'row' }, [devSelect]);
    pageRows.push(el('div', { class: 'row' }, [el('span', { class: 'group-title', text: '画布设备', style: { margin: '0 8px 0 0' } }), devWrap]));
    pageRows.push(el('div', { class: 'row' }, [colorField('背景', store.page.bg || '#ffffff', (v) => store.setPageBg(v))]));

    container.appendChild(group('页面', pageRows));

    container.appendChild(group('选中说明', [
      el('div', { class: 'empty-hint' }, [
        '点画布里的元素来改属性。',
        el('br'),
        '左侧组件库点一下就能加进来。',
        el('br'),
        el('br'),
        '快捷键：',
        el('br'),
        el('kbd', { text: 'Del' }), ' 删除　',
        el('kbd', { text: 'Ctrl+D' }), ' 复制',
        el('br'),
        el('kbd', { text: 'Ctrl+Z' }), ' 撤销　',
        el('kbd', { text: 'Ctrl+Shift+Z' }), ' 重做',
        el('br'),
        el('kbd', { text: '方向键' }), ' 微调位置'
      ])
    ]));
    return;
  }

  /* ---------- 位置与尺寸 ---------- */
  container.appendChild(group('位置与尺寸', [
    el('div', { class: 'row' }, [
      numField('X', node.x, (v) => handlers.update(node.id, { x: v })),
      numField('Y', node.y, (v) => handlers.update(node.id, { y: v }))
    ]),
    el('div', { class: 'row' }, [
      numField('宽', node.w, (v) => handlers.update(node.id, { w: v }), { min: 1 }),
      numField('高', node.h, (v) => handlers.update(node.id, { h: v }), { min: 1 })
    ]),
    el('div', { class: 'row' }, [
      numField('圆角', node.radius || 0, (v) => handlers.update(node.id, { radius: v }), { min: 0 }),
      numField('旋转', node.rotation || 0, (v) => handlers.update(node.id, { rotation: v }), { step: '1' })
    ])
  ]));

  /* ---------- 外观 ---------- */
  const fillValue = node.bg === 'transparent' ? '#ffffff' : node.bg;
  container.appendChild(group('外观', [
    el('div', { class: 'row' }, [
      el('span', { class: 'group-title', text: '填充', style: { margin: 0 } }),
      el('label', { style: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-dim)' } }, [
        (() => {
          const cb = el('input', { type: 'checkbox' });
          cb.checked = node.bg !== 'transparent';
          cb.addEventListener('change', () => handlers.update(node.id, { bg: cb.checked ? (isHexish(fillValue) ? fillValue : '#f5f5f5') : 'transparent' }));
          return cb;
        })(),
        '填充'
      ])
    ]),
    el('div', { class: 'row' }, [colorField(null, isHexish(fillValue) ? fillValue : '#f5f5f5', (v) => handlers.update(node.id, { bg: v }))]),
    el('div', { class: 'row' }, [
      numField('描边', node.borderWidth || 0, (v) => handlers.update(node.id, { borderWidth: v }), { min: 0 }),
      colorField(null, node.borderColor || '#e5e5e5', (v) => handlers.update(node.id, { borderColor: v }))
    ]),
    el('div', { class: 'row' }, [
      numField('透明度', Math.round((node.opacity == null ? 1 : node.opacity) * 100), (v) => handlers.update(node.id, { opacity: Math.max(0, Math.min(100, v)) / 100 }), { min: 0 })
    ])
  ]));

  /* ---------- 文字 ---------- */
  const hasText = ['text', 'button', 'input', 'textarea', 'badge', 'listitem', 'navbar', 'image', 'rect', 'card'].indexOf(node.type) >= 0;
  if (hasText) {
    container.appendChild(group('文字', [
      el('div', { class: 'row' }, [
        (() => {
          const ta = el('textarea', { class: 'full', rows: '2' });
          ta.value = node.text || '';
          ta.addEventListener('change', () => handlers.update(node.id, { text: ta.value }));
          return ta;
        })()
      ]),
      el('div', { class: 'row' }, [
        numField('字号', node.fontSize || 16, (v) => handlers.update(node.id, { fontSize: v }), { min: 1 }),
        numField('行高', node.lineHeight || 1.4, (v) => handlers.update(node.id, { lineHeight: v }), { step: '0.1', min: 0.8 })
      ]),
      el('div', { class: 'row' }, [
        colorField('颜色', isHexish(node.color) ? node.color : '#222222', (v) => handlers.update(node.id, { color: v }))
      ]),
      el('div', { class: 'row' }, [
        seg([
          { label: '常规', value: 400 },
          { label: '中粗', value: 500 },
          { label: '加粗', value: 700 }
        ], node.fontWeight || 400, (v) => handlers.update(node.id, { fontWeight: v }))
      ]),
      el('div', { class: 'row' }, [
        seg([
          { label: '左', value: 'left' },
          { label: '中', value: 'center' },
          { label: '右', value: 'right' }
        ], node.align || 'left', (v) => handlers.update(node.id, { align: v }))
      ])
    ]));
  }

  /* ---------- 组件特有 ---------- */
  const specific = [];

  if (node.type === 'icon') {
    const select = el('select');
    for (const name of ICON_NAMES) {
      const o = el('option', { value: name, text: name });
      if (name === (node.icon || 'heart')) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener('change', () => handlers.update(node.id, { icon: select.value }));
    specific.push(el('div', { class: 'row' }, [select]));
    specific.push(el('div', { class: 'row' }, [numField('线宽', node.strokeWidth || 1.7, (v) => handlers.update(node.id, { strokeWidth: v }), { step: '0.1', min: 0.5 })]));
  }

  if (node.type === 'checkbox') {
    specific.push(el('div', { class: 'row' }, [
      seg([{ label: '未选', value: 'o' }, { label: '已选', value: 'c' }], node.checked ? 'c' : 'o', (v) => handlers.update(node.id, { checked: v === 'c' }))
    ]));
  }

  if (node.type === 'switch') {
    specific.push(el('div', { class: 'row' }, [
      seg([{ label: '关', value: 'off' }, { label: '开', value: 'on' }], node.on ? 'on' : 'off', (v) => handlers.update(node.id, { on: v === 'on' }))
    ]));
  }

  if (node.type === 'tabbar') {
    specific.push(el('div', { class: 'row' }, [
      textField('标签', (node.tabs || []).join(','), (v) => handlers.update(node.id, { tabs: v.split(/[,，]/).map((s) => s.trim()).filter(Boolean) }))
    ]));
    specific.push(el('div', { class: 'row' }, [
      numField('当前', node.activeIndex || 0, (v) => handlers.update(node.id, { activeIndex: v }), { min: 0 })
    ]));
    specific.push(el('div', { class: 'row' }, [
      colorField('选中色', node.activeColor || '#1677ff', (v) => handlers.update(node.id, { activeColor: v }))
    ]));
    specific.push(el('div', { class: 'row' }, [
      colorField('未选色', node.inactiveColor || '#999999', (v) => handlers.update(node.id, { inactiveColor: v }))
    ]));
  }

  if (node.type === 'navbar') {
    specific.push(el('div', { class: 'row' }, [
      seg([{ label: '无返回', value: 'n' }, { label: '返回', value: 'y' }], node.showBack ? 'y' : 'n', (v) => handlers.update(node.id, { showBack: v === 'y' }))
    ]));
    specific.push(el('div', { class: 'row' }, [
      seg([{ label: '无按钮', value: 'n' }, { label: '右侧按钮', value: 'y' }], node.showAction ? 'y' : 'n', (v) => handlers.update(node.id, { showAction: v === 'y' }))
    ]));
    const select = el('select');
    for (const name of ICON_NAMES) {
      const o = el('option', { value: name, text: name });
      if (name === (node.actionIcon || 'plus')) o.selected = true;
      select.appendChild(o);
    }
    select.addEventListener('change', () => handlers.update(node.id, { actionIcon: select.value }));
    specific.push(el('div', { class: 'row' }, [select]));
  }

  if (node.type === 'listitem') {
    specific.push(el('div', { class: 'row' }, [
      seg([{ label: '无分割线', value: 'n' }, { label: '有分割线', value: 'y' }], node.divider ? 'y' : 'n', (v) => handlers.update(node.id, { divider: v === 'y' }))
    ]));
  }

  if (specific.length) container.appendChild(group('组件设置', specific));

  /* ---------- 交互 ---------- */
  const pages = store.project.pages.filter((p) => p.id !== store.page.id);
  const linkRows = [];
  const actionSelect = el('select');
  const actions = [
    { value: 'none', label: '无交互' },
    { value: 'navigate', label: '点击跳转页面' },
    { value: 'state', label: '点击切换组件状态' },
    { value: 'show', label: '点击显示目标' },
    { value: 'hide', label: '点击隐藏目标' },
    { value: 'toggle', label: '点击切换目标' }
  ];
  for (const a of actions) {
    const o = el('option', { value: a.value, text: a.label });
    if ((node.link && node.link.action) === a.value || (!node.link && a.value === 'none')) o.selected = true;
    actionSelect.appendChild(o);
  }
  linkRows.push(el('div', { class: 'row' }, [actionSelect]));

  const currentAction = node.link ? node.link.action : 'none';

  if (currentAction === 'navigate') {
    if (!pages.length) {
      linkRows.push(el('div', { class: 'empty-hint', text: '还没有其他页面，先新建一个页面。' }));
    } else {
      const pageSelect = el('select');
      for (const p of pages) {
        const o = el('option', { value: p.id, text: p.name });
        if (node.link && node.link.targetPageId === p.id) o.selected = true;
        pageSelect.appendChild(o);
      }
      pageSelect.addEventListener('change', () => handlers.update(node.id, { link: { action: 'navigate', targetPageId: pageSelect.value } }));
      linkRows.push(el('div', { class: 'row' }, [pageSelect]));
    }
  } else if (currentAction === 'state') {
    const targets = store.page.nodes.filter((n) => n.id !== node.id && n.states && n.states.length);
    if (!targets.length) {
      linkRows.push(el('div', { class: 'empty-hint', text: '本页还没有带状态的组件。先选中一个组件，在下面「组件状态」里添加状态。' }));
    } else {
      const nodeSelect = el('select');
      for (const n of targets) {
        const o = el('option', { value: n.id, text: (n.name || n.type) + ' · ' + n.states.length + ' 个状态' });
        if (node.link && node.link.targetNodeId === n.id) o.selected = true;
        nodeSelect.appendChild(o);
      }
      linkRows.push(el('div', { class: 'row' }, [nodeSelect]));

      const currentTargetId = (node.link && node.link.targetNodeId) || targets[0].id;
      const targetNode = targets.find((n) => n.id === currentTargetId) || targets[0];

      const stateSelect = el('select');
      const loopOpt = el('option', { value: '', text: '循环切到下一个状态' });
      stateSelect.appendChild(loopOpt);
      for (const st of targetNode.states) {
        const o = el('option', { value: st.id, text: st.name });
        if (node.link && node.link.targetStateId === st.id) o.selected = true;
        stateSelect.appendChild(o);
      }
      linkRows.push(el('div', { class: 'row' }, [stateSelect]));

      const apply = (patch) => handlers.update(node.id, { link: patch });
      nodeSelect.addEventListener('change', () => {
        apply({ action: 'state', targetNodeId: nodeSelect.value, targetStateId: null });
      });
      stateSelect.addEventListener('change', () => {
        apply({
          action: 'state',
          targetNodeId: currentTargetId,
          targetStateId: stateSelect.value || null
        });
      });
    }
  } else if (currentAction === 'show' || currentAction === 'hide' || currentAction === 'toggle') {
    const nodeSelect = el('select');
    const candidates = store.page.nodes.filter((n) => n.id !== node.id);
    if (!candidates.length) {
      linkRows.push(el('div', { class: 'empty-hint', text: '本页还没有其他元素可选。' }));
    } else {
      for (const n of candidates) {
        const o = el('option', { value: n.id, text: (n.name || n.type) + ' · ' + n.id.slice(-4) });
        if (node.link && node.link.targetNodeId === n.id) o.selected = true;
        nodeSelect.appendChild(o);
      }
      nodeSelect.addEventListener('change', () => handlers.update(node.id, { link: { action: currentAction, targetNodeId: nodeSelect.value } }));
      linkRows.push(el('div', { class: 'row' }, [nodeSelect]));
    }
  }

  actionSelect.addEventListener('change', () => {
    const v = actionSelect.value;
    if (v === 'none') handlers.update(node.id, { link: null });
    else if (v === 'navigate') handlers.update(node.id, { link: { action: 'navigate', targetPageId: pages[0] ? pages[0].id : null } });
    else {
      const target = store.page.nodes.filter((n) => n.id !== node.id)[0];
      handlers.update(node.id, { link: { action: v, targetNodeId: target ? target.id : null } });
    }
  });

  container.appendChild(group('交互（预览时生效）', linkRows));

  /* ---------- 组件状态（动态组件 · 外观变体） ---------- */
  const stateRows = [];
  const curState = currentState(node);
  if (node.states && node.states.length) {
    stateRows.push(el('div', {
      class: 'empty-hint',
      style: { padding: '0 2px 6px' },
      text: '当前状态：' + (curState ? curState.name : '—') + '　点“存”把现在的外观存进该状态。'
    }));
    for (const st of node.states) {
      const row = el('div', { class: 'row' });
      const nameWrap = el('div', { class: 'field', style: { flex: '1' } });
      const input = el('input', { type: 'text', value: st.name });
      input.addEventListener('change', () => {
        store.renameState(node.id, st.id, input.value.trim() || st.name);
      });
      nameWrap.appendChild(input);
      row.appendChild(nameWrap);

      const isCur = curState && curState.id === st.id;
      const curBtn = el('button', { class: 'mini', text: isCur ? '●' : '○', title: '设为当前状态' });
      curBtn.addEventListener('click', () => store.setActiveState(node.id, st.id));
      row.appendChild(curBtn);

      const saveBtn = el('button', { class: 'mini', text: '存', title: '把当前外观存进这个状态' });
      saveBtn.addEventListener('click', () => {
        store.captureStateStyle(node.id, st.id, STATE_STYLE_KEYS);
        handlers.toast('外观已存进「' + st.name + '」');
      });
      row.appendChild(saveBtn);

      const delBtn = el('button', { class: 'mini', text: '✕', title: '删除状态' });
      delBtn.addEventListener('click', () => store.removeState(node.id, st.id));
      row.appendChild(delBtn);

      stateRows.push(row);
    }
  } else {
    stateRows.push(el('div', {
      class: 'empty-hint',
      text: '添加状态后，这个组件可以有多套外观，交互里就能选「点击切换组件状态」。'
    }));
  }

  const addStateBtn = el('button', { class: 'tb', text: '＋ 添加组件状态' });
  addStateBtn.style.width = '100%';
  addStateBtn.addEventListener('click', () => {
    const st = store.addState(node.id);
    if (st) {
      store.captureStateStyle(node.id, st.id, STATE_STYLE_KEYS);
      handlers.toast('已添加状态：' + st.name);
    }
  });
  stateRows.push(el('div', { class: 'row' }, [addStateBtn]));
  container.appendChild(group('组件状态（动态组件）', stateRows));

  /* ---------- 排列 ---------- */
  container.appendChild(group('排列', [
    el('div', { class: 'row' }, [
      el('button', { class: 'tb', text: '上移一层', style: { flex: '1' }, onclick: () => handlers.bringForward(node.id) }),
      el('button', { class: 'tb', text: '下移一层', style: { flex: '1' }, onclick: () => handlers.sendBackward(node.id) })
    ]),
    el('div', { class: 'row' }, [
      el('button', { class: 'tb', text: '置顶', style: { flex: '1' }, onclick: () => handlers.bringToFront(node.id) }),
      el('button', { class: 'tb', text: '置底', style: { flex: '1' }, onclick: () => handlers.sendToBack(node.id) })
    ]),
    el('div', { class: 'row' }, [
      el('button', { class: 'tb', text: '水平居中', style: { flex: '1' }, onclick: () => handlers.align('hcenter') }),
      el('button', { class: 'tb', text: '垂直居中', style: { flex: '1' }, onclick: () => handlers.align('vcenter') })
    ]),
    el('div', { class: 'row' }, [
      el('button', { class: 'tb', text: '复制一份', style: { flex: '1' }, onclick: () => store.duplicateSelected() }),
      el('button', { class: 'tb', text: '删除', style: { flex: '1', color: '#ff9b9d' }, onclick: () => store.deleteSelected() })
    ])
  ]));
}

function isHexish(v) {
  return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
}

export { ICONS };
