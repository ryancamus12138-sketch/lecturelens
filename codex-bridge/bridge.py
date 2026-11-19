#!/usr/bin/env python3
"""LectureLens <-> Codex CLI bridge.

Lets the LectureLens extension use the Codex CLI you are already signed in to (ChatGPT plan)
for summaries and Q&A, instead of a paid API key. It listens on 127.0.0.1 only and speaks the
OpenAI chat-completions format; every request becomes one `codex exec` run in an empty,
read-only temp folder.

Run:   python3 bridge.py          (keep the Terminal window open while you study)
Env:   LL_PORT=8765   LL_EFFORT=low   LL_CODEX=codex   LL_TIMEOUT=300
"""
import base64, json, os, re, secrets, shutil, subprocess, sys, tempfile, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("LL_PORT", "8765"))
EFFORT = os.environ.get("LL_EFFORT", "low")
CODEX = os.environ.get("LL_CODEX", "codex")
TIMEOUT = int(os.environ.get("LL_TIMEOUT", "300"))
TOKEN_FILE = os.path.expanduser("~/.lecturelens_bridge_token")

def load_token():
    if os.path.exists(TOKEN_FILE):
        t = open(TOKEN_FILE).read().strip()
        if t:
            return t
    t = "ll-" + secrets.token_hex(16)
    with open(TOKEN_FILE, "w") as f:
        f.write(t)
    os.chmod(TOKEN_FILE, 0o600)
    return t

TOKEN = load_token()

CODEX_HOME = os.environ.get("CODEX_HOME", os.path.expanduser("~/.codex"))
_catalog = {"at": 0, "data": None}

def _levels(item):
    out = []
    for k, v in item.items():
        if "reasoning" in k and isinstance(v, list):
            for x in v:
                e = x.get("effort") if isinstance(x, dict) else x
                if isinstance(e, str) and e not in out:
                    out.append(e)
    return out

def _parse_catalog(text):
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0] or [-1])
    if start < 0:
        return []
    raw = json.loads(text[start:])
    items = raw.get("models") if isinstance(raw, dict) else raw
    out = []
    for it in items or []:
        if not isinstance(it, dict):
            continue
        mid = it.get("slug") or it.get("id")
        if not mid or it.get("visibility") in ("hide", "none") or it.get("hidden") is True:
            continue
        default = next((v for k, v in it.items() if "default" in k and "reasoning" in k and isinstance(v, str)), None)
        out.append({"id": mid, "name": it.get("display_name") or it.get("name") or mid, "efforts": _levels(it), "default_effort": default})
    return out

def config_defaults():
    model = effort = None
    try:
        for line in open(os.path.join(CODEX_HOME, "config.toml"), encoding="utf-8"):
            if line.startswith("["):
                break  # only top-level keys
            m = re.match(r'\s*(model|model_reasoning_effort)\s*=\s*"([^"]+)"', line)
            if m:
                if m.group(1) == "model": model = m.group(2)
                else: effort = m.group(2)
    except Exception:
        pass
    return model, effort

