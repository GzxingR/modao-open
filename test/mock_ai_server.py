# -*- coding: utf-8 -*-
"""极简 OpenAI 兼容 mock 服务，只为验证 modao-open 的 AI 调用链路。

用法: python mock_ai_server.py 8099
- POST /v1/chat/completions  -> 200, 返回一段带 ```json 围栏的组件 JSON
- POST /bad/chat/completions -> 401, 返回错误体
任何 OPTIONS 都回 204 + CORS 头（浏览器预检）。
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

PAGE_JSON = {
    "name": "登录页",
    "nodes": [
        {"type": "text", "text": "校园助手", "x": 0, "y": 96, "w": 402, "h": 40,
         "fontSize": 28, "fontWeight": 700, "align": "center"},
        {"type": "input", "text": "请输入手机号", "x": 41, "y": 300, "w": 320, "h": 48, "radius": 8},
        {"type": "input", "text": "请输入密码", "x": 41, "y": 364, "w": 320, "h": 48, "radius": 8},
        {"type": "button", "text": "登录", "x": 41, "y": 436, "w": 320, "h": 44,
         "bg": "#1677ff", "radius": 8, "align": "center"},
        {"type": "text", "text": "忘记密码", "x": 41, "y": 496, "w": 320, "h": 20,
         "fontSize": 14, "color": "#1677ff", "align": "right"}
    ]
}


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            body = {}

        if self.path.startswith("/bad/"):
            payload = json.dumps({"error": {"message": "invalid api key"}}).encode()
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # 正常：把组件 JSON 包进 ```json 围栏，顺便验证解析容错
        content = "好的，这是你要的页面：\n```json\n" + json.dumps(PAGE_JSON, ensure_ascii=False) + "\n```\n"
        payload = json.dumps({
            "id": "mock-1",
            "object": "chat.completion",
            "model": body.get("model", "mock"),
            "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 200, "total_tokens": 300}
        }, ensure_ascii=False).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):
        sys.stderr.write("[mock] " + (fmt % args) + "\n")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
    print("mock ai server on http://127.0.0.1:%d/v1" % port)
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()
