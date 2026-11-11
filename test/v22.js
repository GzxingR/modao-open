/**
 * v2.2 自测：补齐触发方式（按下/抬起/右键/键盘/监听变量/摇一摇）
 */

import { Store } from '../src/store.js';
import { createProject, getDevice, TRIGGERS } from '../src/model.js';
import { createPreviewRuntime } from '../src/links.js';
import { buildStandaloneHtml } from '../src/exportHtml.js';

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 两页项目 + 一个触发器节点 */
function makeProject(linkFactory, withVar) {
  const s = new Store();
  s.state.project = createProject('trig');
  if (withVar) s.addVariable('flag', '');
  s.addPage('第二页');
  s.setActivePage(s.project.pages[0].id);
  const target = s.project.pages[1];
  const btn = s.addNode('button', { x: 20, y: 20, w: 160, h: 40, text: '触发' });
  const link = linkFactory(btn, target, s);
  if (link) s.updateNode(btn.id, { link });
  return { s, btn, target };
}

function boot(s) {
  const project = JSON.parse(JSON.stringify(s.project));
  for (const p of project.pages) p.device = getDevice(p.deviceId);
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const rt = createPreviewRuntime(project, project.pages[0].id, mount);
  rt.start();
  return { rt, mount };
}

function pressKey(key) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true }));
}

/* ================= 触发方式表 ================= */
await check('触发方式补齐到 16 种', () => {
  const names = TRIGGERS.map((t) => t.value);
  ['down', 'up', 'contextmenu', 'keydown', 'watch', 'shake'].forEach((k) => {
    assert(names.indexOf(k) >= 0, '缺 ' + k);
  });
  assert(TRIGGERS.length === 16, '总数=' + TRIGGERS.length);
  return TRIGGERS.length + ' 种';
});

/* ================= 按下 / 抬起 ================= */
await check('按下触发', () => {
  const { s, btn, target } = makeProject((b, t) => ({ action: 'navigate', trigger: 'down', targetPageId: t.id }));
  const { rt, mount } = boot(s);
  const el = mount.querySelector('[data-id="' + btn.id + '"]');
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 41, button: 0 }));
  assert(rt.currentPage().id === target.id, '按下没触发');
  mount.remove();
  return 'ok';
});

await check('抬起触发', () => {
  const { s, btn, target } = makeProject((b, t) => ({ action: 'navigate', trigger: 'up', targetPageId: t.id }));
  const { rt, mount } = boot(s);
  const el = mount.querySelector('[data-id="' + btn.id + '"]');
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 42, button: 0 }));
  assert(rt.currentPage().id === target.id, '抬起没触发');
  mount.remove();
  return 'ok';
});

/* ================= 右键 ================= */
await check('右键触发且阻止默认菜单', () => {
  const { s, btn, target } = makeProject((b, t) => ({ action: 'navigate', trigger: 'contextmenu', targetPageId: t.id }));
  const { rt, mount } = boot(s);
  const el = mount.querySelector('[data-id="' + btn.id + '"]');
  const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  assert(ev.defaultPrevented, '没阻止浏览器右键菜单');
  assert(rt.currentPage().id === target.id, '右键没触发');
  mount.remove();
  return 'ok';
});

/* ================= 键盘 ================= */
await check('键盘按键：指定键才触发', () => {
  const { s, btn, target } = makeProject((b, t) => ({
    action: 'navigate', trigger: 'keydown', keyName: 'Enter', targetPageId: t.id
  }));
  const { rt, mount } = boot(s);
  pressKey('a');
  assert(rt.currentPage().id !== target.id, 'a 键不该触发');
  pressKey('Enter');
  assert(rt.currentPage().id === target.id, 'Enter 没触发');
  mount.remove();
  void btn;
  return 'ok';
});

await check('destroy 后不再响应键盘', () => {
  const { s, target } = makeProject((b, t) => ({
    action: 'navigate', trigger: 'keydown', keyName: 'Enter', targetPageId: t.id
  }));
  const { rt, mount } = boot(s);
  rt.destroy();
  pressKey('Enter');
  assert(rt.currentPage().id !== target.id, 'destroy 后还能触发');
  mount.remove();
  return 'ok';
});

