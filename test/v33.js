/**
 * v3.3 自测：文字高级选项（字距 / 单行省略 / 多行截断）
 */

import { Store } from '../src/store.js';
import { createProject, createNode, getDevice, normalizeProject } from '../src/model.js';
import { createNodeEl } from '../src/nodes.js';

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

const dev = getDevice('iphone17');
const LONG = '这是一段很长很长的文字，用来测试单行省略号和多行截断到底有没有生效，后面还有更多字。';

/* ================= 数据默认值 ================= */
await check('新节点默认字距 0、不截断', () => {
  const n = createNode('text', dev, {});
  assert(n.letterSpacing === 0, 'letterSpacing=' + n.letterSpacing);
  assert(n.maxLines === 0, 'maxLines=' + n.maxLines);
  return 'ok';
});

await check('序列化往返保留字距与行数上限', () => {
  const s = new Store();
  s.state.project = createProject('txt');
  const n = s.addNode('text', { text: '甲', letterSpacing: 2.5, maxLines: 2 });
  const back = normalizeProject(JSON.parse(JSON.stringify(s.project)));
  const b = back.pages[0].nodes.find((x) => x.id === n.id);
  assert(b.letterSpacing === 2.5, '字距丢了：' + b.letterSpacing);
  assert(b.maxLines === 2, '行数上限丢了：' + b.maxLines);
  return 'ok';
});

/* ================= 字距 ================= */
await check('字距作用到渲染样式', () => {
  const el = createNodeEl({ type: 'text', x: 0, y: 0, w: 200, h: 40, text: '字距', letterSpacing: 3, opacity: 1, fontSize: 16, lineHeight: 1.4, maxLines: 0 }, { interactive: false });
  assert(el.style.letterSpacing === '3px', 'letterSpacing=' + el.style.letterSpacing);
  const el2 = createNodeEl({ type: 'text', x: 0, y: 0, w: 200, h: 40, text: '无字距', letterSpacing: 0, opacity: 1, fontSize: 16, lineHeight: 1.4, maxLines: 0 }, { interactive: false });
  assert(el2.style.letterSpacing === 'normal', '默认应为 normal：' + el2.style.letterSpacing);
  return 'ok';
});

/* ================= 单行截断 ================= */
await check('maxLines=1：内层 span + nowrap + ellipsis', () => {
  const el = createNodeEl({
    type: 'text', x: 0, y: 0, w: 120, h: 30, text: LONG, maxLines: 1,
    opacity: 1, fontSize: 14, lineHeight: 1.4, align: 'left'
  }, { interactive: false });
  const span = el.querySelector('.text-clamp');
  assert(span, '没有 .text-clamp 内层');
  assert(span.textContent === LONG, '文字内容不对');
  assert(span.style.whiteSpace === 'nowrap', 'whiteSpace=' + span.style.whiteSpace);
  assert(span.style.textOverflow === 'ellipsis', 'textOverflow=' + span.style.textOverflow);
  assert(span.style.overflow === 'hidden', 'overflow=' + span.style.overflow);
  return 'ok';
});

await check('单行截断真的溢出被裁（真实布局）', () => {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-9999px;top:0;';
  document.body.appendChild(host);
  const el = createNodeEl({
    type: 'text', x: 0, y: 0, w: 120, h: 30, text: LONG, maxLines: 1,
    opacity: 1, fontSize: 14, lineHeight: 1.4, align: 'left'
  }, { interactive: false });
  host.appendChild(el);
  const span = el.querySelector('.text-clamp');
  const sw = span.scrollWidth;
  const cw = span.clientWidth;
  host.remove();
  assert(sw > cw, '没有真的溢出（scrollW=' + sw + ' clientW=' + cw + '）');
  return 'scrollWidth ' + sw + ' > clientWidth ' + cw;
});

/* ================= 多行截断 ================= */
await check('maxLines=3：-webkit-box + lineClamp', () => {
  const el = createNodeEl({
    type: 'text', x: 0, y: 0, w: 200, h: 90, text: LONG, maxLines: 3,
    opacity: 1, fontSize: 14, lineHeight: 1.4, align: 'left'
  }, { interactive: false });
  assert(el.style.display === '-webkit-box', 'display=' + el.style.display);
  assert(String(el.style.webkitLineClamp) === '3', 'lineClamp=' + el.style.webkitLineClamp);
  assert(el.style.overflow === 'hidden', 'overflow=' + el.style.overflow);
  assert(!el.querySelector('.text-clamp'), '多行不该有单行内层');
  assert(el.textContent === LONG, '文字内容不对');
  return 'ok';
});

await check('不设上限时保持普通换行', () => {
  const el = createNodeEl({
    type: 'text', x: 0, y: 0, w: 200, h: 120, text: LONG, maxLines: 0,
    opacity: 1, fontSize: 14, lineHeight: 1.4, align: 'left'
  }, { interactive: false });
  assert(el.style.display === 'flex', 'display=' + el.style.display);
  assert(el.style.whiteSpace === 'pre-wrap', 'whiteSpace=' + el.style.whiteSpace);
  assert(!el.querySelector('.text-clamp'), '不该有内层');
  return 'ok';
});

/* ================= 其他类型不受影响 ================= */
await check('按钮/输入框不套用文字截断逻辑', () => {
  const btn = createNodeEl({ type: 'button', x: 0, y: 0, w: 120, h: 44, text: '确定', maxLines: 1, opacity: 1, fontSize: 16, lineHeight: 1.4 }, { interactive: false });
  assert(!btn.querySelector('.text-clamp'), '按钮不该有截断内层');
  assert(btn.textContent === '确定', '按钮文字不对');
  return 'ok';
});

await check('对齐方式在截断模式下仍然生效', () => {
  const el = createNodeEl({
    type: 'text', x: 0, y: 0, w: 200, h: 30, text: '居中', maxLines: 1,
    opacity: 1, fontSize: 14, lineHeight: 1.4, align: 'center'
  }, { interactive: false });
  assert(el.style.justifyContent === 'center', 'justify=' + el.style.justifyContent);
  return 'ok';
});

const out = document.getElementById('out');
const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
