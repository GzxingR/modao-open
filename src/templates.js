/**
 * 页面模板库：选一个常见页面，一键新建该页面并铺好元素。
 * 坐标全部按设备宽高算，换设备也不会错位。
 */

import { createNode } from './model.js';

function px(v) {
  return Math.round(v);
}

/* ---------------- 登录页 ---------------- */
function login(dev) {
  const W = dev.w;
  const cx = px(W * 0.1);
  const w = px(W * 0.8);
  return [
    createNode('text', dev, { x: cx, y: 120, w, h: 40, text: '校园助手', fontSize: 28, fontWeight: 700, align: 'center' }),
    createNode('text', dev, { x: cx, y: 166, w, h: 22, text: '欢迎回来，请登录', fontSize: 14, color: '#8a8f99', align: 'center' }),
    createNode('input', dev, { x: cx, y: 260, w, h: 48, text: '请输入手机号' }),
    createNode('input', dev, { x: cx, y: 324, w, h: 48, text: '请输入密码' }),
    createNode('button', dev, { x: cx, y: 408, w, h: 48, text: '登 录', bg: '#1677ff', radius: 8, fontSize: 16 }),
    createNode('text', dev, { x: cx, y: 476, w, h: 20, text: '忘记密码？', fontSize: 13, color: '#1677ff', align: 'center' }),
    createNode('text', dev, { x: cx, y: dev.h - 60, w, h: 20, text: '登录即表示同意《用户协议》', fontSize: 11, color: '#b0b4bb', align: 'center' })
  ];
}

/* ---------------- 列表页 ---------------- */
function listPage(dev) {
  const W = dev.w;
  const nodes = [
    createNode('navbar', dev, { x: 0, y: 0, w: W, h: 88, text: '待办列表', fontSize: 18, fontWeight: 700 })
  ];
  for (let i = 0; i < 6; i += 1) {
    nodes.push(createNode('listitem', dev, {
      x: 0, y: 88 + i * 72, w: W, h: 72, text: '待办事项 ' + (i + 1), fontSize: 15
    }));
  }
  nodes.push(createNode('tabbar', dev, { x: 0, y: dev.h - 56, w: W, h: 56 }));
  return nodes;
}

/* ---------------- 详情页 ---------------- */
function detail(dev) {
  const W = dev.w;
  const cx = px(W * 0.05);
  const w = px(W * 0.9);
  return [
    createNode('navbar', dev, { x: 0, y: 0, w: W, h: 88, text: '商品详情', fontSize: 18, fontWeight: 700 }),
    createNode('image', dev, { x: 0, y: 88, w: W, h: px(W * 0.75), text: '主图' }),
    createNode('text', dev, { x: cx, y: px(W * 0.75) + 108, w, h: 28, text: '2024 新款简约双肩包', fontSize: 19, fontWeight: 700 }),
    createNode('text', dev, { x: cx, y: px(W * 0.75) + 146, w: 160, h: 32, text: '¥ 99', fontSize: 24, fontWeight: 700, color: '#ff4d4f' }),
    createNode('text', dev, { x: cx, y: px(W * 0.75) + 186, w, h: 60, text: '商品描述：轻量耐磨，通勤日常都能用。', fontSize: 13, color: '#6b7280' }),
    createNode('button', dev, { x: 0, y: dev.h - 60, w: W, h: 60, text: '立即购买', bg: '#ff7d00', radius: 0, fontSize: 16 })
  ];
}

