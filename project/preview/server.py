#!/usr/bin/env python3
"""Local-only Jev preview server for the game."""
from __future__ import annotations

import json
import os
import ssl
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    import certifi
except ImportError:
    certifi = None

PREVIEW_DIR = Path(__file__).resolve().parent
GAME_ROOT = PREVIEW_DIR.parent.resolve()
WORKSPACE_ENV = PREVIEW_DIR.parents[2] / ".env"
HOST = "127.0.0.1"
PORT = int(os.environ.get("JEV_PREVIEW_PORT", "8765"))
MAX_BODY = 16_000


def get_api_key() -> str:
    key = os.environ.get("TYPESAFE_API_KEY", "").strip()
    if not key and WORKSPACE_ENV.is_file():
        for line in WORKSPACE_ENV.read_text(encoding="utf-8").splitlines():
            name, sep, value = line.partition("=")
            if sep and name.strip() == "TYPESAFE_API_KEY":
                key = value.strip().strip("\"'")
                break
    return key


def finite_number(value, default=0.0):
    try:
        number = float(value)
        return number if number == number and abs(number) != float("inf") else default
    except (TypeError, ValueError):
        return default


def compact_state(raw):
    if not isinstance(raw, dict):
        raise ValueError("Expected a game state object")
    obstacles = raw.get("obstacles", [])
    if not isinstance(obstacles, list):
        obstacles = []
    clean_obstacles = []
    for obstacle in obstacles[:6]:
        if isinstance(obstacle, dict):
            clean_obstacles.append({k: finite_number(obstacle.get(k)) for k in ("x", "y", "vx", "radius")})
    return {
        "player": {k: finite_number(raw.get(k)) for k in ("x", "y", "velocityY")},
        "groundY": finite_number(raw.get("groundY")),
        "ceilingY": finite_number(raw.get("ceilingY")),
        "obstacles": clean_obstacles,
    }


def evaluate(state):
    key = get_api_key()
    if not key:
        raise RuntimeError("TYPESAFE_API_KEY is missing from the workspace .env or environment")
    payload = {
        "model": "jev-latest",
        "state": state,
        "questions": {
            "flap_now": {
                "type": "choice",
                "instructions": "Given this numeric snapshot of a side-scrolling bird game, should the player flap now or keep gliding? Choose the action that best avoids the ceiling, ground, and nearby moving obstacles over the next brief moment.",
                "criteria": {
                    "flap": "Apply one upward flap impulse now to avoid an imminent collision or unsafe height.",
                    "glide": "Do not flap now; the current trajectory is safer without an upward impulse.",
                },
            }
        },
    }
    request = Request(
        "https://api.typesafe.ai/v1/systemone",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    ssl_context = ssl.create_default_context(cafile=certifi.where()) if certifi else ssl.create_default_context()
    with urlopen(request, timeout=12, context=ssl_context) as response:
        result = json.loads(response.read().decode("utf-8"))
    answer = result.get("answers", {}).get("flap_now", {})
    if answer.get("type") != "choice" or answer.get("choice") not in ("flap", "glide"):
        raise RuntimeError("Jev returned an unexpected decision shape")
    return {
        "action": answer["choice"],
        "probabilities": answer.get("probabilities", {}),
        "confidence": answer.get("confidence"),
        "model": result.get("model", "jev-latest"),
        "latencyMs": round((time.perf_counter() - started) * 1000),
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(GAME_ROOT), **kwargs)

    def log_message(self, fmt, *args):
        # Do not log request bodies, headers, or credential-bearing details.
        print("[preview] " + (fmt % args), file=sys.stderr)

    def end_headers(self):
        # The preview serves files being edited locally; a stale ES module
        # can otherwise survive a page reload and mismatch the new game code.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/" and "jev=1" in self.path.split("?", 1)[-1].split("&"):
            index = GAME_ROOT / "index.html"
            page = index.read_text(encoding="utf-8")
            injected = '<script src="/preview/jev-preview.js"></script>'
            page = page.replace("</body>", injected + "\n  </body>")
            data = page.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/__jev/decide":
            self.send_error(404)
            return
        origin = self.headers.get("Origin")
        if origin and origin != f"http://{HOST}:{PORT}":
            self.send_error(403)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                raise ValueError("Request body size is invalid")
            raw = json.loads(self.rfile.read(length))
            state = compact_state(raw)
            response = {"ok": True, **evaluate(state)}
            status = 200
        except HTTPError as exc:
            response, status = {"ok": False, "error": f"TypeSafe HTTP {exc.code}"}, 502
        except (URLError, TimeoutError) as exc:
            response, status = {"ok": False, "error": f"TypeSafe request failed: {exc}"}, 502
        except Exception as exc:
            response, status = {"ok": False, "error": str(exc)}, 502
        data = json.dumps(response).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    print(f"Jev preview: http://{HOST}:{PORT}/?jev=1")
    print(f"Serving game files from {GAME_ROOT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
