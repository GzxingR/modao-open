/**
 * 右侧属性面板
 */

import { ICON_NAMES, ICONS, DEVICES, currentState, STATE_STYLE_KEYS, resolveDevice, TRIGGERS, ACTIONS, CONDITION_OPS } from './model.js';
import { compressImageFile } from './io.js';

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

const COLLAPSE_KEY = 'modao-open:collapsed-groups';

function loadCollapsed() {
  try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}'); } catch (e) { return {}; }
}

function saveCollapsed(map) {
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(map)); } catch (e) { /* 忽略 */ }
}

function group(title, rows) {
  const g = el('div', { class: 'group' });
  const collapsed = !!loadCollapsed()[title];
  if (collapsed) g.classList.add('collapsed');

  const head = el('div', { class: 'group-title group-head' });
  const caret = el('span', { class: 'caret' });
  const cs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  cs.setAttribute('width', '10');
  cs.setAttribute('height', '10');
  cs.setAttribute('viewBox', '0 0 24 24');
  cs.setAttribute('fill', 'none');
  cs.setAttribute('stroke', 'currentColor');
  cs.setAttribute('stroke-width', '2.6');
  cs.setAttribute('stroke-linecap', 'round');
  cs.setAttribute('stroke-linejoin', 'round');
  const cp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  cp.setAttribute('d', 'M9 6l6 6-6 6');
  cs.appendChild(cp);
  caret.appendChild(cs);
  head.appendChild(caret);
  head.appendChild(el('span', { text: title }));

  const body = el('div', { class: 'group-body' });
  for (const r of rows) if (r) body.appendChild(r);
  if (collapsed) body.style.display = 'none';

  head.addEventListener('click', () => {
    const map = loadCollapsed();
    map[title] = !map[title];
    saveCollapsed(map);
    const now = !!map[title];
    g.classList.toggle('collapsed', now);
    body.style.display = now ? 'none' : '';
  });

  g.appendChild(head);
  g.appendChild(body);
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
    pageRows.push(el('div', { class: 'row' }, [
      numField('宽', dev.w, (v) => store.setCustomSize(v, store.device.h), { min: 120 }),
      numField('高', dev.h, (v) => store.setCustomSize(store.device.w, v), { min: 200 })
    ]));
    if (store.page.customW) {
      const resetBtn = el('button', { class: 'tb', text: '恢复预设尺寸' });
      resetBtn.style.width = '100%';
      resetBtn.addEventListener('click', () => store.clearCustomSize());
      pageRows.push(el('div', { class: 'row' }, [resetBtn]));
    }
    pageRows.push(el('div', { class: 'row' }, [colorField('背景', store.page.bg || '#ffffff', (v) => store.setPageBg(v))]));

    container.appendChild(group('页面', pageRows));

    /* 变量（项目级） */
    const varRows = [];
    const vars = store.project.variables || [];
    if (!vars.length) {
      varRows.push(el('div', {
        class: 'empty-hint',
        text: '还没有变量。变量可以被交互赋值，也能用「条件」控制某个行为是否执行。'
      }));
    }
    for (const v of vars) {
      const row = el('div', { class: 'row' });
      const nameWrap = el('div', { class: 'field', style: { flex: '1' } });
      const nameInput = el('input', { type: 'text', value: v.name });
      nameInput.addEventListener('change', () => store.updateVariable(v.id, { name: nameInput.value.trim() || v.name }));
      nameWrap.appendChild(nameInput);
      row.appendChild(nameWrap);

      const valWrap = el('div', { class: 'field', style: { flex: '1' } });
      const valInput = el('input', { type: 'text', value: v.value });
      valInput.addEventListener('change', () => store.updateVariable(v.id, { value: valInput.value }));
      valWrap.appendChild(valInput);
      row.appendChild(valWrap);

      const delBtn = el('button', { class: 'mini', text: '✕', title: '删除变量' });
      delBtn.addEventListener('click', () => store.removeVariable(v.id));
      row.appendChild(delBtn);
      varRows.push(row);
    }
    const addVarBtn = el('button', { class: 'tb', text: '＋ 添加变量' });
    addVarBtn.style.width = '100%';
    addVarBtn.addEventListener('click', () => {
      store.addVariable('var' + ((store.project.variables || []).length + 1), '');
    });
    varRows.push(el('div', { class: 'row' }, [addVarBtn]));
    container.appendChild(group('变量（项目级）', varRows));

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

  if (node.type === 'image') {
    const upBtn = el('button', { class: 'tb', text: node.src ? '更换图片' : '上传图片' });
    upBtn.style.width = '100%';
    upBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
          const r = await compressImageFile(file, 900, 0.82);
          handlers.update(node.id, { src: r.dataUrl, text: '' });
          handlers.toast('已插入图片 ' + r.width + '×' + r.height + '（' + Math.round(r.dataUrl.length / 1024) + ' KB）');
        } catch (e) {
          handlers.toast('图片处理失败：' + e.message);
        }
      });
      input.click();
    });
    specific.push(el('div', { class: 'row' }, [upBtn]));

    if (node.src) {
      const clrBtn = el('button', { class: 'tb', text: '清除图片' });
      clrBtn.style.width = '100%';
      clrBtn.addEventListener('click', () => handlers.update(node.id, { src: '' }));
      specific.push(el('div', { class: 'row' }, [clrBtn]));
    }

    specific.push(el('div', { class: 'row' }, [
      seg([
        { label: '裁剪铺满', value: 'cover' },
        { label: '完整显示', value: 'contain' }
      ], node.fit || 'cover', (v) => handlers.update(node.id, { fit: v }))
    ]));
    specific.push(el('div', { class: 'empty-hint', text: '图片会压缩到最长边 900px 后存进项目文件。' }));
  }

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
  const currentAction = node.link ? node.link.action : 'none';
  const currentTrigger = (node.link && node.link.trigger) || 'click';

  const triggerSelect = el('select');
  for (const t of TRIGGERS) {
    const o = el('option', { value: t.value, text: t.label });
    if (t.value === currentTrigger) o.selected = true;
    triggerSelect.appendChild(o);
  }
  triggerSelect.disabled = currentAction === 'none';
  triggerSelect.addEventListener('change', () => {
    const patch = Object.assign({}, node.link || { action: 'navigate' }, { trigger: triggerSelect.value });
    handlers.update(node.id, { link: patch });
  });

  const actionSelect = el('select');
  for (const a of ACTIONS) {
    const o = el('option', { value: a.value, text: a.label });
    if (a.value === currentAction) o.selected = true;
    actionSelect.appendChild(o);
  }

  linkRows.push(el('div', { class: 'row' }, [
    el('span', { class: 'group-title', text: '触发', style: { margin: '0 4px 0 0', fontSize: '11px' } }),
    triggerSelect
  ]));

  if (currentTrigger === 'keydown') {
    const keyInput = el('input', { type: 'text', value: (node.link && node.link.keyName) || 'Enter' });
    keyInput.style.cssText = 'flex:1;background:var(--bg-input);border:1px solid var(--line);border-radius:5px;color:var(--text);padding:4px 6px;font-size:12px;';
    keyInput.placeholder = 'Enter / Escape / a …';
    keyInput.addEventListener('change', () => {
      const next = Object.assign({}, node.link || { action: 'navigate' }, { keyName: keyInput.value.trim() || 'Enter' });
      handlers.update(node.id, { link: next });
    });
    linkRows.push(el('div', { class: 'row' }, [keyInput]));
  }
  linkRows.push(el('div', { class: 'row' }, [
    el('span', { class: 'group-title', text: '行为', style: { margin: '0 4px 0 0', fontSize: '11px' } }),
    actionSelect
  ]));

  const keep = () => Object.assign({ trigger: currentTrigger }, node.link || {});

  /* 条件（可选）：不满足则整个行为不执行 */
  const projectVars = store.project.variables || [];
  const condVarSelect = el('select');
  condVarSelect.appendChild(el('option', { value: '', text: '无条件（总是执行）' }));
  for (const v of projectVars) {
    const o = el('option', { value: v.name, text: v.name });
    if (node.link && node.link.condition && node.link.condition.varName === v.name) o.selected = true;
    condVarSelect.appendChild(o);
  }
  condVarSelect.disabled = currentAction === 'none';
  condVarSelect.addEventListener('change', () => {
    const vn = condVarSelect.value;
    const next = Object.assign({}, node.link || { action: 'navigate' });
    if (!vn) delete next.condition;
    else next.condition = { varName: vn, op: 'truthy', value: '' };
    handlers.update(node.id, { link: next });
  });
  linkRows.push(el('div', { class: 'row' }, [
    el('span', { class: 'group-title', text: '条件', style: { margin: '0 4px 0 0', fontSize: '11px' } }),
    condVarSelect
  ]));

  const cond = node.link && node.link.condition;
  if (cond && cond.varName) {
    const opSelect = el('select');
    for (const op of CONDITION_OPS) {
      const o = el('option', { value: op.value, text: op.label });
      if (op.value === (cond.op || 'truthy')) o.selected = true;
      opSelect.appendChild(o);
    }
    opSelect.addEventListener('change', () => {
      const next = Object.assign({}, node.link);
      next.condition = Object.assign({}, cond, { op: opSelect.value });
      handlers.update(node.id, { link: next });
    });
    linkRows.push(el('div', { class: 'row' }, [opSelect]));

    if (cond.op === 'eq' || cond.op === 'neq') {
      const condValInput = el('input', { type: 'text', value: cond.value || '' });
      condValInput.style.cssText = 'flex:1;background:var(--bg-input);border:1px solid var(--line);border-radius:5px;color:var(--text);padding:4px 6px;font-size:12px;';
      condValInput.addEventListener('change', () => {
        const next = Object.assign({}, node.link);
        next.condition = Object.assign({}, cond, { value: condValInput.value });
        handlers.update(node.id, { link: next });
      });
      linkRows.push(el('div', { class: 'row' }, [condValInput]));
    }
  }

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
      pageSelect.addEventListener('change', () => {
        handlers.update(node.id, { link: Object.assign(keep(), { action: 'navigate', targetPageId: pageSelect.value }) });
      });
      linkRows.push(el('div', { class: 'row' }, [pageSelect]));
    }
  } else if (currentAction === 'url') {
    const urlInput = el('input', { type: 'text', value: (node.link && node.link.url) || 'https://' });
    urlInput.style.cssText = 'flex:1;background:var(--bg-input);border:1px solid var(--line);border-radius:5px;color:var(--text);padding:4px 6px;font-size:12px;';
    urlInput.addEventListener('change', () => {
      handlers.update(node.id, { link: Object.assign(keep(), { action: 'url', url: urlInput.value.trim() }) });
    });
    linkRows.push(el('div', { class: 'row' }, [urlInput]));
    linkRows.push(el('div', { class: 'empty-hint', text: '预览时点开会在新标签打开这个地址。' }));
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

      nodeSelect.addEventListener('change', () => {
        handlers.update(node.id, {
          link: Object.assign(keep(), { action: 'state', targetNodeId: nodeSelect.value, targetStateId: null })
        });
      });
      stateSelect.addEventListener('change', () => {
        handlers.update(node.id, {
          link: Object.assign(keep(), {
            action: 'state', targetNodeId: currentTargetId, targetStateId: stateSelect.value || null
          })
        });
      });
    }
  } else if (currentAction === 'openOverlay' || currentAction === 'closeOverlay') {
    const overlays = store.page.nodes.filter((n) => n.type === 'group' && n.overlay);
    if (!overlays.length) {
      linkRows.push(el('div', { class: 'empty-hint', text: '本页还没有浮层。先选中一个分组，在下面「浮层」里打开。' }));
    } else {
      const nodeSelect = el('select');
      for (const n of overlays) {
        const o = el('option', { value: n.id, text: (n.name || '分组') + ' · 浮层' });
        if (node.link && node.link.targetNodeId === n.id) o.selected = true;
        nodeSelect.appendChild(o);
      }
      nodeSelect.addEventListener('change', () => {
        handlers.update(node.id, { link: Object.assign(keep(), { action: currentAction, targetNodeId: nodeSelect.value }) });
      });
      linkRows.push(el('div', { class: 'row' }, [nodeSelect]));
    }
  } else if (currentAction === 'setVar') {
    if (!projectVars.length) {
      linkRows.push(el('div', { class: 'empty-hint', text: '先在上面的「变量」面板里加一个变量。' }));
    } else {
      const varSelect = el('select');
      for (const v of projectVars) {
        const o = el('option', { value: v.name, text: v.name });
        if (node.link && node.link.varName === v.name) o.selected = true;
        varSelect.appendChild(o);
      }
      const varValInput = el('input', { type: 'text', value: (node.link && node.link.varValue) || '' });
      varValInput.style.cssText = 'flex:1;background:var(--bg-input);border:1px solid var(--line);border-radius:5px;color:var(--text);padding:4px 6px;font-size:12px;';
      varValInput.placeholder = '要赋的值';

      const applyVar = () => {
        handlers.update(node.id, {
          link: Object.assign(keep(), { action: 'setVar', varName: varSelect.value, varValue: varValInput.value })
        });
      };
      varSelect.addEventListener('change', applyVar);
      varValInput.addEventListener('change', applyVar);

      linkRows.push(el('div', { class: 'row' }, [varSelect]));
      linkRows.push(el('div', { class: 'row' }, [varValInput]));
      linkRows.push(el('div', { class: 'empty-hint', text: '预览时触发就把它设成这个值，后面的行为可以用条件读它。' }));
    }
  } else if (currentAction === 'show' || currentAction === 'hide' || currentAction === 'toggle' || currentAction === 'scrollTo') {
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
      nodeSelect.addEventListener('change', () => {
        handlers.update(node.id, { link: Object.assign(keep(), { action: currentAction, targetNodeId: nodeSelect.value }) });
      });
      linkRows.push(el('div', { class: 'row' }, [nodeSelect]));
    }
  }

  actionSelect.addEventListener('change', () => {
    const v = actionSelect.value;
    if (v === 'none') { handlers.update(node.id, { link: null }); return; }
    const next = { action: v, trigger: currentTrigger };
    if (v === 'navigate') next.targetPageId = pages[0] ? pages[0].id : null;
    else if (v === 'url') next.url = 'https://';
    else if (v === 'openOverlay' || v === 'closeOverlay') {
      const ov = store.page.nodes.filter((n) => n.type === 'group' && n.overlay)[0];
      next.targetNodeId = ov ? ov.id : null;
    } else if (v === 'setVar') {
      const fv = (store.project.variables || [])[0];
      next.varName = fv ? fv.name : '';
      next.varValue = '';
    } else {
      const target = store.page.nodes.filter((n) => n.id !== node.id)[0];
      next.targetNodeId = target ? target.id : null;
    }
    handlers.update(node.id, { link: next });
  });

  container.appendChild(group('交互（预览时生效）', linkRows));

  /* ---------- 浮层（仅分组） ---------- */
  if (node.type === 'group') {
    const overlayRows = [];
    overlayRows.push(el('div', { class: 'row' }, [
      seg([
        { label: '普通分组', value: 'n' },
        { label: '作为浮层', value: 'y' }
      ], node.overlay ? 'y' : 'n', (v) => store.setOverlay(node.id, { overlay: v === 'y' }))
    ]));
    if (node.overlay) {
      overlayRows.push(el('div', { class: 'row' }, [
        seg([
          { label: '无遮罩', value: 'n' },
          { label: '带遮罩', value: 'y' }
        ], node.overlayMask ? 'y' : 'n', (v) => store.setOverlay(node.id, { overlayMask: v === 'y' }))
      ]));
      overlayRows.push(el('div', { class: 'row' }, [
        seg([
          { label: '默认关闭', value: 'n' },
          { label: '默认打开', value: 'y' }
        ], node.defaultOpen ? 'y' : 'n', (v) => store.setOverlay(node.id, { defaultOpen: v === 'y' }))
      ]));
      overlayRows.push(el('div', {
        class: 'empty-hint',
        text: '浮层在预览时挂到最上层；用「打开浮层 / 关闭浮层」两个交互控制它。'
      }));
    }
    container.appendChild(group('浮层', overlayRows));
  }

  /* ---------- 组件状态 ---------- */
  if (node.type === 'group') {
    /* 真动态组件：每个状态是一整套子元素 */
    const groupStateRows = [];
    const curG = currentState(node);
    if (node.states && node.states.length) {
      groupStateRows.push(el('div', {
        class: 'empty-hint',
        style: { padding: '0 2px 6px' },
        text: '当前状态：' + (curG ? curG.name : '—') + '　每个状态可以是一整套子元素。'
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

        const isCur = curG && curG.id === st.id;
        const curBtn = el('button', { class: 'mini', text: isCur ? '●' : '○', title: '设为当前状态' });
        curBtn.addEventListener('click', () => store.setGroupState(node.id, st.id));
        row.appendChild(curBtn);

        const capBtn = el('button', { class: 'mini', text: '存', title: '把组当前的子元素存进这个状态' });
        capBtn.addEventListener('click', () => {
          store.captureGroupChildren(node.id, st.id);
          handlers.toast('已把当前子元素存进「' + st.name + '」');
        });
        row.appendChild(capBtn);

        const repBtn = el('button', { class: 'mini', text: '取', title: '用选中的元素替换这个状态的子元素' });
        repBtn.addEventListener('click', () => {
          const n = store.replaceGroupStateFromSelection(node.id, st.id);
          handlers.toast(n ? ('已用 ' + n + ' 个元素替换「' + st.name + '」') : '先选中要用的元素（可多选）');
        });
        row.appendChild(repBtn);

        const delBtn = el('button', { class: 'mini', text: '✕', title: '删除状态' });
        delBtn.addEventListener('click', () => store.removeGroupState(node.id, st.id));
        row.appendChild(delBtn);

        groupStateRows.push(row);
      }
    } else {
      groupStateRows.push(el('div', {
        class: 'empty-hint',
        text: '给分组加状态后，每个状态可以是一整套子元素；配合「切换组件状态」交互就能做登录/未登录这类切换。'
      }));
    }
    const addGroupStateBtn = el('button', { class: 'tb', text: '＋ 添加状态（存当前子元素）' });
    addGroupStateBtn.style.width = '100%';
    addGroupStateBtn.addEventListener('click', () => {
      const st = store.addGroupState(node.id);
      if (st) handlers.toast('已添加状态：' + st.name);
    });
    groupStateRows.push(el('div', { class: 'row' }, [addGroupStateBtn]));
    container.appendChild(group('组件状态（真动态组件）', groupStateRows));
  } else {
    /* 普通组件：外观变体 */
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
  }

  /* ---------- 排列 ---------- */
  const selIsGroup = node.type === 'group';
  container.appendChild(group('排列', [
    el('div', { class: 'row' }, [
      el('button', {
        class: 'tb',
        text: selIsGroup ? '解散分组' : '组合选中',
        style: { flex: '1' },
        onclick: () => {
          if (selIsGroup) {
            const n = store.ungroupSelected();
            handlers.toast('已解散，拆出 ' + n + ' 个元素');
          } else {
            const g = store.groupSelected();
            handlers.toast(g ? '已组合 ' + (g.children ? g.children.length : 0) + ' 个元素' : '至少选两个元素才能组合');
          }
        }
      })
    ]),
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
