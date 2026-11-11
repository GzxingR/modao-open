/**
 * 画布右键菜单：由调用方给菜单项，这里只负责定位、显示和关闭。
 */

let menuEl = null;
let currentItems = [];

function ensureMenu() {
  if (menuEl && document.body.contains(menuEl)) return menuEl;
  menuEl = document.createElement('div');
  menuEl.id = 'ctxMenu';
  menuEl.className = 'ctx-menu';
  menuEl.hidden = true;
  document.body.appendChild(menuEl);

  // 点击其它地方关闭
  document.addEventListener('pointerdown', (e) => {
    if (menuEl && !menuEl.hidden && !menuEl.contains(e.target)) hideMenu();
  }, true);
  window.addEventListener('blur', hideMenu);
  window.addEventListener('resize', hideMenu);
  return menuEl;
}

export function hideMenu() {
  if (menuEl) menuEl.hidden = true;
  currentItems = [];
}

/**
 * 打开菜单。items: [{ label, hint?, action:()=>void, disabled?, danger?, divider? }]
 */
export function openMenu(x, y, items) {
  const el = ensureMenu();
  el.textContent = '';
  currentItems = items || [];

  for (const item of currentItems) {
    if (item.divider) {
      const d = document.createElement('div');
      d.className = 'ctx-divider';
      el.appendChild(d);
      continue;
    }
    const btn = document.createElement('button');
    btn.className = 'ctx-item' + (item.danger ? ' danger' : '');
    btn.textContent = item.label;
    if (item.hint) {
      const h = document.createElement('span');
      h.className = 'ctx-hint';
      h.textContent = item.hint;
      btn.appendChild(h);
    }
    if (item.disabled) {
      btn.disabled = true;
    } else {
      btn.addEventListener('click', () => {
        hideMenu();
        try { item.action(); } catch (e) { console.error('[ctxmenu]', e); }
      });
    }
    el.appendChild(btn);
  }

  el.hidden = false;
  // 先显示再测尺寸，避免超出视口
  const rect = el.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - 8;
  const maxY = window.innerHeight - rect.height - 8;
  el.style.left = Math.max(8, Math.min(x, maxX)) + 'px';
  el.style.top = Math.max(8, Math.min(y, maxY)) + 'px';
  return el;
}

export function isMenuOpen() {
  return !!(menuEl && !menuEl.hidden);
}
