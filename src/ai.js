/**
 * AI 生成（BYO API Key）：OpenAI 兼容 /chat/completions
 * Key 只存本机 localStorage，直接发给你配置的接口，不经过任何第三方。
 */

import { createNode, getComponent, getDevice } from './model.js';

const SETTINGS_KEY = 'modao-open:ai-settings:v1';

const DEFAULT_SETTINGS = {
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.6
};

export function loadAISettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return Object.assign({}, DEFAULT_SETTINGS);
    return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
  } catch (e) {
    return Object.assign({}, DEFAULT_SETTINGS);
  }
}

export function saveAISettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function extractJSON(text) {
  if (!text) throw new Error('模型没有返回内容');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('返回内容里找不到 JSON');
  return JSON.parse(body.slice(start, end + 1));
}

function systemPrompt(device) {
  return [
    '你是一个移动端原型设计助手。你只输出 JSON，不要解释。',
    '输出格式：{"name":"页面名","nodes":[{"type":"text|rect|circle|line|image|button|input|textarea|checkbox|switch|icon|badge|card|listitem|navbar|tabbar","text":"文案","x":0,"y":0,"w":320,"h":44,"fontSize":16,"fontWeight":400,"color":"#222222","bg":"#1677ff","radius":8,"align":"center"}]}',
    '画布是 ' + device.w + '×' + device.h + ' 逻辑像素。x/y 是元素左上角坐标，别超出画布。',
    '规则：相邻元素留 8~24px 间距；标题 18~28 号加粗；正文 14~16 号；按钮高 44，圆角 8，主色 #1677ff，文字白色；占位文字颜色 #bbbbbb；分割线用 line 且 h=1。',
    '只输出 JSON。'
  ].join('\n');
}

export async function generatePage(prompt, settings, device, signal) {
  if (!settings.apiKey) throw new Error('还没有填 API Key');
  if (!settings.baseURL) throw new Error('还没有填接口地址');

  const url = settings.baseURL.replace(/\/+$/, '') + '/chat/completions';
  const body = {
    model: settings.model,
    temperature: settings.temperature == null ? 0.6 : settings.temperature,
    messages: [
      { role: 'system', content: systemPrompt(device) },
      { role: 'user', content: prompt }
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + settings.apiKey
    },
    body: JSON.stringify(body),
    signal
  });

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 300); } catch (e) { detail = ''; }
    throw new Error('接口返回 ' + res.status + '：' + detail);
  }

  const data = await res.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : (data && data.content) || '';
  const parsed = extractJSON(content);
  return normalizeGenerated(parsed, device);
}

function normalizeGenerated(parsed, device) {
  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const out = [];
  for (const raw of nodes) {
    const type = getComponent(raw.type).type;
    const patch = {};
    const allowed = ['x', 'y', 'w', 'h', 'text', 'fontSize', 'fontWeight', 'color', 'bg', 'radius',
      'align', 'lineHeight', 'paddingX', 'borderWidth', 'borderColor', 'shadow', 'verticalAlign',
      'icon', 'tabs', 'activeIndex', 'checked', 'on', 'divider'];
    for (const k of allowed) if (raw[k] !== undefined) patch[k] = raw[k];
    if (patch.x === undefined) patch.x = 16;
    if (patch.y === undefined) patch.y = 80;
    patch.x = clamp(Number(patch.x) || 0, -40, device.w);
    patch.y = clamp(Number(patch.y) || 0, -40, device.h);
    if (patch.w !== undefined) patch.w = Math.max(4, Number(patch.w) || 100);
    if (patch.h !== undefined) patch.h = Math.max(1, Number(patch.h) || 40);
    out.push(createNode(type, device, patch));
  }
  return { name: parsed.name || 'AI 页面', nodes: out };
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/** AI 面板 UI（在 modal 里渲染） */
export function renderAIPanel(container, ctx) {
  const settings = loadAISettings();
  container.textContent = '';

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.innerHTML = '用你自己的 API Key 调 OpenAI 兼容接口（DeepSeek / OpenAI / OpenRouter / 本地 Ollama 都行）。' +
    'Key 只存在这台电脑的浏览器里，请求直接发给你填的地址。<br>返回的组件会加进当前页面。';
  container.appendChild(hint);

  function labeled(text, input) {
    const l = document.createElement('label');
    l.textContent = text;
    container.appendChild(l);
    container.appendChild(input);
    return input;
  }

  const baseURL = labeled('接口地址（到 /v1 为止）', document.createElement('input'));
  baseURL.value = settings.baseURL;
  baseURL.placeholder = 'https://api.deepseek.com/v1';

  const model = labeled('模型名', document.createElement('input'));
  model.value = settings.model;
  model.placeholder = 'deepseek-chat / gpt-4o-mini / qwen2.5:7b';

  const apiKey = labeled('API Key（只存本机）', document.createElement('input'));
  apiKey.type = 'password';
  apiKey.value = settings.apiKey;
  apiKey.placeholder = 'sk-...';

  const promptLabel = document.createElement('label');
  promptLabel.textContent = '要生成什么页面';
  container.appendChild(promptLabel);

  const prompt = document.createElement('textarea');
  prompt.value = '做一个电商商品详情页：顶部商品大图占位，下面是名称、价格、优惠标签，底部固定操作栏有收藏和立即购买按钮。';
  container.appendChild(prompt);

  const status = document.createElement('div');
  status.className = 'hint';
  status.style.marginTop = '8px';
  container.appendChild(status);

  return {
    getPrompt() { return prompt.value; },
    getSettings() {
      const s = {
        baseURL: baseURL.value.trim(),
        model: model.value.trim(),
        apiKey: apiKey.value.trim(),
        temperature: 0.6
      };
      saveAISettings(s);
      return s;
    },
    setStatus(text, isError) {
      status.textContent = text;
      status.style.color = isError ? '#ff9b9d' : 'var(--text-dim)';
    }
  };
}

export { getDevice };
