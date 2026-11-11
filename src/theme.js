/**
 * 主题切换：dark / light / auto（跟随系统），持久化到 localStorage。
 */

const THEME_KEY = 'modao-open:theme';
export const THEME_MODES = ['dark', 'light', 'auto'];

const ICONS = {
  light: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>',
  dark: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/>'
};

const TITLES = {
  dark: '当前：深色（点击切到浅色）',
  light: '当前：浅色（点击切到跟随系统）',
  auto: '当前：跟随系统（点击切到深色）'
};

export function normalizeMode(mode) {
  return THEME_MODES.indexOf(mode) >= 0 ? mode : 'dark';
}

export function getStoredTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v ? normalizeMode(v) : 'dark';
  } catch (e) {
    return 'dark';
  }
}

export function themeIconMarkup(mode) {
  return ICONS[normalizeMode(mode)] || ICONS.dark;
}

/** 应用主题；返回实际生效的模式 */
export function applyTheme(mode, root) {
  const m = normalizeMode(mode);
  const el = root || document.documentElement;
  el.setAttribute('data-theme', m);
  try { localStorage.setItem(THEME_KEY, m); } catch (e) { /* 忽略 */ }

  const btn = document.getElementById('themeBtn');
  if (btn) {
    btn.setAttribute('title', TITLES[m]);
    const svg = btn.querySelector('svg');
    if (svg) svg.innerHTML = ICONS[m];
  }
  return m;
}

/** 循环切换：dark → light → auto → dark */
export function cycleTheme(root) {
  const el = root || document.documentElement;
  const cur = normalizeMode(el.getAttribute('data-theme') || getStoredTheme());
  const next = THEME_MODES[(THEME_MODES.indexOf(cur) + 1) % THEME_MODES.length];
  return applyTheme(next, el);
}