/* ================= 摇一摇 ================= */
await check('摇一摇：大加速度才触发', () => {
  const { s, target } = makeProject((b, t) => ({ action: 'navigate', trigger: 'shake', targetPageId: t.id }));
  const { rt, mount } = boot(s);

  const soft = new Event('devicemotion');
  soft.accelerationIncludingGravity = { x: 1, y: 1, z: 1 };
  window.dispatchEvent(soft);
  assert(rt.currentPage().id !== target.id, '轻微晃动不该触发');

  const hard = new Event('devicemotion');
  hard.accelerationIncludingGravity = { x: 20, y: 20, z: 20 };
  window.dispatchEvent(hard);
  assert(rt.currentPage().id === target.id, '大力摇动没触发');
  mount.remove();
  return 'ok';
});

/* ================= 监听变量 ================= */
await check('监听变量：变量变化后满足条件才执行', () => {
  const s = new Store();
  s.state.project = createProject('watch');
  s.addVariable('flag', '');
  s.addPage('第二页');
  s.setActivePage(s.project.pages[0].id);
  const target = s.project.pages[1];

  const setBtn = s.addNode('button', { x: 20, y: 20, w: 160, h: 40, text: '置1' });
  s.updateNode(setBtn.id, { link: { action: 'setVar', trigger: 'click', varName: 'flag', varValue: '1' } });

  const watchNode = s.addNode('text', { x: 20, y: 300, w: 120, h: 30, text: '监听器' });
  s.updateNode(watchNode.id, {
    link: {
      action: 'navigate', trigger: 'watch', targetPageId: target.id,
      condition: { varName: 'flag', op: 'truthy' }
    }
  });

  const { rt, mount } = boot(s);
  assert(rt.currentPage().id !== target.id, '初始不该跳');
  mount.querySelector('[data-id="' + setBtn.id + '"]').click();
  assert(rt.currentPage().id === target.id, '变量变化后监听没触发');
  mount.remove();
  return 'flag=' + rt.getVar('flag');
});

await check('监听变量：条件不满足时不执行', () => {
  const s = new Store();
  s.state.project = createProject('watch2');
  s.addVariable('flag', '');
  s.addPage('第二页');
  s.setActivePage(s.project.pages[0].id);
  const target = s.project.pages[1];

  const setBtn = s.addNode('button', { x: 20, y: 20, w: 160, h: 40, text: '置0' });
  s.updateNode(setBtn.id, { link: { action: 'setVar', trigger: 'click', varName: 'flag', varValue: '0' } });

  const watchNode = s.addNode('text', { x: 20, y: 300, w: 120, h: 30, text: '监听器' });
  s.updateNode(watchNode.id, {
    link: {
      action: 'navigate', trigger: 'watch', targetPageId: target.id,
      condition: { varName: 'flag', op: 'truthy' }
    }
  });

  const { rt, mount } = boot(s);
  mount.querySelector('[data-id="' + setBtn.id + '"]').click();
  assert(rt.currentPage().id !== target.id, '值为 0 时不该触发');
  mount.remove();
  return 'ok';
});

/* ================= 导出 ================= */
await check('演示 HTML 支持新触发器', () => {
  const { s } = makeProject((b, t) => ({
    action: 'navigate', trigger: 'keydown', keyName: 'Enter', targetPageId: t.id
  }));
  const html = buildStandaloneHtml(s.project);
  assert(html.indexOf('data-lk') >= 0, '缺键名属性');
  assert(html.indexOf('devicemotion') >= 0, '缺摇一摇逻辑');
  assert(html.indexOf('data-t="watch"') >= 0 || html.indexOf('runWatchers') >= 0, '缺监听逻辑');
  assert(html.indexOf("t === 'contextmenu'") >= 0 || html.indexOf('contextmenu') >= 0, '缺右键逻辑');
  return Math.round(html.length / 1024) + ' KB';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