def catalog():
    """Models this Codex install offers: `codex debug models`, else its cache file."""
    if _catalog["data"] is not None and time.time() - _catalog["at"] < 600:
        return _catalog["data"]
    models = []
    try:
        p = subprocess.run([CODEX, "debug", "models"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=25)
        models = _parse_catalog(p.stdout.decode("utf-8", "replace"))
    except Exception:
        pass
    if not models:
        try:
            models = _parse_catalog(open(os.path.join(CODEX_HOME, "models_cache.json"), encoding="utf-8").read())
        except Exception:
            pass
    _catalog.update(at=time.time(), data=models)
    return models

def run_codex(messages, model, effort=None):
    work = tempfile.mkdtemp(prefix="lecturelens-")
    try:
        images, chunks = [], []
        for m in messages:
            role, content = m.get("role", "user"), m.get("content", "")
            if isinstance(content, str):
                text = content
            else:
                text = ""
                for p in content:
                    if p.get("type") == "text":
                        text += p.get("text", "") + "\n\n"
                    elif p.get("type") == "image_url":
                        url = p["image_url"]["url"]
                        if url.startswith("data:") and "," in url:
                            path = os.path.join(work, "frame%d.jpg" % (len(images) + 1))
                            with open(path, "wb") as f:
                                f.write(base64.b64decode(url.split(",", 1)[1]))
                            images.append(path)
                            text += "[附图 %d]\n\n" % len(images)
            label = {"system": "【要求】", "assistant": "【你之前的回答】", "user": "【用户】"}.get(role, "")
            chunks.append(label + "\n" + text.strip())
        prompt = ("这是一个纯问答任务：不要运行任何命令，不要读取或修改任何文件，不要联网，直接根据下面的内容"
                  + ("和附带的图片" if images else "") + "作答，只输出最终答案本身。\n\n" + "\n\n".join(chunks))
        out = os.path.join(work, "answer.txt")
        cmd = [CODEX, "exec", "--skip-git-repo-check", "--ephemeral", "-s", "read-only", "-C", work]
        if model and model.lower() not in ("default", "codex", "codex-default"):
            cmd += ["-m", model]
        eff = EFFORT if effort is None else effort
        if eff and eff != "default" and re.fullmatch(r"[a-z]+", eff):
            cmd += ["-c", 'model_reasoning_effort="%s"' % eff]
        for img in images:
            cmd += ["-i", img]
        cmd += ["-o", out, "-"]
        p = subprocess.run(cmd, input=prompt.encode("utf-8"), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=TIMEOUT)
        answer = open(out, encoding="utf-8").read().strip() if os.path.exists(out) else ""
        if p.returncode != 0 or not answer:
            tail = (p.stderr.decode("utf-8", "replace") or p.stdout.decode("utf-8", "replace"))[-600:]
            raise RuntimeError("codex exec 失败 (exit %s): %s" % (p.returncode, tail.strip()))
        return answer
    finally:
        shutil.rmtree(work, ignore_errors=True)

class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def _send(self, code, obj):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.rstrip("/").endswith("/models"):
            if self.headers.get("Authorization", "") != "Bearer " + TOKEN:
                return self._send(401, {"error": "口令不对"})
            model, effort = config_defaults()
            return self._send(200, {"data": catalog(), "default_model": model, "default_effort": effort})
        self._send(200, {"ok": True, "service": "lecturelens-codex-bridge"})

    def do_POST(self):
        if self.headers.get("Authorization", "") != "Bearer " + TOKEN:
            return self._send(401, {"error": "口令不对：把启动桥接时终端里显示的口令填到扩展的“总结接口的 API key”里"})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
            n_img = sum(1 for m in body.get("messages", []) if isinstance(m.get("content"), list) for p in m["content"] if p.get("type") == "image_url")
            print("-> 请求：%d 条消息，%d 张图 …" % (len(body.get("messages", [])), n_img), flush=True)
            model, effort = body.get("model", ""), body.get("reasoning_effort")
            print("   模型=%s  推理强度=%s" % (model or "default", effort or EFFORT or "default"), flush=True)
            answer = run_codex(body.get("messages", []), model, effort)
            print("<- 完成（%d 字）" % len(answer), flush=True)
            self._send(200, {"choices": [{"message": {"role": "assistant", "content": answer}}]})
        except subprocess.TimeoutExpired:
            print("!! 超时", flush=True)
            self._send(422, {"error": "Codex 超过 %d 秒没有返回" % TIMEOUT})
        except Exception as e:
            print("!! " + str(e), flush=True)
            self._send(422, {"error": str(e)})

if __name__ == "__main__":
    if not shutil.which(CODEX):
        sys.exit("找不到 codex 命令。先安装 Codex CLI 并运行 `codex login` 用 ChatGPT 账号登录。")
    print("LectureLens Codex 桥接已启动（只监听本机）")
    print("  接口地址:  http://127.0.0.1:%d/v1" % PORT)
    print("  口令:      %s" % TOKEN)
    print("  模型名:    default（用 Codex 当前默认模型）")
    print("保持这个窗口开着；按 Ctrl+C 停止。\n", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
