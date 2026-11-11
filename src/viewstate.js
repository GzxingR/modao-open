/**
 * 视图状态记忆：缩放、选中、滚动位置在刷新后恢复。
 * 项目本身（含当前页）由 store 的 localStorage 负责。
 */

const KEY = 'modao-open:view';

export function loadViewState() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return null;
    return {
      zoom: typeof raw.zoom === 'number' && raw.zoom > 0 ? raw.zoom : null,
      selection: Array.isArray(raw.selection) ? raw.selection.filter((x) => typeof x === 'string') : [],
      scrollLeft: Number(raw.scrollLeft) || 0,
      scrollTop: Number(raw.scrollTop) || 0
    };
  } catch (e) {
    return null;
  }
}

export function saveViewState(view) {
  try {
    localStorage.setItem(KEY, JSON.stringify(view));
    return true;
  } catch (e) {
    return false;
  }
}

/** 采集当前视图状态 */
export function captureViewState(store, scroller) {
  return {
    zoom: store.state.zoom,
    selection: (store.state.selection || []).slice(),
    scrollLeft: scroller ? Math.round(scroller.scrollLeft) : 0,
    scrollTop: scroller ? Math.round(scroller.scrollTop) : 0
  };
}

/**
 * 把视图状态套到 store 上。选中里已不存在的 id 会被丢掉（避免恢复出幽灵选中）。
 * 返回实际恢复的信息，便于测试和提示。
 */
export function applyViewState(store, view) {
  if (!view) return { zoom: null, selection: [] };
  let zoom = null;
  if (typeof view.zoom === 'number' && view.zoom > 0) {
    store.state.zoom = Math.max(0.1, Math.min(3, view.zoom));
    zoom = store.state.zoom;
  }
  const alive = (view.selection || []).filter((id) => store.nodeById(id));
  if (alive.length) store.state.selection = alive;
  return { zoom, selection: alive };
}

export function restoreScroll(scroller, view) {
  if (!scroller || !view) return;
  scroller.scrollLeft = Number(view.scrollLeft) || 0;
  scroller.scrollTop = Number(view.scrollTop) || 0;
}
