/**
 * 内置帮助：快捷键速查 + 功能地图。按 ? 或点顶栏问号打开。
 */

export const HELP_SECTIONS = [
  {
    title: '画布操作',
    items: [
      ['空格 + 拖拽', '平移画布'],
      ['Ctrl + 滚轮', '以鼠标位置缩放'],
      ['滚轮', '滚动页面（不缩放）'],
      ['点空白拖拽', '框选多个元素'],
      ['Shift + 点元素', '加选 / 取消选中'],
      ['方向键 / Shift+方向键', '微调 1px / 10px'],
      ['右键', '元素或画布菜单']
    ]
  },
  {
    title: '编辑',
    items: [
      ['Ctrl + Z / Ctrl + Shift + Z', '撤销 / 重做'],
      ['Ctrl + C / Ctrl + V', '复制 / 粘贴'],
      ['Ctrl + D', '复制一份'],
      ['Ctrl + A', '全选本页元素'],
      ['Ctrl + G / Ctrl + Shift + G', '组合 / 解散'],
      ['Delete / Backspace', '删除选中'],
      ['拖动选中框的 8 个手柄', '改尺寸']
    ]
  },
  {
    title: '交互与预览',
    items: [
      ['选中元素 → 右侧「交互」', '设置触发方式 + 行为 + 条件'],
      ['拖动元素右上角闪电形状的连线点', '（本版用面板配置，无需拖线）'],
      ['顶栏「预览」', '按真实设备尺寸演示，交互可点'],
      ['顶栏「标注」', '点元素看规格、导切图'],
      ['?', '打开这个帮助']
    ]
  },
  {
    title: '导出',
    items: [
      ['导出 → 当前页 PNG', '2 倍图，贴作业'],
      ['导出 → 全部页面 PNG', '逐页下载'],
      ['导出 → 离线演示 HTML', '单文件，双击即演示，可发人'],
      ['导出 → 全部页面 PDF', '每页一张'],
      ['导出 → 项目 JSON', '源文件，可再导入'],
      ['规格', '生成文字规格清单，可直接贴答案']
    ]
  },
  {
    title: '变量与条件',
    items: [
      ['右侧「变量（项目级）」', '添加变量并设初始值'],
      ['行为 = 设置变量值', '触发时给变量赋值'],
      ['交互的「条件」', '等于 / 不等于 / 为真 / 为假，不满足就不执行'],
      ['触发 = 监听变量变化', '变量一变就按条件执行']
    ]
  },
  {
    title: '浮层与动态组件',
    items: [
      ['分组 → 右侧「浮层」', '设为浮层，可带遮罩、默认打开'],
      ['行为 = 打开 / 关闭浮层', '控制浮层显隐'],
      ['分组 → 「组件状态」', '每个状态一整套子元素，可做登录/未登录切换'],
      ['普通组件 → 「组件状态」', '多套外观（常态/按下/选中）']
    ]
  }
];

export const HELP_TIPS = [
  '所有改动自动存在浏览器里，刷新不丢；换电脑请用「导出 → 项目 JSON」带走。',
  'AI 生成用的是你自己的 API Key，只存在本机 localStorage。',
  '单文件版双击即用；通过本地服务打开时 AI 才能用（file:// 下会被 CORS 拦）。'
];

/** 渲染帮助内容（返回 DOM 片段） */
export function renderHelpContent(version) {
  const wrap = document.createElement('div');
  wrap.className = 'help-wrap';

  const lead = document.createElement('div');
  lead.className = 'hint';
  lead.textContent = '这是一个本地优先的开源原型工作台，没有账号、不上传稿件。下面是常用操作。';
  wrap.appendChild(lead);

  for (const sec of HELP_SECTIONS) {
    const h = document.createElement('div');
    h.className = 'help-section-title';
    h.textContent = sec.title;
    wrap.appendChild(h);

    const table = document.createElement('div');
    table.className = 'help-table';
    for (const [key, desc] of sec.items) {
      const row = document.createElement('div');
      row.className = 'help-row';
      const k = document.createElement('div');
      k.className = 'help-key';
      k.textContent = key;
      const d = document.createElement('div');
      d.className = 'help-desc';
      d.textContent = desc;
      row.appendChild(k);
      row.appendChild(d);
      table.appendChild(row);
    }
    wrap.appendChild(table);
  }

  const tipTitle = document.createElement('div');
  tipTitle.className = 'help-section-title';
  tipTitle.textContent = '几个提醒';
  wrap.appendChild(tipTitle);

  const ul = document.createElement('ul');
  ul.className = 'help-tips';
  for (const t of HELP_TIPS) {
    const li = document.createElement('li');
    li.textContent = t;
    ul.appendChild(li);
  }
  wrap.appendChild(ul);

  const foot = document.createElement('div');
  foot.className = 'help-foot';
  foot.textContent = 'modao-open ' + (version || '') + ' · MIT · github.com/GzxingR/modao-open';
  wrap.appendChild(foot);

  return wrap;
}
