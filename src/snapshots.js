/**
 * 本地版本快照：把整个项目存成一份带名字的历史，随时可以回滚。
 * 存在独立的 localStorage key 里，和当前项目互不影响。
 */

const KEY = 'modao-open:snapshots';
export const MAX_SNAPSHOTS = 10;

function readAll() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

/** 列表（新的在前），不带 project 主体，避免把整份数据读进内存 */
export function listSnapshots() {
  return readAll().map((s) => ({
    id: s.id,
    name: s.name,
    at: s.at,
    bytes: s.bytes,
    pages: s.pages,
    nodes: s.nodes
  }));
}

export function getSnapshot(id) {
  return readAll().find((s) => s.id === id) || null;
}

function countProject(project) {
  const pages = (project && project.pages) || [];
  let nodes = 0;
  for (const p of pages) nodes += (p.nodes || []).length;
  return { pages: pages.length, nodes };
}

/**
 * 存一份快照。返回 { ok, snapshot?, error?, dropped? }
 */
export function saveSnapshot(project, name) {
  if (!project) return { ok: false, error: '没有可保存的项目' };
  let payload;
  try {
    payload = JSON.stringify(project);
  } catch (e) {
    return { ok: false, error: '项目无法序列化' };
  }

  const meta = countProject(project);
  const snap = {
    id: 'snap-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    name: String(name || '').trim() || ('版本 ' + new Date().toLocaleString('zh-CN')),
    at: Date.now(),
    bytes: payload.length,
    pages: meta.pages,
    nodes: meta.nodes,
    project: JSON.parse(payload)
  };

  let list = readAll();
  list.unshift(snap);

  let dropped = 0;
  while (list.length > MAX_SNAPSHOTS) {
    list.pop();
    dropped += 1;
  }

  if (!writeAll(list)) {
    // 空间不够：逐步砍旧版本再试
    while (list.length > 1) {
      list.pop();
      dropped += 1;
      if (writeAll(list)) {
        return { ok: true, snapshot: snap, dropped, warning: '存储空间紧张，已丢弃较旧的版本' };
      }
    }
    return { ok: false, error: '本地存储已满，存不下新的版本' };
  }

  return { ok: true, snapshot: snap, dropped };
}

export function deleteSnapshot(id) {
  const list = readAll().filter((s) => s.id !== id);
  return writeAll(list);
}

export function clearSnapshots() {
  return writeAll([]);
}

/** 快照总共占了多少字节 */
export function snapshotsBytes() {
  return readAll().reduce((sum, s) => sum + (s.bytes || 0), 0);
}

export function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return v + ' B';
  if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB';
  return (v / 1024 / 1024).toFixed(2) + ' MB';
}

export function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (x) => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
