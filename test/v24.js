/**
 * v2.4 自测：帮助面板、保存状态反馈、可撤销删除
 */

import { Store } from '../src/store.js';
import { createProject } from '../src/model.js';
import { HELP_SECTIONS, HELP_TIPS, renderHelpContent } from '../src/help.js';

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

/* ================= 帮助 ================= */
await check('帮助数据分 6 节且每节有条目', () => {
  assert(HELP_SECTIONS.length === 6, '节数=' + HELP_SECTIONS.length);
  for (const sec of HELP_SECTIONS) {
    assert(sec.title, '某节缺标题');
    assert(Array.isArray(sec.items) && sec.items.length >= 4, sec.title + ' 条目太少：' + (sec.items && sec.items.length));
    for (const it of sec.items) {
      assert(it.length === 2 && it[0] && it[1], sec.title + ' 有条目格式不对');
    }
  }
  const total = HELP_SECTIONS.reduce((s, x) => s + x.items.length, 0);
  return HELP_SECTIONS.length + ' 节 / ' + total + ' 条';
});

await check('帮助内容渲染出关键快捷键', () => {
  const el = renderHelpContent('v2.4.0');
  const text = el.textContent;
  ['空格 + 拖拽', 'Ctrl + 滚轮', 'Ctrl + Z', 'Ctrl + G', 'Ctrl + 滚轮', '项目 JSON', '项目级'].forEach((k) => {
    assert(text.indexOf(k) >= 0, '缺关键词：' + k);
  });
  assert(text.indexOf('v2.4.0') >= 0, '缺版本号');
  assert(text.indexOf('MIT') >= 0, '缺协议');
  return el.querySelectorAll('.help-section-title').length + ' 个分组标题';
});

await check('帮助里有提醒条目', () => {
  assert(HELP_TIPS.length >= 3, '提醒太少');
  const el = renderHelpContent('v2.4.0');
  const lis = el.querySelectorAll('.help-tips li');
  assert(lis.length === HELP_TIPS.length, '列表项数=' + lis.length);
  return HELP_TIPS.length + ' 条提醒';
});

/* ================= 保存状态 ================= */
await check('保存成功时状态为 saved', () => {
  const s = new Store();
  s.state.project = createProject('save');
  s.persist();
  assert(s.state.saveState === 'saved', 'state=' + s.state.saveState);
  assert(s.state.saveError === null, 'error 应为空');
  return 'saved';
});

await check('保存失败时给出可读原因', () => {
  const s = new Store();
  s.state.project = createProject('save2');
  const orig = localStorage.setItem;
  let sawEvent = null;
  s.subscribe((state, reason) => { if (reason === 'save') sawEvent = state.saveState; });
  localStorage.setItem = function () {
    const e = new Error('quota exceeded');
    e.name = 'QuotaExceededError';
    throw e;
  };
  try {
    s.persist();
  } finally {
    localStorage.setItem = orig;
  }
  assert(s.state.saveState === 'error', 'state=' + s.state.saveState);
  assert(String(s.state.saveError).indexOf('存储空间') >= 0, '原因=' + s.state.saveError);
  assert(sawEvent === 'error', '没发 save 事件');
  return s.state.saveError;
});

await check('恢复可写后状态回到 saved', () => {
  const s = new Store();
  s.state.project = createProject('save3');
  s.persist();
  assert(s.state.saveState === 'saved', '没恢复');
  return 'ok';
});

/* ================= 可撤销删除 ================= */
await check('删除后 undo 能完整恢复', () => {
  const s = new Store();
  s.state.project = createProject('undo');
  const a = s.addNode('button', { text: 'A' });
  s.addNode('text', { text: 'B' });
  const before = s.page.nodes.length;
  s.select([a.id]);
  s.deleteSelected();
  assert(s.page.nodes.length === before - 1, '删除后数量=' + s.page.nodes.length);
  s.undo();
  assert(s.page.nodes.length === before, 'undo 后数量=' + s.page.nodes.length);
  return before - 1 + ' → ' + s.page.nodes.length;
});

await check('删空整页后 undo 也恢复', () => {
  const s = new Store();
  s.state.project = createProject('undo2');
  s.addNode('rect');
  s.addNode('text');
  s.addNode('button');
  const total = s.page.nodes.length;
  s.select(s.page.nodes.map((n) => n.id));
  s.deleteSelected();
  assert(s.page.nodes.length === 0, '没清空');
  s.undo();
  assert(s.page.nodes.length === total, '恢复数量=' + s.page.nodes.length);
  return total + ' 个元素恢复';
});

await check('删除页面后 undo 能恢复', () => {
  const s = new Store();
  s.state.project = createProject('undo3');
  s.addPage('临时页');
  const total = s.project.pages.length;
  s.setActivePage(s.project.pages[1].id);
  s.deletePage(s.project.pages[1].id);
  assert(s.project.pages.length === total - 1, '删除失败');
  s.undo();
  assert(s.project.pages.length === total, '恢复失败：' + s.project.pages.length);
  return total + ' 页恢复';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
