# -*- coding: utf-8 -*-
"""
把多文件版打包成单文件 dist/modao-open.html（可双击打开，无需本地服务器）。

做法：按依赖顺序拼接 src/*.js，剥掉 import/export 语句，把 CSS 与 JS 内联进 index.html。
模块之间无循环依赖，因此顺序拼接即可。

用法: python build.py
"""
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
OUT_DIR = os.path.join(ROOT, "dist")
OUT_FILE = os.path.join(OUT_DIR, "modao-open.html")

# 依赖顺序（被依赖的在前）
ORDER = [
    "model.js",
    "store.js",
    "contextmenu.js",
    "resizer.js",
    "theme.js",
    "help.js",
    "nodes.js",
    "canvas.js",
    "library.js",
    "inspector.js",
    "links.js",
    "io.js",
    "exportHtml.js",
    "pdf.js",
    "ai.js",
    "presets.js",
    "main.js",
]

RE_IMPORT = re.compile(r"import[\s\S]*?from\s+['\"][^'\"]+['\"];?")
RE_EXPORT_BLOCK = re.compile(r"export\s*\{[^}]*\};?")
RE_EXPORT_DECL = re.compile(r"^export\s+(async\s+function|function|const|let|class|var)\b", re.M)


def strip_module(raw):
    out = RE_IMPORT.sub("", raw)
    out = RE_EXPORT_BLOCK.sub("", out)
    out = RE_EXPORT_DECL.sub(lambda m: m.group(1), out)
    return out


def bundle_js():
    parts = []
    for name in ORDER:
        path = os.path.join(SRC, name)
        with open(path, encoding="utf-8") as f:
            raw = f.read()
        body = strip_module(raw)
        parts.append("/* ===== src/%s ===== */\n%s" % (name, body.strip()))
    return "\n\n".join(parts)


def main():
    with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
        html = f.read()
    with open(os.path.join(ROOT, "css", "app.css"), encoding="utf-8") as f:
        css = f.read()

    js = bundle_js()

    html = html.replace(
        '<link rel="stylesheet" href="./css/app.css">',
        "<style>\n" + css + "\n</style>",
    )
    html = html.replace(
        '<script type="module" src="./src/main.js"></script>',
        "<script>\n" + js + "\n</script>",
    )

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        f.write(html)

    size = os.path.getsize(OUT_FILE)
    print("built %s  (%.0f KB)" % (OUT_FILE, size / 1024))


if __name__ == "__main__":
    main()
