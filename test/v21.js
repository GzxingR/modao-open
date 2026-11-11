/**
 * v2.1 自测：变量 + 条件判断 + 设置变量值
 */

import { Store } from '../src/store.js';
import { createProject, getDevice, ACTIONS, CONDITION_OPS, createVariable, normalizeProject } from '../src/model.js';
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

/* ================= 数据层 ================= */
await check('项目默认带空变量表', () => {
  const p = createProject('v');
  assert(Array.isArray(p.variables), 'variables 不是数组');
  assert(p.variables.length === 0, '默认不该有变量');
  return 'ok';
});

await check('变量增删改', () => {
  const s = new Store();
  s.state.project = createProject('v');
  const a = s.addVariable('account', 'guest');
  const b = s.addVariable('agree', '');
  assert(s.project.variables.length === 2, '数量=' + s.project.variables.length);
  assert(a.name === 'account' && a.value === 'guest', '初值不对');

  s.updateVariable(a.id, { value: 'alice' });
  assert(s.variableById(a.id).value === 'alice', '改值失败');
  s.updateVariable(b.id, { name: 'isAgree' });
  assert(s.variableById(b.id).name === 'isAgree', '改名失败');

  s.removeVariable(a.id);
  assert(s.project.variables.length === 1, '删除失败');
  assert(s.variableById(a.id) === null, '还能查到已删的');
  return 'ok';
});

await check('变量随项目序列化往返', () => {
  const s = new Store();
  s.state.project = createProject('v');
  s.addVariable('token', 'abc');
  const back = normalizeProject(JSON.parse(JSON.stringify(s.project)));
  assert(back.variables.length === 1, '丢了：' + JSON.stringify(back.variables));
  assert(back.variables[0].name === 'token', 'name 丢了');
  assert(back.variables[0].value === 'abc', 'value 丢了');
  return 'ok';
});

await check('行为表与运算符表完整', () => {
  const names = ACTIONS.map((a) => a.value);
  assert(names.indexOf('setVar') >= 0, '缺 setVar');
  assert(CONDITION_OPS.length === 4, '运算符数=' + CONDITION_OPS.length);
  return ACTIONS.length + ' 行为 / ' + CONDITION_OPS.length + ' 运算符';
});

/* ================= 预览运行时 ================= */
function makeProject() {
  const s = new Store();
  s.state.project = createProject('cond');
  s.addVariable('flag', '');
  s.addPage('第二页');
  s.setActivePage(s.project.pages[0].id);
  const target = s.project.pages[1];

  const setBtn = s.addNode('button', { x: 20, y: 20, w: 140, h: 40, text: '设置flag' });
  s.updateNode(setBtn.id, {
    link: { action: 'setVar', trigger: 'click', varName: 'flag', varValue: 'yes' }
  });

  const goBtn = s.addNode('button', { x: 20, y: 80, w: 140, h: 40, text: '第二页' });
  s.updateNode(goBtn.id, {
    link: {
      action: 'navigate', trigger: 'click', targetPageId: target.id,
      condition: { varName: 'flag', op: 'eq', value: 'yes' }
    }
  });

  return { s, setBtn, goBtn, target };
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

await check('setVar 能改运行时变量', () => {
  const { s, setBtn } = makeProject();
  const { rt, mount } = boot(s);
  assert(rt.getVar('flag') === '', '初始值=' + rt.getVar('flag'));
  mount.querySelector('[data-id="' + setBtn.id + '"]').click();
  assert(rt.getVar('flag') === 'yes', '没设上：' + rt.getVar('flag'));
  mount.remove();
  return 'flag=' + rt.getVar('flag');
});

await check('条件不满足时行为不执行', () => {
  const { s, goBtn, target } = makeProject();
  const { rt, mount } = boot(s);
  assert(rt.getVar('flag') === '', '前置条件不成立');
  mount.querySelector('[data-id="' + goBtn.id + '"]').click();
  assert(rt.currentPage().id !== target.id, '不该跳转，却跳到 ' + rt.currentPage().name);
  mount.remove();
  return '未跳转 ✓';
});

await check('条件满足后才跳转', () => {
  const { s, setBtn, goBtn, target } = makeProject();
  const { rt, mount } = boot(s);
  mount.querySelector('[data-id="' + setBtn.id + '"]').click();
  mount.querySelector('[data-id="' + goBtn.id + '"]').click();
  assert(rt.currentPage().id === target.id, '仍然没跳转');
  mount.remove();
  return '跳转到 ' + rt.currentPage().name;
});

await check('neq / truthy / falsy 三种运算符', () => {
  const s = new Store();
  s.state.project = createProject('ops');
  s.addVariable('a', 'x');
  const mk = (op, value) => {
    const n = s.addNode('button', { text: op });
    s.updateNode(n.id, {
      link: { action: 'setVar', trigger: 'click', varName: 'a', varValue: 'y', condition: { varName: 'a', op, value } }
    });
    return n;
  };
  const neqBtn = mk('neq', 'x');      // a=x，neq x → false，不该执行
  const truthyBtn = mk('truthy', ''); // a=x → true，执行
  const falsyBtn = mk('falsy', '');   // a=x → false，不执行

  const { rt, mount } = boot(s);
  mount.querySelector('[data-id="' + neqBtn.id + '"]').click();
  assert(rt.getVar('a') === 'x', 'neq 判断错了');
  mount.querySelector('[data-id="' + falsyBtn.id + '"]').click();
  assert(rt.getVar('a') === 'x', 'falsy 判断错了');
  mount.querySelector('[data-id="' + truthyBtn.id + '"]').click();
  assert(rt.getVar('a') === 'y', 'truthy 没执行');
  mount.remove();
  return 'neq/falsy 拦住，truthy 通过';
});

await check('restart 会把变量重置回初始值', () => {
  const { s, setBtn } = makeProject();
  const { rt, mount } = boot(s);
  mount.querySelector('[data-id="' + setBtn.id + '"]').click();
  assert(rt.getVar('flag') === 'yes', '前置失败');
  rt.restart();
  assert(rt.getVar('flag') === '', 'restart 没重置：' + rt.getVar('flag'));
  mount.remove();
  return 'ok';
});

/* ================= 导出 ================= */
await check('演示 HTML 写入变量与条件元数据', () => {
  const { s } = makeProject();
  const html = buildStandaloneHtml(s.project);
  assert(html.indexOf('"variables"') >= 0, '缺 variables');
  assert(html.indexOf('"flag"') >= 0, '缺变量名');
  assert(html.indexOf('data-cv') >= 0, '缺条件属性');
  assert(html.indexOf('data-vn') >= 0, '缺 setVar 属性');
  assert(html.indexOf('checkCond') >= 0, '运行时缺 checkCond');
  return Math.round(html.length / 1024) + ' KB';
});

await check('createVariable 生成合法对象', () => {
  const v = createVariable('foo', 'bar');
  assert(v.id && v.name === 'foo' && v.value === 'bar', '字段不对：' + JSON.stringify(v));
  return v.id.slice(0, 6) + '…';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