/* ---------------- 设置页 ---------------- */
function settings(dev) {
  const W = dev.w;
  const nodes = [
    createNode('navbar', dev, { x: 0, y: 0, w: W, h: 88, text: '设置', fontSize: 18, fontWeight: 700 })
  ];
  const items = ['账号与安全', '消息通知', '隐私', '通用', '关于'];
  items.forEach((t, i) => {
    nodes.push(createNode('listitem', dev, {
      x: 0, y: 88 + i * 64, w: W, h: 64, text: t, fontSize: 15
    }));
    nodes.push(createNode('icon', dev, {
      x: W - 32, y: 88 + i * 64 + 24, w: 16, h: 16, icon: 'chevronRight', color: '#c0c4cc', strokeWidth: 1.6
    }));
  });
  nodes.push(createNode('switch', dev, { x: W - 60, y: 88 + 3 * 64 + 18, w: 44, h: 26, on: true }));
  nodes.push(createNode('button', dev, {
    x: px(W * 0.1), y: 88 + items.length * 64 + 40, w: px(W * 0.8), h: 48,
    text: '退出登录', bg: '#fff1f0', color: '#ff4d4f', radius: 8, fontSize: 16
  }));
  return nodes;
}

/* ---------------- 消息页 ---------------- */
function messages(dev) {
  const W = dev.w;
  const nodes = [
    createNode('navbar', dev, { x: 0, y: 0, w: W, h: 88, text: '消息', fontSize: 18, fontWeight: 700 })
  ];
  const people = ['辅导员', '课程助教', '室友群', '校园通知', '系统消息'];
  people.forEach((t, i) => {
    const y = 88 + i * 76;
    nodes.push(createNode('circle', dev, { x: 16, y: y + 16, w: 44, h: 44, bg: '#e8f0fe' }));
    nodes.push(createNode('text', dev, {
      x: 16, y: y + 26, w: 44, h: 24, text: t.slice(0, 1), fontSize: 16, color: '#1677ff', align: 'center', fontWeight: 700
    }));
    nodes.push(createNode('text', dev, { x: 72, y: y + 18, w: W - 140, h: 22, text: t, fontSize: 15, fontWeight: 700 }));
    nodes.push(createNode('text', dev, { x: 72, y: y + 42, w: W - 140, h: 20, text: '最后一条消息内容…', fontSize: 12, color: '#8a8f99' }));
    nodes.push(createNode('line', dev, { x: 72, y: y + 75, w: W - 72, h: 1 }));
  });
  nodes.push(createNode('tabbar', dev, { x: 0, y: dev.h - 56, w: W, h: 56 }));
  return nodes;
}

/* ---------------- 个人中心 ---------------- */
function profile(dev) {
  const W = dev.w;
  const nodes = [
    createNode('rect', dev, { x: 0, y: 0, w: W, h: 200, bg: '#1677ff', radius: 0 }),
    createNode('circle', dev, { x: px(W / 2 - 40), y: 76, w: 80, h: 80, bg: '#ffffff' }),
    createNode('icon', dev, { x: px(W / 2 - 20), y: 96, w: 40, h: 40, icon: 'user', color: '#1677ff', strokeWidth: 1.8 }),
    createNode('text', dev, { x: 0, y: 166, w: W, h: 24, text: 'YG', fontSize: 17, fontWeight: 700, color: '#ffffff', align: 'center' })
  ];

  const stats = [['12', '收藏'], ['8', '订单'], ['3', '优惠券']];
  stats.forEach((s, i) => {
    const x = px(W / 3 * i);
    nodes.push(createNode('text', dev, { x, y: 232, w: px(W / 3), h: 24, text: s[0], fontSize: 18, fontWeight: 700, align: 'center' }));
    nodes.push(createNode('text', dev, { x, y: 256, w: px(W / 3), h: 18, text: s[1], fontSize: 12, color: '#8a8f99', align: 'center' }));
  });

  const menu = ['我的订单', '收货地址', '账号设置', '帮助与反馈'];
  menu.forEach((t, i) => {
    const y = 300 + i * 60;
    nodes.push(createNode('listitem', dev, { x: 0, y, w: W, h: 60, text: t, fontSize: 15 }));
    nodes.push(createNode('icon', dev, { x: W - 32, y: y + 22, w: 16, h: 16, icon: 'chevronRight', color: '#c0c4cc', strokeWidth: 1.6 }));
  });
  return nodes;
}

