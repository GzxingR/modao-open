/**
 * 导出离线演示 HTML：单文件、含全部页面与交互，双击就能演示，也可以发给别人。
 * 做法：每页用真实渲染器生成静态 DOM（样式已内联），再把触发方式/行为的元数据
 * 写进 data-* 属性，附一段极小运行时。
 */

import { createNodeEl } from './nodes.js';
import { resolveDevice } from './model.js';

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
    el.dataset.t = link.trigger || 'click';
    if (link.targetPageId) el.dataset.lp = link.targetPageId;
    if (link.targetNodeId) el.dataset.ln = link.targetNodeId;
    if (link.targetStateId) el.dataset.ls = link.targetStateId;
    if (link.url) el.dataset.lu = link.url;
    el.style.cursor = 'pointer';
  }
  if (node.type === 'group' && node.overlay) {
    el.dataset.ov = '1';
    if (node.overlayMask) el.dataset.ovm = '1';
    if (node.defaultOpen) el.dataset.ovd = '1';
    el.style.zIndex = '901';
  }
  if (link && link.condition && link.condition.varName) {
    el.dataset.cv = link.condition.varName;
    el.dataset.co = link.condition.op || 'truthy';
    if (link.condition.value != null) el.dataset.cval = String(link.condition.value);
  }
  if (link && link.keyName) el.dataset.lk = String(link.keyName);
  if (link && link.varName) {
    el.dataset.vn = link.varName;
    el.dataset.vv = link.varValue == null ? '' : String(link.varValue);
  }
  return el.outerHTML;
}

function pagePayload(page) {
  const device = resolveDevice(page);
  const nodes = [];
  const overlays = [];
  for (const node of page.nodes) {
    if (node.hidden) continue;
    const item = { id: node.id, html: nodeHtml(node) };
    if (node.states && node.states.length) {
      item.states = {};
      for (const st of node.states) item.states[st.id] = nodeHtml(node, st.id);
      item.active = node.activeStateId || node.states[0].id;
    }
    if (node.type === 'group' && node.overlay) overlays.push(item);
    else nodes.push(item);
  }
  // 浮层放最后，保证层级在最上
  return {
    id: page.id,
    name: page.name,
    w: device.w,
    h: device.h,
    bg: page.bg || '#ffffff',
    nodes: nodes.concat(overlays)
  };
}

