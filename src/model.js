/**
 * 数据模型：设备、组件定义、节点/页面/项目工厂
 * 纯数据层，不碰 DOM。
 */

export const DEVICES = [
  { id: 'iphone17', label: 'iPhone 17 · 402×874', w: 402, h: 874, safeTop: 59, safeBottom: 34 },
  { id: 'iphone16', label: 'iPhone 16 · 393×852', w: 393, h: 852, safeTop: 59, safeBottom: 34 },
  { id: 'iphone15', label: 'iPhone 15 · 393×852', w: 393, h: 852, safeTop: 59, safeBottom: 34 },
  { id: 'iphone14', label: 'iPhone 14 · 390×844', w: 390, h: 844, safeTop: 47, safeBottom: 34 },
  { id: 'iphoneSE', label: 'iPhone SE · 375×667', w: 375, h: 667, safeTop: 20, safeBottom: 0 },
  { id: 'android', label: 'Android · 360×800', w: 360, h: 800, safeTop: 24, safeBottom: 16 },
  { id: 'ipad', label: 'iPad · 768×1024', w: 768, h: 1024, safeTop: 24, safeBottom: 20 },
  { id: 'web', label: 'Web · 1440×900', w: 1440, h: 900, safeTop: 0, safeBottom: 0 }
];

export function getDevice(id) {
  for (const d of DEVICES) if (d.id === id) return d;
  return DEVICES[0];
}

/** 页面实际使用的设备尺寸（支持页面级自定义宽高） */
export function resolveDevice(page) {
  const base = getDevice(page && page.deviceId);
  if (page && page.customW > 0 && page.customH > 0) {
    return {
      id: base.id,
      label: base.label.replace(/\s*·.*$/, '') + ' · 自定义',
      w: Math.round(page.customW),
      h: Math.round(page.customH),
      safeTop: base.safeTop,
      safeBottom: base.safeBottom,
      custom: true
    };
  }
  return base;
}

let counter = 0;
export function uid(prefix = 'n') {
  counter += 1;
  return prefix + Date.now().toString(36) + counter.toString(36);
}

/** 图标库：24x24 viewBox 的 path，便于画布和组件库复用 */
export const ICONS = {
  heart: 'M12 21s-7.5-4.7-9.3-9.1C1.2 8.3 3 5 6.2 5c3 0 4.4 2 5.8 3.7C13.4 7 14.8 5 17.8 5 21 5 22.8 8.3 21.3 11.9 19.5 16.3 12 21 12 21z',
  star: 'M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.6l-5.3 2.8 1.1-5.9L3.5 9.4l5.9-.8L12 3.2z',
  plus: 'M12 4.5v15M4.5 12h15',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm5 12l4.5 4.5',
  arrowRight: 'M5 12h13M13 6.5l6 5.5-6 5.5',
  arrowLeft: 'M19 12H6M11 6.5L5 12l6 5.5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8c0-3.3 3.1-6 7-6s7 2.7 7 6',
  cart: 'M3.5 5h2.2l2 9.5h9.6l2-6.8H6.4M9 19.5a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6zm7.5 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z',
  check: 'M4.5 12.5l5 5L20 6.5',
  close: 'M6 6l12 12M18 6L6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  home: 'M4 11l8-6.5 8 6.5v9H4z',
  bell: 'M12 4a5 5 0 0 0-5 5v3.5L5.5 16h13L17 12.5V9a5 5 0 0 0-5-5zm-2 14a2 2 0 0 0 4 0',
  wallet: 'M3.5 7.5h17v11h-17zM3.5 7.5l2.2-3h12.6l2.2 3M16 13h2',
  dot: 'M12 12m-4 0a4 4 0 1 0 8 0 4 4 0 1 0 -8 0'
};

export const ICON_NAMES = Object.keys(ICONS);

/**
 * 组件定义。defaults() 返回该组件在指定设备上的默认节点属性。
 * category: basic | form | layout | icon
 */
