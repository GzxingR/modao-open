/**
 * AI 链路自测：请求本地 mock（OpenAI 兼容）→ 解析代码围栏 → 生成节点。
 * 不需要真实 API Key。
 */

import { generatePage } from '../src/ai.js';
import { getDevice } from '../src/model.js';

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

const device = getDevice('iphone17');
const settings = {
  baseURL: 'http://127.0.0.1:8099/v1',
  apiKey: 'test-key-not-real',
  model: 'mock-model',
  temperature: 0.6
};

async function main() {
  let generated = null;

  await check('调通 mock 接口并解析出节点', async () => {
    generated = await generatePage('做一个登录页', settings, device);
    assert(generated, '没有返回');
    assert(Array.isArray(generated.nodes), 'nodes 不是数组');
    assert(generated.nodes.length === 5, '节点数=' + generated.nodes.length);
    return generated.nodes.length + ' 个组件';
  });

  await check('节点类型与坐标被正确归一化', async () => {
    assert(generated, '上一步失败');
    const types = generated.nodes.map((n) => n.type);
    assert(types.indexOf('button') >= 0, '没有按钮：' + types.join(','));
    assert(types.indexOf('input') >= 0, '没有输入框');
    const btn = generated.nodes.find((n) => n.type === 'button');
    assert(btn.bg === '#1677ff', '按钮色=' + btn.bg);
    assert(btn.w === 320 && btn.h === 44, '按钮尺寸=' + btn.w + 'x' + btn.h);
    assert(btn.radius === 8, '圆角=' + btn.radius);
    for (const n of generated.nodes) {
      assert(n.x >= -40 && n.x <= device.w, n.type + ' x 越界：' + n.x);
      assert(n.y >= -40 && n.y <= device.h, n.type + ' y 越界：' + n.y);
      assert(n.id, n.type + ' 没有 id');
    }
    return 'types=' + types.join('/');
  });

  await check('页面名被带上', async () => {
    assert(generated.name === '登录页', 'name=' + generated.name);
    return generated.name;
  });

  await check('401 时抛出可读错误', async () => {
    let err = null;
    try {
      await generatePage('x', Object.assign({}, settings, { baseURL: 'http://127.0.0.1:8099/bad' }), device);
    } catch (e) { err = e; }
    assert(err, '没有抛错');
    assert(String(err.message).indexOf('401') >= 0, '错误信息没带状态码：' + err.message);
    return err.message.slice(0, 60);
  });

  await check('缺 Key 时本地就拦住', async () => {
    let err = null;
    try {
      await generatePage('x', Object.assign({}, settings, { apiKey: '' }), device);
    } catch (e) { err = e; }
    assert(err && err.message.indexOf('API Key') >= 0, '没有本地校验：' + (err && err.message));
    return err.message;
  });

  const out = document.getElementById('out');
  const pass = results.filter((r) => r.indexOf('PASS') === 0).length;
  out.textContent = 'RESULT ' + pass + '/' + results.length + '\n' + results.join('\n');
}

main().catch((e) => {
  document.getElementById('out').textContent = 'FATAL ' + (e && e.message);
});