const RUNTIME = `
(function () {
  var D = window.__PROTO__;
  var stage = document.getElementById('stage');
  var cur = D.startPageId;
  var pages = {};
  var LP = 500, SW = 30;

  function boot(p) {
    var box = document.createElement('div');
    box.className = 'pg';
    box.dataset.pg = p.id;
    box.style.width = p.w + 'px';
    box.style.height = p.h + 'px';
    box.style.background = p.bg;
    box.style.position = 'relative';
    box.style.overflow = 'hidden';
    pages[p.id] = { data: p, box: box };

    var overlays = [];
    p.nodes.forEach(function (n) {
      var holder = document.createElement('div');
      holder.innerHTML = n.html;
      var el = holder.firstElementChild;
      if (!el) return;
      if (el.dataset.ov === '1') { overlays.push(el); return; }
      box.appendChild(el);
      bind(el, box, p);
    });

    overlays.forEach(function (el) {
      if (el.dataset.ovm === '1') {
        var mask = document.createElement('div');
        mask.className = 'ov-mask';
        mask.dataset.for = el.dataset.id;
        mask.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.45);z-index:900;';
        if (el.dataset.ovd !== '1') mask.style.display = 'none';
        box.appendChild(mask);
      }
      el.style.zIndex = '901';
      if (el.dataset.ovd !== '1') el.style.display = 'none';
      box.appendChild(el);
      bind(el, box, p);
    });

    stage.appendChild(box);
  }

  function bind(el, box, p) {
    var act = el.dataset.la;
    if (!act) return;
    var t = el.dataset.t || 'click';
    el.style.cursor = 'pointer';
    function fire() { run(el, box, p); }

    if (t === 'click') {
      el.addEventListener('click', function (e) { e.stopPropagation(); fire(); });
    } else if (t === 'dblclick') {
      el.addEventListener('dblclick', function (e) { e.stopPropagation(); fire(); });
    } else if (t === 'down') {
      el.addEventListener('pointerdown', function (e) { e.stopPropagation(); fire(); });
    } else if (t === 'up') {
      el.addEventListener('pointerup', function (e) { e.stopPropagation(); fire(); });
    } else if (t === 'contextmenu') {
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); fire(); });
    } else if (t === 'keydown') {
      var want = el.dataset.lk || 'Enter';
      window.addEventListener('keydown', function (e) { if (e.key === want || e.code === want) fire(); });
    } else if (t === 'shake') {
      window.addEventListener('devicemotion', function (ev) {
        var a = ev.accelerationIncludingGravity || ev.acceleration;
        if (!a) return;
        if (Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0) > 35) fire();
      });
    } else if (t === 'mouseenter') {
      el.addEventListener('mouseenter', fire);
    } else if (t === 'mouseleave') {
      el.addEventListener('mouseleave', fire);
    } else if (t === 'longpress') {
      var timer = null;
      var clear = function () { if (timer) { clearTimeout(timer); timer = null; } };
      el.addEventListener('pointerdown', function (e) {
        e.stopPropagation(); clear();
        timer = setTimeout(function () { timer = null; fire(); }, LP);
      });
      el.addEventListener('pointerup', clear);
      el.addEventListener('pointerleave', clear);
    } else if (t.indexOf('swipe') === 0) {
      var sx = 0, sy = 0, tracking = false;
      el.addEventListener('pointerdown', function (e) {
        e.stopPropagation(); sx = e.clientX; sy = e.clientY; tracking = true;
      });
      el.addEventListener('pointerup', function (e) {
        if (!tracking) return;
        tracking = false;
        var dx = e.clientX - sx, dy = e.clientY - sy;
        var horiz = Math.abs(dx) > Math.abs(dy);
        var dist = horiz ? Math.abs(dx) : Math.abs(dy);
        if (dist < SW) return;
        var dir = horiz ? (dx > 0 ? 'Right' : 'Left') : (dy > 0 ? 'Down' : 'Up');
        if ('swipe' + dir === t) fire();
      });
    }
  }

  var vars = {};
  (D.variables || []).forEach(function (v) { vars[v.name] = String(v.value == null ? '' : v.value); });

  function checkCond(el) {
    var vn = el.dataset.cv;
    if (!vn) return true;
    var actual = Object.prototype.hasOwnProperty.call(vars, vn) ? vars[vn] : '';
    var op = el.dataset.co || 'truthy';
    var expect = el.dataset.cval == null ? '' : el.dataset.cval;
    if (op === 'truthy') return actual !== '' && actual !== '0' && actual !== 'false';
    if (op === 'falsy') return actual === '' || actual === '0' || actual === 'false';
    if (op === 'neq') return actual !== expect;
    return actual === expect;
  }

  function run(el, box, p) {
    var act = el.dataset.la;
    if (!checkCond(el)) return;
    if (act === 'setVar') {
      if (el.dataset.vn) vars[el.dataset.vn] = (el.dataset.vv == null ? '' : el.dataset.vv);
      runWatchers(box, p);
      return;
    }
    if (act === 'navigate' && el.dataset.lp) { show(el.dataset.lp); return; }
    if (act === 'url' && el.dataset.lu) { window.open(el.dataset.lu, '_blank', 'noopener'); return; }

    var nodeId = el.dataset.ln;
    if (!nodeId) return;
    var target = box.querySelector('[data-id="' + nodeId + '"]');
    if (!target) return;

    if (act === 'state') {
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
      bind(fresh, box, p);
      return;
    }

    if (act === 'show') target.style.display = '';
    else if (act === 'hide') target.style.display = 'none';
    else if (act === 'toggle') target.style.display = (target.style.display === 'none' ? '' : 'none');
    else if (act === 'openOverlay' || act === 'closeOverlay') {
      var showOv = (act === 'openOverlay');
      target.style.display = showOv ? '' : 'none';
      var ovMask = box.querySelector('.ov-mask[data-for="' + nodeId + '"]');
      if (ovMask) ovMask.style.display = showOv ? '' : 'none';
    }
    else if (act === 'scrollTo' && target.scrollIntoView) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function runWatchers(box, p) {
    var list = box.querySelectorAll('[data-t="watch"]');
    Array.prototype.forEach.call(list, function (el) {
      if (checkCond(el)) run(el, box, p);
    });
  }

  function show(id) {
    cur = id;
    Object.keys(pages).forEach(function (k) {
      pages[k].box.style.display = (k === id ? 'block' : 'none');
    });
    fit();
    var p = pages[id];
    if (!p) return;
    var loads = p.box.querySelectorAll('[data-t="load"]');
    if (loads.length) {
      setTimeout(function () {
        Array.prototype.forEach.call(loads, function (el) { run(el, p.box, p.data); });
      }, 60);
    }
  }

  function fit() {
    var p = pages[cur];
    if (!p) return;
    var pad = 48;
    var s = Math.min(1, (window.innerWidth - pad) / p.data.w, (window.innerHeight - pad) / p.data.h);
    stage.style.transform = 'scale(' + s + ')';
  }

  window.addEventListener('resize', fit);

  D.pages.forEach(boot);
  show(D.startPageId);
})();
`;

export function buildStandaloneHtml(project) {
  const pages = project.pages.map(pagePayload);
  const data = {
    name: project.name || '原型',
    startPageId: project.activePageId || (pages[0] && pages[0].id),
    variables: (project.variables || []).map((v) => ({ name: v.name, value: v.value })),
    pages
  };

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
