# -*- coding: utf-8 -*-
"""
泠风吹梦的小站 - 本地代理服务器
职责：静态文件服务 + 音乐播放源解析/下载代理
启动：python server/proxy.py
"""
import http.server
import os
import posixpath
import sys
from urllib.parse import unquote, urlparse

# 避免生成 __pycache__ 字节码缓存，保持项目目录整洁（必须在导入本地模块前设置）
sys.dont_write_bytecode = True

from music_api import MusicAPI

PORT = 8080

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class Handler(MusicAPI, http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def send_response(self, code, message=None):
        # 记录状态码，供 end_headers 判断是否允许缓存
        self._status_code = code
        super().send_response(code, message)

    def end_headers(self):
        # HTML/CSS/JS/API 与错误响应禁用缓存，避免浏览器沿用旧版本或误缓存 404
        path = self.path.split('?')[0].lower()
        if getattr(self, "_status_code", 200) != 200:
            self.send_header("Cache-Control", "no-store")
        elif path.endswith(('.html', '.css', '.js', '.json')) or self.path.startswith('/api/'):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        else:
            self.send_header("Cache-Control", "public, max-age=3600")
        super().end_headers()

    def _normalized_path(self):
        # 解码、统一分隔符、规范化并转小写，避免 URL 编码 / 反斜杠 / 大小写绕过
        path = unquote(urlparse(self.path).path).replace("\\", "/")
        return posixpath.normpath(path).lower()

    def _is_forbidden(self):
        # 只开放 /site 与 /api，避免泄露仓库 .git、server 密钥、音源参考脚本与内部文档
        path = self._normalized_path()
        if path == "/api" or path.startswith("/api/"):
            return False
        if path == "/site" or path.startswith("/site/"):
            if path == "/site/server" or path.startswith("/site/server/"):
                return True
            if path == "/site/yinyuan" or path.startswith("/site/yinyuan/"):
                return True
            return path in ("/site/rules.md", "/site/project-status.md", "/site/.gitignore")
        return True

    def do_GET(self):
        if self._normalized_path() == "/":
            self.send_response(302)
            self.send_header("Location", "/site/")
            self.end_headers()
            return
        if self._is_forbidden():
            self.send_error(404)
            return
        if self.handle_music_request():
            return
        super().do_GET()

    def do_HEAD(self):
        if self._is_forbidden():
            self.send_error(404)
            return
        super().do_HEAD()

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def do_POST(self):
        self.send_error(404)

    def copyfile(self, source, outputfile):
        # 音频拖动进度/关闭页面会重置连接，属正常现象，不打印堆栈
        try:
            super().copyfile(source, outputfile)
        except (ConnectionResetError, BrokenPipeError):
            pass

    def log_message(self, fmt, *args):
        pass  # 关闭访问日志，保持终端清爽


if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("站点已启动：http://localhost:%d/site/" % PORT)
    print("按 Ctrl+C 停止")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
