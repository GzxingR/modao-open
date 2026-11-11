# modao-open · 开源移动端原型工作台

> **EN** — A zero-dependency, MIT-licensed mobile prototyping workbench that runs entirely in the browser. Device canvases, 16 component types, drag/resize/snap, inspector, multi-page, click interactions, live preview, PNG/JSON/spec export, and AI generation with **your own API key**. No account, no subscription, no upload.

---

## 为什么要写这个

课程作业要求交移动端原型，指定的工具是某商业在线设计平台。

它的免费版限制项目数、卡组件、导出带水印；会员按年收费；最要命的是**不接受你自己的模型 API Key** —— 你明明已经在别处为 token 付过钱了，换个工具还得再买一份它的 AI 套餐。

所以照着它那套交互习惯（左组件库、中画布、右属性、闪电连线）重写了一个：

- **MIT**，代码全在仓库里，随便改
- **零依赖**，纯 HTML/CSS/ES module，没有构建链、没有 `node_modules`
- **BYO API Key**，DeepSeek / OpenAI / OpenRouter / 本地 Ollama 都行，Key 只在你自己浏览器的 `localStorage` 里
- **本地优先**，稿子不上传，不登录，不联网也能画（除 AI 外）

做作业能交，顺手也能当个轻量原型工具用。

---

## 能干什么

| 能力 | 说明 |
| --- | --- |
| 设备画布 | iPhone 17 / 16 / 15 / 14 / SE、Android、iPad、Web，尺寸与安全区内置 |
| 组件库 | 16 类：文本、矩形、圆形、分割线、图片、按钮、输入框、多行框、复选框、开关、图标、标签、卡片、列表项、导航栏、标签栏 |
| 编辑 | 拖动改位置、8 个手柄改尺寸、四边吸附 + 对齐参考线、层级上移下移置顶置底 |
| 属性面板 | 位置尺寸、圆角旋转、填充描边透明度、字号字重行高颜色对齐、组件专有项 |
| 多页面 | 页面列表增删、双击重命名 |
| 交互 | 点击跳转页面 / 显示 / 隐藏 / 切换，画布上画连线 |
| 预览 | 按设备尺寸缩放演示，交互可点 |
| 导出 | PNG（2 倍图）、项目 JSON（可再导入）、文字规格清单 |
| 撤销重做 | 80 步快照，`Ctrl+Z` / `Ctrl+Shift+Z` |
| 自动保存 | 每次改动写 `localStorage`，刷新不丢 |
| AI 生成 | OpenAI 兼容接口，自带 Key，中文描述直接出组件 |

---

## 快速开始

### 方式零：双击就用（单文件）

下载仓库，双击 `dist/modao-open.html`。整个应用（HTML + CSS + JS）打在一个 112 KB 的文件里，不需要服务器、不需要联网。

> ⚠️ `file://` 下浏览器把页面 origin 视为 `null`，**AI 请求会被 CORS 拦**。要连 AI 请用下面的本地服务方式；画布、组件、导出、预览在单文件版完全可用。

### 方式一：Windows 一键脚本

双击 `start.cmd`，自动起本地服务并打开浏览器。

### 方式二：Python

```bash
cd modao-open
python -m http.server 8788 --bind 127.0.0.1
# 打开 http://127.0.0.1:8788/
```

### 方式三：Node

```bash
npx --yes http-server -p 8788 -a 127.0.0.1 -c-1
```

> 直接双击 `index.html` 不行：`file://` 下浏览器会拦 ES module 的跨域加载。要么用上面两种服务方式，要么用 `dist/modao-open.html`。

### 改完源码重新打包单文件

```bash
python build.py     # 输出 dist/modao-open.html
```

---

## 接上你自己的模型

顶栏「AI 生成」→ 填三样：

| 字段 | 例子 |
| --- | --- |
| 接口地址（到 `/v1` 为止） | DeepSeek `https://api.deepseek.com/v1`<br>OpenAI `https://api.openai.com/v1`<br>OpenRouter `https://openrouter.ai/api/v1`<br>本地 Ollama `http://127.0.0.1:11434/v1` |
| 模型名 | `deepseek-chat` / `gpt-4o-mini` / `qwen2.5:7b` |
| API Key | `sk-...` |

用中文描述要什么页面（例如「做一个电商商品详情页，顶部商品大图，下面是名称价格，底部固定收藏和立即购买」），返回的组件会直接落到当前页面。

**安全说明**：Key 只存在这台机器的浏览器 `localStorage`，请求从你的浏览器直连你填的地址，不经过任何中间服务器。清浏览器数据即清除。

