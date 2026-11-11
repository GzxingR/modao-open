/**
 * v1.9 自测：主题切换（dark / light / auto）+ 画布背景
 */

import { Store } from '../src/store.js';
import { createProject } from '../src/model.js';
import { applyTheme, cycleTheme, getStoredTheme, themeIconMarkup, normalizeMode, THEME_MODES } from '../src/theme.js';
import { renderPage } from '../src/nodes.js';

const results = [];
async function check(name, fn) {
  try {
    const d = await fn();
    results.push('PASS  ' + name + (d ? '  (' + d + ')' : ''));
  } catch (e) {
    results.push('FAIL  ' + name + '  -> ' + (e && e.message ? e.message : e));
  }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }

const root = document.documentElement;

/* ================= 基础 ================= */
await check('三种模式，默认 dark', () => {
  assert(THEME_MODES.length === 3, '模式数=' + THEME_MODES.length);
  assert(THEME_MODES.join(',') === 'dark,light,auto', '顺序=' + THEME_MODES.join(','));
  localStorage.removeItem('modao-open:theme');
  assert(getStoredTheme() === 'dark', '默认不是 dark：' + getStoredTheme());
  assert(normalizeMode('乱七八糟') === 'dark', '非法值没兜底');
  return THEME_MODES.join(' / ');
});

await check('applyTheme 设置 data-theme 并持久化', () => {
  const m = applyTheme('light', root);
  assert(m === 'light', '返回值=' + m);
  assert(root.getAttribute('data-theme') === 'light', '属性没设');
  assert(getStoredTheme() === 'light', '没存 localStorage');
  return root.getAttribute('data-theme');
});

await check('切到 auto 后属性是 auto', () => {
  applyTheme('auto', root);
  assert(root.getAttribute('data-theme') === 'auto', '属性=' + root.getAttribute('data-theme'));
  return 'auto';
});

/* ================= 循环 ================= */
await check('循环顺序 dark → light → auto → dark', () => {
  applyTheme('dark', root);
  const a = cycleTheme(root);
  const b = cycleTheme(root);
  const c = cycleTheme(root);
  assert(a === 'light', '第一次=' + a);
  assert(b === 'auto', '第二次=' + b);
  assert(c === 'dark', '第三次=' + c);
  assert(root.getAttribute('data-theme') === 'dark', '最终属性=' + root.getAttribute('data-theme'));
  return [a, b, c].join(' → ');
});

/* ================= 图标 ================= */
await check('每个模式有不同的图标 path', () => {
  const dark = themeIconMarkup('dark');
  const light = themeIconMarkup('light');
  const auto = themeIconMarkup('auto');
  assert(dark !== light && light !== auto && dark !== auto, '图标重复了');
  assert(light.indexOf('circle') >= 0, 'light 不是太阳');
  assert(dark.indexOf('M20 14.5') >= 0, 'dark 不是月亮');
  return '3 个不同图标';
});

await check('applyTheme 会更新按钮图标和 title', () => {
  const btn = document.getElementById('themeBtn');
  applyTheme('light', root);
  const svg1 = btn.querySelector('svg').innerHTML;
  assert(svg1.indexOf('circle') >= 0, '图标没换成太阳');
  assert(btn.getAttribute('title').indexOf('浅色') >= 0, 'title 没更新：' + btn.getAttribute('title'));
  applyTheme('dark', root);
  const svg2 = btn.querySelector('svg').innerHTML;
  assert(svg2.indexOf('M20 14.5') >= 0, '图标没换成月亮');
  return 'ok';
});

/* ================= CSS 变量真的存在 ================= */
await check('CSS 里有深色与浅色两套变量', async () => {
  const css = await (await fetch('../css/app.css')).text();
  assert(css.indexOf(':root[data-theme="light"]') >= 0, '没有 light 变量块');
  assert(css.indexOf('prefers-color-scheme: light') >= 0, '没有 auto 媒体查询');
  assert(css.indexOf('--accent-soft') >= 0, '没有 accent-soft 变量');
  assert(css.indexOf('--stage-bg') >= 0, '没有 stage-bg 变量');
  return 'ok';
});

await check('浅色主题下文本色变深、背景变浅', () => {
  applyTheme('light', root);
  const sample = document.getElementById('sample');
  const cs = getComputedStyle(sample);
  const textColor = cs.color.replace(/\s/g, '');
  const bg = cs.backgroundColor.replace(/\s/g, '');
  // 浅色：文字 rgb(27,31,36)，背景白色
  assert(bg === 'rgb(255,255,255)', '背景不是白色：' + bg);
  assert(textColor === 'rgb(27,31,36)', '文字色不对：' + textColor);
  return bg + ' / ' + textColor;
});

await check('深色主题下文本色变浅', () => {
  applyTheme('dark', root);
  const sample = document.getElementById('sample');
  const cs = getComputedStyle(sample);
  assert(cs.backgroundColor.replace(/\s/g, '') === 'rgb(27,31,38)', '深色背景不对：' + cs.backgroundColor);
  assert(cs.color.replace(/\s/g, '') === 'rgb(230,232,236)', '深色文字不对：' + cs.color);
  return 'ok';
});

/* ================= 画布背景 ================= */
await check('页面背景可改并进渲染', () => {
  const s = new Store();
  s.state.project = createProject('bg');
  s.setPageBg('#0b1020');
  assert(s.page.bg === '#0b1020', 'store 没记下');
  const host = renderPage(s.page, { device: s.device });
  assert(host.style.background === '#0b1020' || host.style.background.indexOf('11, 16, 32') >= 0,
    '渲染没应用：' + host.style.background);
  return host.style.background;
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
