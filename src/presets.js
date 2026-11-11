/**
 * 预设项目：把课程作业里那几个页面按规格内置进来，一键载入对照。
 */

import { createNode, createPage, uid } from './model.js';

function page(name, deviceId, builder) {
  const p = createPage(name, deviceId);
  p.id = uid('p');
  builder(p);
  return p;
}

/** 登录页（iPhone 17） */
function loginPage(p) {
  const dev = { w: 402, h: 874 };
  p.nodes.push(createNode('text', dev, {
    x: 0, y: 96, w: 402, h: 40, text: '校园助手', fontSize: 28, fontWeight: 700,
    color: '#222222', align: 'center'
  }));
  p.nodes.push(createNode('input', dev, {
    x: 41, y: 300, w: 320, h: 48, text: '请输入手机号', radius: 8
  }));
  p.nodes.push(createNode('input', dev, {
    x: 41, y: 364, w: 320, h: 48, text: '请输入密码', radius: 8
  }));
  p.nodes.push(createNode('button', dev, {
    x: 41, y: 436, w: 320, h: 44, text: '登录', bg: '#1677ff', radius: 8,
    states: [
      { id: 'st-normal', name: '常态', style: { bg: '#1677ff', text: '登录', color: '#ffffff' } },
      { id: 'st-pressed', name: '按下态', style: { bg: '#0b5cd5', text: '登录中…', color: '#ffffff' } }
    ],
    activeStateId: 'st-normal',
    link: { action: 'state', targetNodeId: null, targetStateId: 'st-pressed' }
  }));
  p.nodes.push(createNode('text', dev, {
    x: 41, y: 496, w: 320, h: 20, text: '忘记密码', fontSize: 14, color: '#1677ff', align: 'right'
  }));
}

/** 待办列表页（iPhone 17） */
function todoPage(p) {
  const dev = { w: 402, h: 874 };
  p.nodes.push(createNode('navbar', dev, {
    x: 0, y: 0, w: 402, h: 88, text: '我的待办', fontSize: 20, fontWeight: 700, showAction: true, actionIcon: 'plus'
  }));
  const items = ['完成软件设计作业', '取快递', '参加社团例会'];
  items.forEach((text, i) => {
    const top = 88 + i * 60;
    p.nodes.push(createNode('checkbox', dev, { x: 16, y: top + 18, w: 24, h: 24 }));
    p.nodes.push(createNode('text', dev, {
      x: 52, y: top + 18, w: 320, h: 24, text: text, fontSize: 16, color: '#333333'
    }));
    p.nodes.push(createNode('line', dev, { x: 0, y: top + 59, w: 402, h: 1 }));
  });
  p.nodes.push(createNode('tabbar', dev, {
    x: 0, y: 824, w: 402, h: 50, tabs: ['待办', '已完成', '我的'], activeIndex: 0
  }));
}

/** 退出确认弹窗（iPhone 14） */
function dialogPage(p) {
  const dev = { w: 390, h: 844 };
  p.nodes.push(createNode('circle', dev, { x: 0, y: 0, w: 390, h: 844, bg: 'rgba(0,0,0,0.5)', radius: 0 }));
  p.nodes.push(createNode('rect', dev, {
    x: 45, y: 332, w: 300, h: 180, bg: '#ffffff', radius: 12
  }));
  p.nodes.push(createNode('text', dev, {
    x: 45, y: 356, w: 300, h: 24, text: '提示', fontSize: 18, fontWeight: 700, align: 'center'
  }));
  p.nodes.push(createNode('text', dev, {
    x: 45, y: 412, w: 300, h: 22, text: '确定要退出登录吗？', fontSize: 16, color: '#333333', align: 'center'
  }));
  p.nodes.push(createNode('line', dev, { x: 45, y: 462, w: 300, h: 1 }));
  p.nodes.push(createNode('line', dev, { x: 195, y: 462, w: 1, h: 50 }));
  p.nodes.push(createNode('text', dev, {
    x: 45, y: 475, w: 150, h: 24, text: '取消', fontSize: 16, color: '#666666', align: 'center'
  }));
  p.nodes.push(createNode('text', dev, {
    x: 195, y: 475, w: 150, h: 24, text: '确定', fontSize: 16, color: '#ff4d4f', align: 'center'
  }));
}

/** 商品详情页（iPhone 14） */
function goodsPage(p) {
  const dev = { w: 390, h: 844 };
  p.nodes.push(createNode('image', dev, {
    x: 0, y: 0, w: 390, h: 300, text: '商品主图', fontSize: 16, color: '#999999'
  }));
  p.nodes.push(createNode('text', dev, {
    x: 16, y: 316, w: 358, h: 26, text: '2024新款简约双肩包', fontSize: 18, fontWeight: 700
  }));
  p.nodes.push(createNode('text', dev, {
    x: 16, y: 350, w: 200, h: 32, text: '¥99', fontSize: 24, fontWeight: 700, color: '#ff4d4f'
  }));
  p.nodes.push(createNode('line', dev, { x: 0, y: 793, w: 390, h: 1 }));
  p.nodes.push(createNode('rect', dev, { x: 0, y: 794, w: 60, h: 50, bg: '#ffffff', radius: 0 }));
  p.nodes.push(createNode('icon', dev, {
    x: 18, y: 810, w: 24, h: 22, icon: 'heart', color: '#333333', strokeWidth: 1.6
  }));
  p.nodes.push(createNode('button', dev, {
    x: 60, y: 794, w: 330, h: 50, text: '立即购买', bg: '#ff7d00', radius: 0, fontSize: 16
  }));
}

export function buildAssignmentProject() {
  const pages = [
    page('登录页', 'iphone17', loginPage),
    page('待办列表页', 'iphone17', todoPage),
    page('退出确认弹窗', 'iphone14', dialogPage),
    page('商品详情页', 'iphone14', goodsPage)
  ];
  // 演示两类交互：按钮切自己的组件状态，文字跳页
  const login = pages[0];
  const btn = login.nodes.find((n) => n.type === 'button');
  if (btn) {
    btn.link = { action: 'state', targetNodeId: btn.id, targetStateId: 'st-pressed' };
  }
  const forget = login.nodes.find((n) => n.type === 'text' && n.text === '忘记密码');
  if (forget) {
    forget.link = { action: 'navigate', targetPageId: pages[1].id };
  }

  return {
    version: 1,
    name: '课程作业 · 原型四页',
    pages,
    activePageId: pages[0].id,
    createdAt: new Date().toISOString()
  };
}