/* ---------------- 空状态页 ---------------- */
function emptyState(dev) {
  const W = dev.w;
  return [
    createNode('navbar', dev, { x: 0, y: 0, w: W, h: 88, text: '我的收藏', fontSize: 18, fontWeight: 700 }),
    createNode('icon', dev, { x: px(W / 2 - 36), y: 300, w: 72, h: 72, icon: 'folder', color: '#d0d4dc', strokeWidth: 1.4 }),
    createNode('text', dev, { x: 0, y: 396, w: W, h: 24, text: '还没有收藏内容', fontSize: 16, color: '#6b7280', align: 'center' }),
    createNode('text', dev, { x: 0, y: 424, w: W, h: 20, text: '去逛逛，看到喜欢的点个心', fontSize: 12, color: '#a0a4ac', align: 'center' }),
    createNode('button', dev, {
      x: px(W / 2 - 70), y: 476, w: 140, h: 44, text: '去首页', bg: '#1677ff', radius: 22, fontSize: 15
    })
  ];
}

/* ---------------- 表单页 ---------------- */
function formPage(dev) {
  const W = dev.w;
  const cx = px(W * 0.05);
  const w = px(W * 0.9);
  const nodes = [
    createNode('navbar', dev, { x: 0, y: 0, w: W, h: 88, text: '新建记录', fontSize: 18, fontWeight: 700 })
  ];
  const fields = ['记录标题', '发生时间', '相关地点'];
  fields.forEach((t, i) => {
    nodes.push(createNode('text', dev, { x: cx, y: 110 + i * 80, w, h: 20, text: t, fontSize: 13, color: '#6b7280' }));
    nodes.push(createNode('input', dev, { x: cx, y: 134 + i * 80, w, h: 46, text: '请输入' + t }));
  });
  nodes.push(createNode('text', dev, { x: cx, y: 110 + 3 * 80, w, h: 20, text: '备注', fontSize: 13, color: '#6b7280' }));
  nodes.push(createNode('textarea', dev, { x: cx, y: 134 + 3 * 80, w, h: 100, text: '补充说明…' }));
  nodes.push(createNode('text', dev, { x: cx, y: 134 + 3 * 80 + 116, w: 160, h: 24, text: '设为重要', fontSize: 14 }));
  nodes.push(createNode('switch', dev, { x: cx + w - 46, y: 134 + 3 * 80 + 116, w: 46, h: 26, on: false }));
  nodes.push(createNode('button', dev, {
    x: cx, y: dev.h - 80, w, h: 48, text: '保 存', bg: '#1677ff', radius: 8, fontSize: 16
  }));
  return nodes;
}

export const TEMPLATES = [
  { id: 'login', name: '登录页', desc: '标题 + 手机号/密码 + 登录按钮 + 忘记密码', build: login },
  { id: 'list', name: '列表页', desc: '顶部导航 + 6 条列表 + 底部标签栏', build: listPage },
  { id: 'detail', name: '详情页', desc: '导航 + 大图 + 标题价格 + 底部购买按钮', build: detail },
  { id: 'settings', name: '设置页', desc: '5 个设置项 + 开关 + 退出登录', build: settings },
  { id: 'messages', name: '消息页', desc: '会话列表（头像 + 标题 + 摘要 + 分割线）', build: messages },
  { id: 'profile', name: '个人中心', desc: '头图 + 头像昵称 + 三栏统计 + 功能列表', build: profile },
  { id: 'empty', name: '空状态页', desc: '图标 + 提示文案 + 一个行动按钮', build: emptyState },
  { id: 'form', name: '表单页', desc: '3 个输入 + 多行备注 + 开关 + 保存', build: formPage }
];

export function buildTemplate(id, dev) {
  const tpl = TEMPLATES.find((t) => t.id === id);
  if (!tpl) return [];
  return tpl.build(dev);
}
