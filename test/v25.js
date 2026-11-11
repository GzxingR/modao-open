/**
 * v2.5 自测：视图状态记忆（缩放 / 选中 / 滚动）
 */

import { Store } from '../src/store.js';
import { createProject } from '../src/model.js';
import { loadViewState, saveViewState, captureViewState, applyViewState, restoreScroll } from '../src/viewstate.js';

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

function makeStore() {
  const s = new Store();
  s.state.project = createProject('view');
  return s;
}

/* ================= 存取 ================= */
await check('没有存过时返回 null', () => {
  localStorage.removeItem('modao-open:view');
  assert(loadViewState() === null, '应为 null');
  return 'null';
});

await check('保存后能原样读回', () => {
  const v = { zoom: 1.25, selection: ['a', 'b'], scrollLeft: 120, scrollTop: 340 };
  assert(saveViewState(v) === true, '保存失败');
  const back = loadViewState();
  assert(back.zoom === 1.25, 'zoom=' + back.zoom);
  assert(back.selection.join(',') === 'a,b', 'selection=' + back.selection);
  assert(back.scrollLeft === 120 && back.scrollTop === 340, '滚动=' + back.scrollLeft + ',' + back.scrollTop);
  return 'ok';
});

await check('坏数据不炸，字段类型有兜底', () => {
  localStorage.setItem('modao-open:view', '{坏 JSON');
  assert(loadViewState() === null, '坏 JSON 应返回 null');
  localStorage.setItem('modao-open:view', JSON.stringify({ zoom: 'big', selection: 'nope', scrollLeft: 'x' }));
  const v = loadViewState();
  assert(v.zoom === null, 'zoom 应为 null：' + v.zoom);
  assert(Array.isArray(v.selection) && v.selection.length === 0, 'selection 应为空数组');
  assert(v.scrollLeft === 0, 'scrollLeft 应为 0');
  return 'ok';
});

await check('非字符串的选中 id 会被过滤', () => {
  localStorage.setItem('modao-open:view', JSON.stringify({ selection: ['a', 5, null, {}, 'b'] }));
  const v = loadViewState();
  assert(v.selection.join(',') === 'a,b', '过滤结果=' + v.selection.join(','));
  return 'ok';
});

/* ================= 应用到 store ================= */
await check('恢复缩放并夹在 10%~300%', () => {
  const s = makeStore();
  const r = applyViewState(s, { zoom: 1.4, selection: [] });
  assert(s.state.zoom === 1.4, 'zoom=' + s.state.zoom);
  assert(r.zoom === 1.4, '返回值=' + r.zoom);

  applyViewState(s, { zoom: 99, selection: [] });
  assert(s.state.zoom === 3, '上限没夹住：' + s.state.zoom);
  applyViewState(s, { zoom: 0.001, selection: [] });
  assert(s.state.zoom === 0.1, '下限没夹住：' + s.state.zoom);
  return 'ok';
});

await check('选中里已删除的元素会被丢掉', () => {
  const s = makeStore();
  const a = s.addNode('button', { text: '活着' });
  const gone = s.addNode('text', { text: '将被删' });
  const goneId = gone.id;
  s.select([goneId]);
  s.deleteSelected();

  const r = applyViewState(s, { zoom: 1, selection: [a.id, goneId] });
  assert(r.selection.length === 1, '恢复数量=' + r.selection.length);
  assert(r.selection[0] === a.id, '恢复的不是活着的元素');
  assert(s.state.selection.join(',') === a.id, 'store 选中不对');
  return '1 个有效选中';
});

await check('空选中不会覆盖已有选择', () => {
  const s = makeStore();
  const a = s.addNode('button', {});
  s.select([a.id]);
  applyViewState(s, { zoom: 1, selection: [] });
  assert(s.state.selection.length === 1, '被清空了：' + s.state.selection.length);
  return 'ok';
});

/* ================= 采集与滚动 ================= */
await check('captureViewState 采集当前状态', () => {
  const s = makeStore();
  const a = s.addNode('button', {});
  s.select([a.id]);
  s.state.zoom = 1.75;
  const scroller = document.getElementById('scroller');
  scroller.scrollLeft = 88;
  scroller.scrollTop = 66;

  const v = captureViewState(s, scroller);
  assert(v.zoom === 1.75, 'zoom=' + v.zoom);
  assert(v.selection[0] === a.id, 'selection 不对');
  assert(v.scrollLeft === 88 && v.scrollTop === 66, '滚动=' + v.scrollLeft + ',' + v.scrollTop);
  return 'ok';
});

await check('restoreScroll 真的把滚动位置还原', () => {
  const scroller = document.getElementById('scroller');
  scroller.scrollLeft = 0;
  scroller.scrollTop = 0;
  restoreScroll(scroller, { scrollLeft: 150, scrollTop: 210 });
  assert(scroller.scrollLeft === 150, 'left=' + scroller.scrollLeft);
  assert(scroller.scrollTop === 210, 'top=' + scroller.scrollTop);
  restoreScroll(null, { scrollLeft: 1 });
  return 'ok';
});

await check('没存过视图时 applyViewState 不改 store', () => {
  const s = makeStore();
  const z0 = s.state.zoom;
  const r = applyViewState(s, null);
  assert(s.state.zoom === z0, 'zoom 被改了');
  assert(r.selection.length === 0, 'selection 应为空');
  return 'ok';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
