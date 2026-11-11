/**
 * 左栏面板可拖拽分栏：拖动 .resizer 调整相邻两块面板高度，比例存 localStorage。
 */

const PANE_KEY = 'modao-open:left-panes';

export function initResizers(options = {}) {
  const paneIds = options.paneIds || ['panePages', 'paneLayers', 'paneLibrary'];
  const container = options.container || document.querySelector('.left');
  const minHeight = options.minHeight || 72;

  if (!container) return { restore() {}, save() {} };

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(PANE_KEY) || 'null');
      if (!Array.isArray(saved) || saved.length !== paneIds.length) return;
      paneIds.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el && typeof saved[i] === 'number' && saved[i] > 0) {
          el.style.flex = '0 0 ' + saved[i] + '%';
        }
      });
    } catch (e) { /* 坏数据忽略 */ }
  }

  function save() {
    const leftH = container.clientHeight || 1;
    const ratios = paneIds.map((id) => {
      const el = document.getElementById(id);
      if (!el) return 0;
      return Math.round((el.getBoundingClientRect().height / leftH) * 1000) / 10;
    });
    try { localStorage.setItem(PANE_KEY, JSON.stringify(ratios)); } catch (e) { /* 忽略 */ }
    return ratios;
  }

  restore();

  const resizers = container.querySelectorAll('.resizer');
  resizers.forEach((rz) => {
    rz.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const prev = rz.previousElementSibling;
      const next = rz.nextElementSibling;
      if (!prev || !next) return;

      const startY = e.clientY;
      const startPrev = prev.getBoundingClientRect().height;
      const startNext = next.getBoundingClientRect().height;
      const total = startPrev + startNext;

      function onMove(ev) {
        const dy = ev.clientY - startY;
        const hp = Math.max(minHeight, Math.min(total - minHeight, startPrev + dy));
        prev.style.flex = '0 0 ' + hp + 'px';
        next.style.flex = '0 0 ' + (total - hp) + 'px';
      }

      function onUp() {
        window.removeEventListener('pointermove', onMove);
        save();
      }

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
    });
  });

  return { restore, save };
}