export const COMPONENTS = [
  {
    type: 'text', label: '文本', category: 'basic',
    icon: '<path d="M4 6h16M4 12h10M4 18h7"/>',
    defaults: (dev) => ({
      w: Math.min(dev.w - 32, 220), h: 24,
      text: '文本内容', fontSize: 16, fontWeight: 400, color: '#222222',
      align: 'left', lineHeight: 1.4, bg: 'transparent'
    })
  },
  {
    type: 'rect', label: '矩形', category: 'basic',
    icon: '<rect x="4" y="5" width="16" height="14" rx="2"/>',
    defaults: () => ({
      w: 200, h: 120, bg: '#f5f5f5', radius: 8, borderWidth: 0, borderColor: '#e5e5e5'
    })
  },
  {
    type: 'circle', label: '圆形', category: 'basic',
    icon: '<circle cx="12" cy="12" r="7"/>',
    defaults: () => ({ w: 80, h: 80, bg: '#e8f0fe', radius: 999, borderWidth: 0, borderColor: '#c9d8ee' })
  },
  {
    type: 'line', label: '分割线', category: 'basic',
    icon: '<line x1="4" y1="12" x2="20" y2="12"/>',
    defaults: (dev) => ({ w: dev.w, h: 1, bg: '#f0f0f0', radius: 0, borderWidth: 0 })
  },
  {
    type: 'image', label: '图片', category: 'basic',
    icon: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M6.5 16l3.2-3.6 2.4 2.4 2.6-3.2L18.5 16"/>',
    defaults: (dev) => ({
      w: dev.w, h: 220, bg: '#f5f5f5', radius: 0, text: '图片',
      fontSize: 14, color: '#999999', align: 'center', borderWidth: 0, src: ''
    })
  },
  {
    type: 'button', label: '按钮', category: 'form',
    icon: '<rect x="3.5" y="7.5" width="17" height="9" rx="4"/>',
    defaults: (dev) => ({
      w: Math.min(dev.w - 32, 320), h: 44, text: '按钮', fontSize: 16, fontWeight: 400,
      color: '#ffffff', bg: '#1677ff', radius: 8, align: 'center', borderWidth: 0
    })
  },
  {
    type: 'input', label: '输入框', category: 'form',
    icon: '<rect x="3.5" y="7" width="17" height="10" rx="2"/><path d="M7 10v4"/>',
    defaults: (dev) => ({
      w: Math.min(dev.w - 32, 320), h: 48, text: '请输入内容', fontSize: 15, fontWeight: 400,
      color: '#bbbbbb', bg: '#ffffff', radius: 8, align: 'left', paddingX: 14,
      borderWidth: 1, borderColor: '#d9d9d9'
    })
  },
  {
    type: 'textarea', label: '多行框', category: 'form',
    icon: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7 9h10M7 12.5h10M7 16h6"/>',
    defaults: (dev) => ({
      w: Math.min(dev.w - 32, 320), h: 96, text: '多行文本内容', fontSize: 15, fontWeight: 400,
      color: '#bbbbbb', bg: '#ffffff', radius: 8, align: 'left', paddingX: 14,
      borderWidth: 1, borderColor: '#d9d9d9', verticalAlign: 'top'
    })
  },
  {
    type: 'checkbox', label: '复选框', category: 'form',
    icon: '<rect x="4.5" y="4.5" width="15" height="15" rx="3"/><path d="M8 12l2.7 2.7L16 9.5"/>',
    defaults: () => ({ w: 24, h: 24, bg: '#ffffff', radius: 4, borderWidth: 1, borderColor: '#d9d9d9', checked: false })
  },
  {
    type: 'switch', label: '开关', category: 'form',
    icon: '<rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="16" cy="12" r="2.6"/>',
    defaults: () => ({ w: 48, h: 26, bg: '#1677ff', radius: 999, on: true })
  },
  {
    type: 'icon', label: '图标', category: 'icon',
    icon: '<path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.6l-5.3 2.8 1.1-5.9L3.5 9.4l5.9-.8L12 3.2z"/>',
    defaults: () => ({ w: 24, h: 24, bg: 'transparent', color: '#333333', icon: 'heart', strokeWidth: 1.7 })
  },
  {
    type: 'badge', label: '标签', category: 'basic',
    icon: '<rect x="4" y="8.5" width="16" height="7" rx="3.5"/>',
    defaults: () => ({
      w: 56, h: 22, text: '标签', fontSize: 12, color: '#ff4d4f',
      bg: '#fff1f0', radius: 11, align: 'center', borderWidth: 1, borderColor: '#ffccc7'
    })
  },
  {
    type: 'card', label: '卡片', category: 'layout',
    icon: '<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M4 10h16"/>',
    defaults: (dev) => ({
      w: dev.w - 32, h: 96, bg: '#ffffff', radius: 10, borderWidth: 1, borderColor: '#f0f0f0',
      shadow: '0 1px 6px rgba(0,0,0,0.06)'
    })
  },
  {
    type: 'listitem', label: '列表项', category: 'layout',
    icon: '<rect x="3.5" y="7" width="17" height="10" rx="2"/><path d="M7 12h7"/>',
    defaults: (dev) => ({
      w: dev.w, h: 60, bg: '#ffffff', radius: 0, text: '列表项文字', fontSize: 16,
      color: '#333333', align: 'left', paddingX: 16, borderWidth: 0,
      divider: true, dividerColor: '#f0f0f0'
    })
  },
  {
    type: 'navbar', label: '导航栏', category: 'layout',
    icon: '<rect x="3.5" y="4" width="17" height="6" rx="2"/><path d="M3.5 14h17"/>',
    defaults: (dev) => ({
      w: dev.w, h: 88, bg: '#ffffff', radius: 0, text: '页面标题', fontSize: 20,
      fontWeight: 700, color: '#222222', align: 'center', borderWidth: 0,
      showBack: false, showAction: true, actionIcon: 'plus', bottomLine: true
    })
  },
  {
    type: 'tabbar', label: '标签栏', category: 'layout',
    icon: '<rect x="3.5" y="14" width="17" height="5.5" rx="2"/><path d="M8 16.7h.01M12 16.7h.01M16 16.7h.01"/>',
    defaults: (dev) => ({
      w: dev.w, h: 50, bg: '#ffffff', radius: 0, borderWidth: 0, topLine: true,
      tabs: ['待办', '已完成', '我的'], activeIndex: 0,
      activeColor: '#1677ff', inactiveColor: '#999999', fontSize: 12
    })
  }
];