---

## 快捷键

| 键 | 作用 |
| --- | --- |
| `Ctrl + Z` / `Ctrl + Shift + Z` | 撤销 / 重做 |
| `Ctrl + D` | 复制选中元素 |
| `Ctrl + S` | 导出项目 JSON |
| `Delete` / `Backspace` | 删除选中 |
| `方向键` / `Shift + 方向键` | 微调 1px / 10px |
| `Esc` | 取消选择 |
| 从组件库拖到画布 | 在落点添加组件 |

---

## 自测

四套自测，**共 32 项，全绿**。不需要真实 API Key。

| 页面 | 覆盖内容 | 结果 |
| --- | --- | --- |
| `test/selftest.html` | 节点工厂、16 类组件渲染、撤销重做、复制、对齐、多页面保护、序列化往返、坏数据拒绝、规格文本 | 13/13 |
| `test/interact.html` | 真实挂载画布：点选、8 手柄缩放、拖动跟手（Δ=100,80）、空白取消选择、连线 SVG、缩放 transform | 8/8 |
| `test/export.html` | SVG→canvas→PNG 全链路、2 倍尺寸、像素回读验色 `rgb(22,119,255)`、半透明遮罩、四页全量导出 | 6/6 |
| `test/ai.html` | 调通 OpenAI 兼容接口、代码围栏容错解析、坐标归一化、401 报错、本地拦缺 Key | 5/5 |

跑法（起了本地服务之后）：

```
http://127.0.0.1:8788/test/selftest.html
http://127.0.0.1:8788/test/interact.html
http://127.0.0.1:8788/test/export.html    # 需先跑 mock：python test/mock_ai_server.py 8099
http://127.0.0.1:8788/test/ai.html
```

无头跑（CI 友好）：

```bash
chrome --headless=new --disable-gpu --dump-dom http://127.0.0.1:8788/test/selftest.html
```

想肉眼核对导出图：打开 `test/dump-png.html`，页面里显示的就是真实导出的 PNG（不是屏幕截图）。

---

## 项目结构

```
modao-open/
├── index.html          多文件版入口
├── css/app.css         全部样式（深色工作台 + 白色画布）
├── build.py            打包成单文件 dist/modao-open.html
├── src/
│   ├── model.js        设备表、组件定义、节点/页面/项目工厂
│   ├── store.js        状态 + 撤销重做 + localStorage
│   ├── nodes.js        节点 → DOM 渲染（画布与预览共用）
│   ├── canvas.js       画布渲染、选择、拖拽、缩放、对齐吸附
│   ├── library.js      页面列表 + 组件库
│   ├── inspector.js    属性面板
│   ├── links.js        交互连线 + 预览运行时
│   ├── io.js           PNG / JSON / 规格导出、项目导入
│   ├── ai.js           AI 生成（OpenAI 兼容）
│   ├── presets.js      示例项目（四页原型）
│   └── main.js         装配、工具栏、快捷键、拖放
├── dist/modao-open.html  单文件版（双击即用）
├── test/               4 套自测 + mock AI 服务 + 导出图核对页
├── start.cmd           Windows 一键起服务
└── LICENSE             MIT
```

---

## 自己改

- 换品牌色：`css/app.css` 的 `--accent`
- 加设备：`src/model.js` 的 `DEVICES`
- 加组件：`src/model.js` 的 `COMPONENTS` 加一条（给 `defaults()` 和图标 path），再到 `src/nodes.js` 的 `switch` 加渲染分支
- 加图标：`src/model.js` 的 `ICONS` 加一条 path

---

## 已知限制

- 没有团队协作、云端同步、账号体系 —— 定位就是本地优先
- 没有真机扫码预览，用预览模式代替
- 组件多状态机（一个组件的多套状态切换）还没做，目前是显隐 + 页面跳转
- `file://` 下 AI 不可用（浏览器 CORS 限制，见上）
- 导出走 `SVG foreignObject → canvas`，Chrome 下必须用 `data:` URL 加载 SVG，用 `blob:` 会被 canvas 污染标记（这个坑已在 `src/io.js` 里处理）

---

## License

[MIT](LICENSE) © 2026 modao-open contributors

**免责声明**：本项目是独立实现，与墨刀（Modao，深圳市皮索科技有限公司）及其母公司无任何关联、未使用其代码或资源。项目名中的 "modao" 仅用于说明交互习惯的参考来源，商标归其所有者。如果你需要官方产品与技术支持，请使用官方渠道。
