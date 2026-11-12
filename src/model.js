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

/** 交互触发方式 */
export const TRIGGERS = [
  { value: 'click', label: '单击' },
  { value: 'dblclick', label: '双击' },
  { value: 'longpress', label: '长按' },
  { value: 'down', label: '按下' },
  { value: 'up', label: '抬起' },
  { value: 'mouseenter', label: '鼠标移入' },
  { value: 'mouseleave', label: '鼠标移出' },
  { value: 'contextmenu', label: '右键' },
  { value: 'keydown', label: '键盘按键' },
  { value: 'swipeLeft', label: '左滑' },
  { value: 'swipeRight', label: '右滑' },
  { value: 'swipeUp', label: '上滑' },
  { value: 'swipeDown', label: '下滑' },
  { value: 'watch', label: '监听变量变化' },
  { value: 'shake', label: '摇一摇' },
  { value: 'load', label: '载入时' }
];

/** 交互行为 */
export const ACTIONS = [
  { value: 'none', label: '无交互' },
  { value: 'navigate', label: '跳转页面' },
  { value: 'state', label: '切换组件状态' },
  { value: 'show', label: '显示目标' },
  { value: 'hide', label: '隐藏目标' },
  { value: 'toggle', label: '切换目标显隐' },
  { value: 'scrollTo', label: '滚动到目标' },
  { value: 'openOverlay', label: '打开浮层' },
  { value: 'closeOverlay', label: '关闭浮层' },
  { value: 'setVar', label: '设置变量值' },
  { value: 'url', label: '打开链接' }
];

export function triggerLabel(v) {
  for (const t of TRIGGERS) if (t.value === v) return t.label;
  return '单击';
}

export function actionLabel(v) {
  for (const a of ACTIONS) if (a.value === v) return a.label;
  return v || '';
}

let counter = 0;
export function uid(prefix = 'n') {
  counter += 1;
  return prefix + Date.now().toString(36) + counter.toString(36);
}

