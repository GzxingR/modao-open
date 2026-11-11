/**
 * 键盘与输入设备的纯逻辑判定，方便单测。
 */

/** Esc 该干什么：优先级从高到低 */
export function decideEscape(state) {
  const s = state || {};
  if (s.menuOpen) return 'close-menu';
  if (s.previewOpen) return 'close-preview';
  if (s.modalOpen) return 'close-modal';
  if (s.hasSelection) return 'clear-selection';
  return 'none';
}

/** 双指距离变化 → 目标缩放（带上下限） */
export function pinchZoom(startZoom, startDist, currentDist, min, max) {
  const lo = typeof min === 'number' ? min : 0.1;
  const hi = typeof max === 'number' ? max : 3;
  if (!startDist || startDist < 10) return startZoom;
  const next = startZoom * (currentDist / startDist);
  return Math.max(lo, Math.min(hi, next));
}

/** 两点距离 */
export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 给按钮补齐 aria-label（有 title 就用 title） */
export function ariaLabels(root) {
  const doc = root || document;
  let n = 0;
  doc.querySelectorAll('button').forEach((b) => {
    if (!b.getAttribute('aria-label')) {
      const label = b.getAttribute('title') || (b.textContent || '').trim();
      if (label) {
        b.setAttribute('aria-label', label);
        n += 1;
      }
    }
  });
  return n;
}