export function getComponent(type) {
  for (const c of COMPONENTS) if (c.type === type) return c;
  return COMPONENTS[0];
}

/** 通用节点属性 + 组件默认值 */
function baseNode(type, device) {
  return {
    id: uid(),
    type,
    name: '',
    x: 0,
    y: 0,
    w: 100,
    h: 40,
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
    // 组件状态（墨刀式动态组件的轻量实现：外观变体）
    states: null,        // [{ id, name, style: { bg, text, color, ... } }]
    activeStateId: null,
    // 交互（墨刀式）：点击后做什么
    link: null
  };
}

/** 取节点当前生效的状态对象（没有状态则返回 null） */
export function currentState(node) {
  if (!node || !node.states || !node.states.length) return null;
  for (const s of node.states) if (s.id === node.activeStateId) return s;
  return node.states[0];
}

/** 取"叠加了当前状态外观"的节点视图；不修改原对象 */
export function viewOf(node) {
  const st = currentState(node);
  if (!st || !st.style) return node;
  const merged = Object.assign({}, node, st.style);
  merged.id = node.id;
  merged.type = node.type;
  merged.x = node.x;
  merged.y = node.y;
  merged.w = node.w;
  merged.h = node.h;
  merged.states = node.states;
  merged.activeStateId = node.activeStateId;
  merged.link = node.link;
  return merged;
}

/** 组件状态可选的外观字段（限制范围，避免状态改到位置尺寸） */
export const STATE_STYLE_KEYS = ['text', 'bg', 'color', 'radius', 'fontSize', 'fontWeight', 'borderColor', 'borderWidth', 'align', 'opacity', 'icon', 'checked', 'on', 'activeIndex'];

export function createNode(type, device, patch = {}) {
  const def = getComponent(type);
  const node = Object.assign(baseNode(type, device), def.defaults(device), patch);
  if (!node.name) node.name = def.label;
  // 默认放在可视区上方居中一点，避免全部堆在原点
  if (patch.x === undefined) node.x = Math.round((device.w - node.w) / 2);
  if (patch.y === undefined) node.y = 80;
  return node;
}

export function createPage(name, deviceId = 'iphone17') {
  return {
    id: uid('p'),
    name: name || '页面 1',
    deviceId,
    bg: '#ffffff',
    nodes: []
  };
}

export function createProject(name = '未命名原型') {
  const page = createPage('首页');
  return {
    version: 1,
    name,
    pages: [page],
    activePageId: page.id,
    createdAt: new Date().toISOString()
  };
}

/** 兼容外部 JSON：补齐缺省字段 */
export function normalizeProject(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.pages) || !raw.pages.length) {
    throw new Error('项目文件格式不正确：缺少 pages');
  }
  const pages = raw.pages.map((p, i) => {
    const deviceId = getDevice(p.deviceId).id;
    const device = getDevice(deviceId);
    const nodes = Array.isArray(p.nodes) ? p.nodes.map((n) => {
      const node = Object.assign(baseNode(n.type || 'rect', device), n);
      node.id = n.id || uid();
      return node;
    }) : [];
    return {
      id: p.id || uid('p'),
      name: p.name || ('页面 ' + (i + 1)),
      deviceId,
      bg: p.bg || '#ffffff',
      customW: p.customW > 0 ? Math.round(p.customW) : null,
      customH: p.customH > 0 ? Math.round(p.customH) : null,
      nodes
    };
  });
  return {
    version: 1,
    name: raw.name || '未命名原型',
    pages,
    activePageId: pages.some((p) => p.id === raw.activePageId) ? raw.activePageId : pages[0].id,
    createdAt: raw.createdAt || new Date().toISOString()
  };
}

export function cloneNode(node) {
  const copy = JSON.parse(JSON.stringify(node));
  copy.id = uid();
  copy.name = node.name;
  return copy;
}
