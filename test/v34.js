/**
 * v3.4 自测：本地版本快照（保存 / 列表 / 恢复 / 删除 / 上限 / 空间不足）
 */

import { Store } from '../src/store.js';
import { createProject } from '../src/model.js';
import {
  listSnapshots, saveSnapshot, getSnapshot, deleteSnapshot,
  clearSnapshots, snapshotsBytes, formatBytes, formatTime, MAX_SNAPSHOTS
} from '../src/snapshots.js';

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

function makeProject(name) {
  const s = new Store();
  s.state.project = createProject(name || '快照测试');
  s.addNode('button', { text: '按钮' });
  return s.project;
}

clearSnapshots();

/* ================= 基本存取 ================= */
await check('初始没有版本', () => {
  clearSnapshots();
  assert(listSnapshots().length === 0, '应为空');
  return '0 个';
});

await check('存一份后能列出，且带统计信息', () => {
  clearSnapshots();
  const project = makeProject();
  const r = saveSnapshot(project, '第一版');
  assert(r.ok, '保存失败：' + r.error);
  const list = listSnapshots();
  assert(list.length === 1, '数量=' + list.length);
  assert(list[0].name === '第一版', '名字=' + list[0].name);
  assert(list[0].pages === 1, '页数=' + list[0].pages);
  assert(list[0].nodes === 1, '元素数=' + list[0].nodes);
  assert(list[0].bytes > 0, '字节数=' + list[0].bytes);
  assert(!list[0].project, '列表不该带整份 project');
  return list[0].pages + ' 页 ' + list[0].nodes + ' 元素 ' + formatBytes(list[0].bytes);
});

await check('没填名字时自动生成', () => {
  clearSnapshots();
  const r = saveSnapshot(makeProject(), '   ');
  assert(r.ok, '保存失败');
  assert(r.snapshot.name.length > 0, '名字为空');
  assert(r.snapshot.name.indexOf('版本') >= 0, '自动名字不对：' + r.snapshot.name);
  return r.snapshot.name;
});

await check('快照是深拷贝，之后改项目不影响已存版本', () => {
  clearSnapshots();
  const project = makeProject();
  const r = saveSnapshot(project, '冻结');
  project.pages[0].nodes[0].text = '改过了';
  const snap = getSnapshot(r.snapshot.id);
  assert(snap.project.pages[0].nodes[0].text === '按钮', '快照被连带改了');
  return 'ok';
});

/* ================= 恢复 ================= */
await check('恢复能把项目还原到快照那一刻', () => {
  clearSnapshots();
  const s = new Store();
  s.state.project = createProject('恢复测试');
  const a = s.addNode('button', { text: '原始按钮' });
  const r = saveSnapshot(s.project, '有按钮');

  s.addNode('rect', { x: 10, y: 200, w: 100, h: 40 });
  assert(s.page.nodes.length === 2, '前置失败');

  const snap = getSnapshot(r.snapshot.id);
  s.loadProject(snap.project);
  assert(s.page.nodes.length === 1, '恢复后元素数=' + s.page.nodes.length);
  assert(s.page.nodes[0].text === '原始按钮', '内容不对');
  return '2 → 1';
});

await check('恢复后还能继续编辑并再存新版', () => {
  clearSnapshots();
  const s = new Store();
  s.state.project = createProject('链式');
  s.addNode('text', { text: 'A' });
  const r1 = saveSnapshot(s.project, 'v1');

  s.addNode('text', { text: 'B' });
  const r2 = saveSnapshot(s.project, 'v2');

  const snap1 = getSnapshot(r1.snapshot.id);
  s.loadProject(snap1.project);
  assert(s.page.nodes.length === 1, '回到 v1 失败');

  const r3 = saveSnapshot(s.project, 'v3');
  assert(r3.ok, '新版本保存失败');
  assert(listSnapshots().length === 3, '版本数=' + listSnapshots().length);
  return 'v1/v2/v3 共 3 个';
});

/* ================= 删除与上限 ================= */
await check('删除单个版本', () => {
  clearSnapshots();
  const project = makeProject();
  const r1 = saveSnapshot(project, 'A');
  saveSnapshot(project, 'B');
  assert(listSnapshots().length === 2, '前置失败');
  deleteSnapshot(r1.snapshot.id);
  const list = listSnapshots();
  assert(list.length === 1, '删除后数量=' + list.length);
  assert(list[0].name === 'B', '删错了：' + list[0].name);
  return 'ok';
});

await check('超过上限时自动丢弃最旧的', () => {
  clearSnapshots();
  const project = makeProject();
  let dropped = 0;
  for (let i = 1; i <= MAX_SNAPSHOTS + 3; i += 1) {
    const r = saveSnapshot(project, '第' + i + '版');
    dropped += r.dropped || 0;
  }
  const list = listSnapshots();
  assert(list.length === MAX_SNAPSHOTS, '数量=' + list.length + '（上限 ' + MAX_SNAPSHOTS + '）');
  assert(dropped === 3, '丢弃数=' + dropped);
  assert(list[0].name === '第' + (MAX_SNAPSHOTS + 3) + '版', '最新的不是最后存的：' + list[0].name);
  assert(list[list.length - 1].name === '第4版', '最旧的应为第4版：' + list[list.length - 1].name);
  return '保留 ' + MAX_SNAPSHOTS + ' 个，丢 ' + dropped + ' 个';
});

await check('字节统计是各版本之和', () => {
  clearSnapshots();
  const project = makeProject();
  saveSnapshot(project, 'A');
  saveSnapshot(project, 'B');
  const total = snapshotsBytes();
  const sum = listSnapshots().reduce((s, x) => s + x.bytes, 0);
  assert(Math.abs(total - sum) < 16, '统计不对：' + total + ' vs ' + sum);
  return formatBytes(total);
});

/* ================= 工具函数 ================= */
await check('formatBytes / formatTime 可读', () => {
  assert(formatBytes(500) === '500 B', 'B=' + formatBytes(500));
  assert(formatBytes(2048) === '2.0 KB', 'KB=' + formatBytes(2048));
  assert(formatBytes(3 * 1024 * 1024).indexOf('MB') > 0, 'MB 不对');
  const t = formatTime(new Date(2026, 10, 12, 10, 30, 0).getTime());
  assert(t.indexOf('2026-11-12') >= 0 && t.indexOf('10:30') >= 0, '时间=' + t);
  return t;
});

await check('坏数据不会让列表崩掉', () => {
  localStorage.setItem('modao-open:snapshots', '{坏 JSON');
  assert(listSnapshots().length === 0, '应返回空数组');
  assert(snapshotsBytes() === 0, '字节应为 0');
  clearSnapshots();
  return 'ok';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
