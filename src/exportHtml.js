/**
 * 导出离线演示 HTML：单文件、含全部页面与交互，双击就能演示，也可以发给别人。
 * 做法：每页用真实渲染器生成静态 DOM（样式已内联），再把跳转/显隐/状态切换的元数据
 * 写进 data-* 属性，附一段极小运行时。
 */

import { createNodeEl } from './nodes.js';
import { getDevice } from './model.js';

function escapeAttr(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function nodeHtml(node, overrideStateId) {
  const view = overrideStateId ? Object.assign({}, node, { activeStateId: overrideStateId }) : node;
  const el = createNodeEl(view, { interactive: true });
  el.dataset.id = node.id;
  const link = node.link;
  if (link && link.action && link.action !== 'none') {
    el.dataset.la = link.action;
    if (link.targetPageId) el.dataset.lp = link.targetPageId;
    if (link.targetNodeId) el.dataset.ln = link.targetNodeId;
    if (link.targetStateId) el.dataset.ls = link.targetStateId;
    el.style.cursor = 'pointer';
  }
  return el.outerHTML;
}

function pagePayload(page) {
  const device = getDevice(page.deviceId);
  const nodes = [];
  for (const node of page.nodes) {
    if (node.hidden) continue;
    const item = { id: node.id, html: nodeHtml(node) };
    if (node.states && node.states.length) {
      item.states = {};
      for (const st of node.states) item.states[st.id] = nodeHtml(node, st.id);
      item.active = node.activeStateId || node.states[0].id;
    }
    nodes.push(item);
  }
  return {
    id: page.id,
    name: page.name,
    w: device.w,
    h: device.h,
    bg: page.bg || '#ffffff',
    nodes
  };
}

const RUNTIME = `
(function () {
  var D = window.__PROTO__;
  var stage = document.getElementById('stage');
  var cur = D.startPageId;
  var pages = {};
  D.pages.forEach(function (p) {
    var box = document.createElement('div');
    box.className = 'pg';
    box.dataset.pg = p.id;
    box.style.width = p.w + 'px';
    box.style.height = p.h + 'px';
    box.style.background = p.bg;
    box.style.position = 'relative';
    box.style.overflow = 'hidden';
    pages[p.id] = p;
    p.nodes.forEach(function (n) {
      var holder = document.createElement('div');
      holder.innerHTML = n.html;
      var el = holder.firstElementChild;
      if (el) box.appendChild(el);
    });
    stage.appendChild(box);
  });

  function show(id) {
    cur = id;
    Array.prototype.forEach.call(stage.children, function (box) {
      box.style.display = box.dataset.pg === id ? 'block' : 'none';
    });
    fit();
  }

  function fit() {
    var p = pages[cur];
    if (!p) return;
    var pad = 48;
    var s = Math.min(1, (window.innerWidth - pad) / p.w, (window.innerHeight - pad) / p.h);
    stage.style.transform = 'scale(' + s + ')';
  }

  window.addEventListener('resize', fit);

  stage.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el !== stage && !(el.dataset && el.dataset.la)) el = el.parentElement;
    if (!el || !el.dataset || !el.dataset.la) return;
    var act = el.dataset.la;
    if (act === 'navigate' && el.dataset.lp) { show(el.dataset.lp); return; }
    var lp = el.closest ? el.closest('.pg') : null;
    if (!lp) return;
    if (act === 'state') {
      var nodeId = el.dataset.ln;
      var target = lp.querySelector('[data-id="' + nodeId + '"]');
      if (!target) return;
      var p = pages[lp.dataset.pg];
      var nd = null;
      for (var i = 0; i < p.nodes.length; i++) if (p.nodes[i].id === nodeId) nd = p.nodes[i];
      if (!nd || !nd.states) return;
      var nextId = el.dataset.ls;
      if (!nextId) {
        var curId = target.dataset.state || nd.active;
        var ids = Object.keys(nd.states);
        var idx = ids.indexOf(curId);
        nextId = ids[(idx + 1) % ids.length];
      }
      var holder = document.createElement('div');
      holder.innerHTML = nd.states[nextId];
      var fresh = holder.firstElementChild;
      if (!fresh) return;
      fresh.dataset.state = nextId;
      target.replaceWith(fresh);
      return;
    }
    var nodeId2 = el.dataset.ln;
    var t2 = lp.querySelector('[data-id="' + nodeId2 + '"]');
    if (!t2) return;
    if (act === 'show') t2.style.display = '';
    else if (act === 'hide') t2.style.display = 'none';
    else if (act === 'toggle') t2.style.display = (t2.style.display === 'none' ? '' : 'none');
  });

  show(D.startPageId);
})();
`;

export function buildStandaloneHtml(project) {
  const pages = project.pages.map(pagePayload);
  const data = {
    name: project.name || '原型',
    startPageId: project.activePageId || (pages[0] && pages[0].id),
    pages
  };

  const first = pages[0] || { w: 402, h: 874 };
  const title = project.name || '原型演示';

  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>' + escapeAttr(title) + ' · 原型演示</title>',
    '<style>',
    'html,body{margin:0;height:100%;background:#0d1014;overflow:hidden;}',
    'body{display:flex;align-items:center;justify-content:center;font-family:"Microsoft YaHei","PingFang SC",sans-serif;}',
    '#stage{transform-origin:center center;box-shadow:0 12px 48px rgba(0,0,0,.6);background:#fff;}',
    '.pg{position:relative;}',
    '.node{cursor:default;}',
    '.node[data-la]{cursor:pointer;}',
    '#hint{position:fixed;left:0;right:0;bottom:10px;text-align:center;color:#6b7280;font-size:12px;}',
    '</style>',
    '</head>',
    '<body>',
    '<div id="stage"></div>',
    '<div id="hint">' + escapeAttr(title) + ' · 共 ' + pages.length + ' 页 · 点击可交互元素继续</div>',
    '<script>window.__PROTO__ = ' + JSON.stringify(data) + ';<\/script>',
    '<script>' + RUNTIME + '<\/script>',
    '</body>',
    '</html>'
  ].join('\n');
}

export function downloadStandaloneHtml(project) {
  const html = buildStandaloneHtml(project);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = String(project.name || 'prototype').replace(/[\\/:*?"<>|]+/g, '_') + '-demo.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return html.length;
}
