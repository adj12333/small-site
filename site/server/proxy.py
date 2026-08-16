#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
泠风吹梦的小站 - 本地代理服务器
职责：静态文件服务 + 音乐播放源解析/下载代理
启动：python server/proxy.py
"""
import http.server
import json
import os
import sys
import urllib.request
import urllib.error
from urllib.parse import urlparse, parse_qs, quote

# 避免生成 __pycache__ 字节码缓存，保持项目目录整洁
sys.dont_write_bytecode = True

PORT = 8080

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # 禁用缓存，避免改动 CSS/JS 后浏览器仍使用旧版本
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def _is_forbidden(self):
        # 禁止访问 server 目录，防止 key.txt / proxy.py 泄露
        return self.path.startswith("/server")

    def do_GET(self):
        if self._is_forbidden():
            self.send_error(404)
            return
        if self.path.startswith("/api/music/download"):
            self._handle_music_download()
            return
        if self.path.startswith("/api/music/info"):
            self._handle_music_info()
            return
        if self.path.startswith("/api/music/resolve-info"):
            self._handle_music_resolve_info()
            return
        if self.path.startswith("/api/music/resolve"):
            self._handle_music_resolve()
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

    def _handle_music_download(self):
        # 音乐下载代理：后端转发到真实 mp3，规避跨域并统一设置下载响应头
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        url = qs.get("url", [""])[0]
        name = qs.get("name", ["music.mp3"])[0]

        if not (url.startswith("http://") or url.startswith("https://")):
            self._send_json(400, {"error": {"message": "无效的下载地址"}})
            return

        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(request, timeout=60) as resp:
                data = resp.read()
        except Exception as e:
            self._send_json(502, {"error": {"message": "下载失败：%s" % e}})
            return

        filename = name.strip() or "music.mp3"
        filename = "".join("_" if ch in '\\/:*?"<>|' else ch for ch in filename)
        if not filename.lower().endswith(".mp3"):
            filename += ".mp3"

        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header(
            "Content-Disposition",
            "attachment; filename=\"music.mp3\"; filename*=UTF-8''%s" % quote(filename),
        )
        self._send_cors()
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _handle_music_info(self):
        # 解析音频头部信息（采样率 / 比特率 / 声道数），供前端音质显示与多声道判断
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        url = qs.get("url", [""])[0]

        if not (url.startswith("http://") or url.startswith("https://")):
            self._send_json(400, {"error": {"message": "无效的音频地址"}})
            return

        try:
            # 只读取头部 512KB 足够解析 MP3 帧头 / FLAC STREAMINFO / M4A 头部
            info = self._fetch_audio_info(url)
        except Exception as e:
            self._send_json(502, {"error": {"message": "获取音频信息失败：%s" % e}})
            return

        if not info:
            self._send_json(502, {"error": {"message": "无法解析音频信息"}})
            return
        self._send_json(200, info)

    def _parse_audio_info(self, data):
        if data[:4] == b"fLaC":
            return self._parse_flac(data)
        if len(data) >= 8 and data[4:8] == b"ftyp":
            return self._parse_m4a(data)
        return self._parse_mp3(data)

    def _parse_mp3(self, data):
        # 跳过 ID3v2 标签，找到第一个有效帧，解析帧头
        pos = 0
        if data[:3] == b"ID3" and len(data) >= 10:
            size = (
                ((data[6] & 0x7F) << 21)
                | ((data[7] & 0x7F) << 14)
                | ((data[8] & 0x7F) << 7)
                | (data[9] & 0x7F)
            )
            pos = 10 + size

        n = len(data)
        while pos + 4 <= n:
            if data[pos] == 0xFF and (data[pos + 1] & 0xE0) == 0xE0:
                b1 = data[pos + 1]
                b2 = data[pos + 2]
                b3 = data[pos + 3]
                version_id = (b1 >> 3) & 0x3
                layer = (b1 >> 1) & 0x3
                bitrate_idx = (b2 >> 4) & 0xF
                sample_idx = (b2 >> 2) & 0x3
                channel_mode = (b3 >> 6) & 0x3

                if (
                    version_id == 1
                    or layer == 0
                    or bitrate_idx in (0, 15)
                    or sample_idx == 3
                ):
                    pos += 1
                    continue

                if version_id == 3:
                    sample_table = (44100, 48000, 32000)
                elif version_id == 2:
                    sample_table = (22050, 24000, 16000)
                else:
                    sample_table = (11025, 12000, 8000)

                if layer == 1:  # Layer III
                    if version_id == 3:
                        br_table = (0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0)
                    else:
                        br_table = (0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0)
                elif layer == 2:  # Layer II
                    br_table = (0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0)
                else:  # Layer I
                    br_table = (0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0)

                channels = 1 if channel_mode == 3 else 2
                return {
                    "format": "mp3",
                    "sample_rate": sample_table[sample_idx],
                    "bitrate": br_table[bitrate_idx],
                    "channels": channels,
                }
            pos += 1
        return None

    def _parse_flac(self, data):
        # FLAC: "fLaC" + metadata blocks，首个通常为 STREAMINFO
        pos = 4
        n = len(data)
        while pos + 4 <= n:
            block_type = data[pos] & 0x7F
            is_last = data[pos] & 0x80
            length = (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3]
            body = pos + 4
            if block_type == 0 and body + 34 <= n:
                info = data[body + 10:body + 18]  # 8 字节：采样率/声道/位深/采样总数
                v = int.from_bytes(info, "big")
                sample_rate = (v >> 44) & 0xFFFFF
                channels = ((v >> 41) & 0x7) + 1
                return {
                    "format": "flac",
                    "sample_rate": sample_rate,
                    "bitrate": None,
                    "channels": channels,
                }
            if is_last:
                break
            pos = body + length
        return None

    def _parse_m4a(self, data):
        # M4A 声道信息在 stsd->mp4a 的 AudioSampleEntry 里；直接扫描 "mp4a" 四字节定位
        n = len(data)
        idx = 0
        while True:
            idx = data.find(b"mp4a", idx)
            if idx == -1:
                break
            if idx + 32 > n:
                idx += 4
                continue
            if idx >= 4:
                box_size = int.from_bytes(data[idx - 4:idx], "big")
                if box_size < 28:
                    idx += 4
                    continue
            channels = int.from_bytes(data[idx + 20:idx + 22], "big")
            sample_rate = int.from_bytes(data[idx + 28:idx + 32], "big") >> 16
            if 1 <= channels <= 32 and (sample_rate == 0 or 8000 <= sample_rate <= 384000):
                return {
                    "format": "m4a",
                    "sample_rate": sample_rate or None,
                    "bitrate": None,
                    "channels": channels,
                }
            idx += 4
        return None

    def _fetch_json(self, url, headers=None, data=None, method="GET"):
        req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                raw = resp.read().decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", "ignore")
        except Exception as e:
            raise Exception(str(e))
        if not raw or not raw.strip():
            return {}
        try:
            return json.loads(raw)
        except Exception:
            raise Exception("上游返回非 JSON 数据")

    def _resolve_music_url(self, provider, source, song_id):
        # 公益/聚合播放源解析（当前多数接口失效/维护中，保留框架，待恢复后可用）
        ua = {"User-Agent": "Mozilla/5.0"}

        if provider == "xuanlan":
            url = "https://source.shiqianjiang.cn/api/music/url?source=%s&songId=%s&quality=320k" % (source, song_id)
            data = self._fetch_json(url, headers=ua)
            if data.get("code") == 200 and data.get("url"):
                return data["url"]
            raise Exception(data.get("message") or "解析失败")

        if provider == "lingchuan":
            url = "https://lc.guoyue2010.top/api/music/url?source=%s&songId=%s&quality=320k" % (source, song_id)
            data = self._fetch_json(url, headers=ua)
            if data.get("code") == 200 and data.get("url"):
                return data["url"]
            raise Exception(data.get("message") or "解析失败")

        if provider == "collect":
            if source == "tx":
                url = "https://cyapi.top/API/qq_music.php?apikey=1ffdf5733f5d538760e63d7e46ba17438d9f7b9dfc18c51be1109386fd74c3a1&type=json&mid=%s" % song_id
                data = self._fetch_json(url, headers=ua)
                if data.get("url"):
                    return data["url"]
            elif source == "wy":
                url = "https://api.cenguigui.cn/api/netease/music_v1.php?id=%s&type=json&level=lossless" % song_id
                data = self._fetch_json(url, headers=ua)
                if data.get("data", {}).get("url"):
                    return data["data"]["url"]
            elif source == "kw":
                url = "https://kw-api.cenguigui.cn?id=%s&type=song&format=json&level=lossless" % song_id
                data = self._fetch_json(url, headers=ua)
                if data.get("data", {}).get("url"):
                    return data["data"]["url"]
            raise Exception("该播放源暂不支持此平台")

        if provider == "lerd":
            url = "https://api.music.lerd.dpdns.org/%s" % source
            body = json.dumps({"musicInfo": {"hash": song_id, "source": source}, "type": "flac"}).encode("utf-8")
            data = self._fetch_json(url, headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}, data=body, method="POST")
            if data.get("code") == 200 and data.get("data", {}).get("url"):
                return data["data"]["url"]
            raise Exception(data.get("msg") or "解析失败")

        if provider == "xinghai":
            src_map = {"wy": "netease", "tx": "tencent", "kg": "kugou", "kw": "kuwo", "mg": "migu"}
            api_source = src_map.get(source)
            if not api_source:
                raise Exception("该播放源暂不支持此平台")
            url = "https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=forest&need_sec_link=1&sec_link_scene=im&theme=light&types=url&source=%s&id=%s&br=740" % (api_source, song_id)
            data = self._fetch_json(url, headers=ua)
            if data.get("url"):
                return data["url"]
            raise Exception("解析失败")

        raise Exception("未知播放源")

    def _handle_music_resolve(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        provider = qs.get("provider", [""])[0]
        source = qs.get("source", [""])[0]
        song_id = qs.get("songId", [""])[0]
        if not provider or not source or not song_id:
            self._send_json(400, {"error": {"message": "参数不完整"}})
            return
        try:
            url = self._resolve_music_url(provider, source, song_id)
            self._send_json(200, {"url": url})
        except Exception as e:
            self._send_json(502, {"error": {"message": str(e)}})

    def _fetch_range(self, url, range_header):
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0", "Range": range_header},
            )
            with urllib.request.urlopen(request, timeout=15) as resp:
                return resp.read(262144)
        except Exception:
            return None

    def _fetch_audio_info(self, url):
        data = self._fetch_range(url, "bytes=0-262143")
        if not data:
            return None
        info = self._parse_audio_info(data)
        if info:
            return info
        # m4a 的 moov 可能在文件末尾（非 faststart），读取末尾再试
        if len(data) >= 8 and data[4:8] == b"ftyp":
            tail = self._fetch_range(url, "bytes=-262144")
            if tail:
                info = self._parse_audio_info(tail)
                if info:
                    return info
        return None

    def _handle_music_resolve_info(self):
        # 一次请求完成「播放源解析 + 声道探测」，供列表标签使用
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        provider = qs.get("provider", [""])[0]
        source = qs.get("source", [""])[0]
        song_id = qs.get("songId", [""])[0]
        if not provider or not source or not song_id:
            self._send_json(400, {"error": {"message": "参数不完整"}})
            return
        try:
            url = self._resolve_music_url(provider, source, song_id)
            info = self._fetch_audio_info(url)
            if not info:
                raise Exception("获取音频信息失败")
            self._send_json(200, {"url": url, "channels": info.get("channels", 1)})
        except Exception as e:
            self._send_json(502, {"error": {"message": str(e)}})

    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, code, obj):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._send_cors()
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        pass  # 关闭访问日志，保持终端清爽


if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("站点已启动：http://localhost:%d" % PORT)
    print("按 Ctrl+C 停止")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
