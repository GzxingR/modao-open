/**
 * 交互跳转总览：把页面和它们之间的跳转关系画成一张图。
 */

const NS = 'http://www.w3.org/2000/svg';

const BOX_W = 156;
const BOX_H = 46;
const GAP_Y = 52;
const PAD_X = 36;
const PAD_Y = 34;
const CHANNEL = 96; // 右侧走线通道宽

/** 纯数据模型，便于测试 */
export function buildFlowModel(project) {
  const pages = (project && project.pages) || [];
  const nodes = pages.map((p, i) => ({
    id: p.id,
    name: p.name,
    x: PAD_X,
    y: PAD_Y + i * (BOX_H + GAP_Y),
    w: BOX_W,
    h: BOX_H,
    count: (p.nodes || []).length
  }));

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edgeMap = new Map();

  for (const p of pages) {
    for (const n of (p.nodes || [])) {
      const link = n.link;
      if (!link || link.action !== 'navigate' || !link.targetPageId) continue;
      if (!byId.has(link.targetPageId) || link.targetPageId === p.id) continue;
      const key = p.id + '>' + link.targetPageId;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          from: p.id,
          to: link.targetPageId,
          label: (n.text || n.type || '').slice(0, 10),
          count: 0
        });
      }
      edgeMap.get(key).count += 1;
    }
  }

  const edges = Array.from(edgeMap.values());
  const width = PAD_X * 2 + BOX_W + CHANNEL;
  const height = PAD_Y * 2 + Math.max(1, pages.length) * BOX_H + Math.max(0, pages.length - 1) * GAP_Y;
  return { nodes, edges, width, height, startId: project && project.activePageId };
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) el.setAttribute(k, String(attrs[k]));
  }
  return el;
}

/** 渲染成 SVG DOM（弹窗里直接 append） */
export function buildFlowSvg(project) {
  const model = buildFlowModel(project);
  const svg = svgEl('svg', {
    width: model.width,
    height: model.height,
    viewBox: '0 0 ' + model.width + ' ' + model.height,
    class: 'flow-svg'
  });

  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  const channelX = PAD_X + BOX_W + CHANNEL / 2;

  // 连线先画，避免压在方框上
  model.edges.forEach((e, i) => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) return;
    const y1 = a.y + a.h / 2;
    const y2 = b.y + b.h / 2;
    const cx = channelX + i * 6;
    const x1 = a.x + a.w;
    const x2 = b.x + b.w;
    const d = 'M' + x1 + ' ' + y1
      + ' C' + cx + ' ' + y1 + ' ' + cx + ' ' + y2 + ' ' + x2 + ' ' + y2;
    svg.appendChild(svgEl('path', {
      d,
      fill: 'none',
      stroke: '#1677ff',
      'stroke-width': 1.4,
      'stroke-opacity': 0.75,
      'marker-end': 'url(#flowArrow)'
    }));
  });

  // 箭头
  const defs = svgEl('defs');
  const marker = svgEl('marker', {
    id: 'flowArrow', viewBox: '0 0 10 10', refX: 9, refY: 5,
    markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'
  });
  marker.appendChild(svgEl('path', { d: 'M0 1L8 5L0 9z', fill: '#1677ff' }));
  defs.appendChild(marker);
  svg.insertBefore(defs, svg.firstChild);

  // 页面方框
  model.nodes.forEach((n) => {
    const g = svgEl('g', { class: 'flow-node' });
    g.appendChild(svgEl('rect', {
      x: n.x, y: n.y, width: n.w, height: n.h, rx: 8,
      fill: n.id === model.startId ? '#17304f' : '#21262f',
      stroke: n.id === model.startId ? '#1677ff' : '#3a4150',
      'stroke-width': 1
    }));
    const label = svgEl('text', {
      x: n.x + n.w / 2, y: n.y + 20,
      'text-anchor': 'middle', fill: '#e6e8ec', 'font-size': 12, 'font-family': 'Microsoft YaHei, sans-serif'
    });
    label.textContent = n.name;
    g.appendChild(label);

    const sub = svgEl('text', {
      x: n.x + n.w / 2, y: n.y + 36,
      'text-anchor': 'middle', fill: '#8a909c', 'font-size': 10, 'font-family': 'Microsoft YaHei, sans-serif'
    });
    sub.textContent = n.count + ' 个元素' + (n.id === model.startId ? ' · 起始页' : '');
    g.appendChild(sub);

    svg.appendChild(g);
  });

  return { svg, model };
}

/** 给弹窗用的摘要文案 */
export function describeFlow(project) {
  const m = buildFlowModel(project);
  if (!m.nodes.length) return '还没有页面';
  if (!m.edges.length) return m.nodes.length + ' 个页面，但还没有任何跳转。给按钮加「跳转页面」就能在这里看到连线。';
  return m.nodes.length + ' 个页面 / ' + m.edges.length + ' 条跳转';
}