/** 图标库：24x24 viewBox 的 path，便于画布和组件库复用 */
export const ICONS = {
  // —— 界面 ——
  settings: 'M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  filter: 'M4 5h16l-6 7.5V19l-4-2v-4.5L4 5z',
  sort: 'M7 4v14M4 15l3 3 3-3M17 20V6M14 9l3-3 3 3',
  refresh: 'M4.5 12a7.5 7.5 0 0 1 12.8-5.3M19.5 12a7.5 7.5 0 0 1-12.8 5.3M17 3v4h-4M7 21v-4h4',
  logout: 'M9 4.5H5.5v15H9M15 8l4 4-4 4M19 12H9',
  login: 'M9 4.5h5.5v15H9M4 12l4-4M4 12l4 4M4 12h10',
  eye: 'M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12zM12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z',
  eyeOff: 'M4 4l16 16M9.8 5.6A9.6 9.6 0 0 1 12 5.4c6 0 9.5 6.6 9.5 6.6a17 17 0 0 1-3 3.6M6.4 7.4C3.9 9.2 2.5 12 2.5 12s3.5 5.5 9.5 5.5c1.3 0 2.5-.3 3.6-.7',
  lock: 'M6.5 11h11v9h-11zM9 11V8a3 3 0 0 1 6 0v3',
  unlock: 'M6.5 11h11v9h-11zM9 11V8a3 3 0 0 1 5.6-1.5',
  info: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 11v5M12 8h.01',
  warning: 'M12 3.8l9 16H3l9-16zM12 9.5v4.5M12 17h.01',
  success: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM8 12.3l2.8 2.8L16 9.6',
  errorCircle: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM9 9l6 6M15 9l-6 6',
  help: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM9.5 9.4a2.6 2.6 0 1 1 3.6 2.4c-.8.3-1.1.9-1.1 1.8M12 17.3h.01',

  // —— 导航 ——
  chevronLeft: 'M14.5 6l-6 6 6 6',
  chevronRight: 'M9.5 6l6 6-6 6',
  chevronUp: 'M6 14.5l6-6 6 6',
  chevronDown: 'M6 9.5l6 6 6-6',
  arrowUp: 'M12 19V6M6.5 11L12 5.5 17.5 11',
  arrowDown: 'M12 5v13M6.5 13l5.5 5.5L17.5 13',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  list: 'M4 7h16M4 12h16M4 17h10',
  layout: 'M4 5h16v14H4zM4 10h16M10 10v9',

  // —— 媒体 ——
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4zM12 10.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  image: 'M4 6h16v12H4zM7 15l3-3 2.5 2.5L15 12l2 3M8.5 9.5h.01',
  video: 'M4 7h11v10H4zM15 11l5-3v8l-5-3',
  play: 'M9 6.5l9 5.5-9 5.5z',
  pause: 'M9 6v12M15 6v12',
  mic: 'M12 4a2.5 2.5 0 0 0-2.5 2.5v5a2.5 2.5 0 0 0 5 0v-5A2.5 2.5 0 0 0 12 4zM6 12a6 6 0 0 0 12 0M12 18v3',
  music: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',

  // —— 通讯 ——
  mail: 'M3.5 6h17v12h-17zM3.5 6.5l8.5 7 8.5-7',
  phone: 'M7 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 5 5.5a2 2 0 0 1 2-2z',
  chat: 'M4 5h16v11H9l-5 4z',
  share: 'M18 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 15a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8.2 11.2l7.6-3.4M8.2 12.8l7.6 3.4',
  link: 'M10 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7L11 6.8M14 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 0 0 5.7 5.7L13 17.2',

  // —— 商业 ——
  bag: 'M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 0 1 6 0v2',
  gift: 'M3.5 11h17v9h-17zM3.5 11V8h17v3M12 8v12M12 8c-1-3-5-3-5-.5S12 8 12 8zM12 8c1-3 5-3 5-.5S12 8 12 8z',
  tag: 'M4 4h8l8 8-8 8-8-8zM8.5 8.5h.01',
  coupon: 'M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4zM9 6v12',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
  barcode: 'M4 5v14M7 5v14M10 5v10M13 5v14M16 5v10M20 5v14',
  card: 'M3 6h18v12H3zM3 10h18M6.5 14.5h3',

  // —— 位置与时间 ——
  map: 'M9 4l-6 2.5v13L9 17l6 2 6-2.5v-13L15 6zM9 4v13M15 6v13',
  location: 'M12 21s6.5-6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  calendar: 'M4 6.5h16v14H4zM4 10.5h16M8.5 4v4M15.5 4v4',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2',

  // —— 系统 ——
  download: 'M12 4v11M7.5 11L12 15.5 16.5 11M4.5 19.5h15',
  upload: 'M12 16V5M7.5 9.5L12 5l4.5 4.5M4.5 19.5h15',
  trash: 'M4.5 7h15M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5',
  edit: 'M4 20h4l10-10-4-4L4 16zM14.5 5.5l4 4',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  save: 'M4 4h12l4 4v12H4zM8 4v6h8V4M8 20v-6h8v6',
  wifi: 'M3 9a14 14 0 0 1 18 0M6.5 12.5a9 9 0 0 1 11 0M10 16a4 4 0 0 1 4 0M12 19.5h.01',
  bluetooth: 'M12 3v18l5-4.5-10-7 10-7L12 7',
  battery: 'M3 8h15v8H3zM20 11v2M6 11v2M9 11v2',
  cloud: 'M7 18a4 4 0 0 1 .6-8 5.5 5.5 0 0 1 10.4 1.6A3.5 3.5 0 0 1 17.5 18z',
  folder: 'M3.5 6h6l2 2.5h9V18h-17z',
  doc: 'M6 3.5h8l4 4V20H6zM14 3.5V8h4M9 12h6M9 15.5h6',
  chart: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6',
  sun: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',

  // —— 原有 ——
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

/** 图标分类，供面板分组显示 */
export const ICON_GROUPS = {
  界面: ['settings', 'more', 'filter', 'sort', 'refresh', 'logout', 'login', 'eye', 'eyeOff', 'lock', 'unlock', 'info', 'warning', 'success', 'errorCircle', 'help'],
  导航: ['chevronLeft', 'chevronRight', 'chevronUp', 'chevronDown', 'arrowLeft', 'arrowRight', 'arrowUp', 'arrowDown', 'grid', 'list', 'layout', 'menu', 'home'],
  媒体: ['camera', 'image', 'video', 'play', 'pause', 'mic', 'music'],
  通讯: ['mail', 'phone', 'chat', 'share', 'link', 'bell', 'user'],
  商业: ['bag', 'gift', 'tag', 'coupon', 'qr', 'barcode', 'card', 'cart', 'wallet', 'star', 'heart'],
  位置时间: ['map', 'location', 'calendar', 'clock'],
  系统: ['download', 'upload', 'trash', 'edit', 'copy', 'save', 'wifi', 'bluetooth', 'battery', 'cloud', 'folder', 'doc', 'chart', 'sun', 'moon', 'plus', 'check', 'close', 'search', 'dot']
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
    letterSpacing: 0,
    maxLines: 0,
    paddingX: 0,
    src: '',
    locked: false,
    hidden: false,
    // 组件状态（墨刀式动态组件的轻量实现：外观变体）
    states: null,        // [{ id, name, style: { bg, text, color, ... } }]
    activeStateId: null,
    // 浮层（仅 group 用）：作为弹层挂在页面最上层，可带遮罩
    overlay: false,
    overlayMask: true,
    defaultOpen: false,
    // 交互（墨刀式）：触发方式 + 行为
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

/**
 * 分组当前该渲染哪些子元素：
 * 若该组的状态里带了 children（真动态组件），用当前状态的；否则用组自己的 children。
 */
export function currentGroupChildren(node) {
  const st = currentState(node);
  if (st && Array.isArray(st.children) && st.children.length) return st.children;
  return node.children || [];
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

/** 条件运算符 */
export const CONDITION_OPS = [
  { value: 'eq', label: '等于' },
  { value: 'neq', label: '不等于' },
  { value: 'truthy', label: '为真' },
  { value: 'falsy', label: '为假' }
];

export function createVariable(name, value) {
  return {
    id: uid('v'),
    name: name || 'var' + Math.floor(Math.random() * 1000),
    value: value == null ? '' : String(value)
  };
}

export function createProject(name = '未命名原型') {
  const page = createPage('首页');
  return {
    version: 1,
    name,
    pages: [page],
    activePageId: page.id,
    variables: [],
    components: [],
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
    variables: Array.isArray(raw.variables) ? raw.variables.map((v) => ({
      id: v.id || uid('v'),
      name: String(v.name == null ? 'var' : v.name),
      value: v.value == null ? '' : String(v.value)
    })) : [],
    components: Array.isArray(raw.components) ? raw.components.map((c) => ({
      id: c.id || uid('c'),
      name: String(c.name == null ? '组件' : c.name),
      w: Number(c.w) || 100,
      h: Number(c.h) || 40,
      children: Array.isArray(c.children) ? c.children : [],
      createdAt: c.createdAt || Date.now()
    })) : [],
    createdAt: raw.createdAt || new Date().toISOString()
  };
}

export function cloneNode(node) {
  const copy = JSON.parse(JSON.stringify(node));
  copy.id = uid();
  copy.name = node.name;
  return copy;
}
