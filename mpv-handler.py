#!/usr/bin/env python3
"""Local server to open YouTube videos in mpv."""

import json
import logging
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = 38421
TIMESTAMP_RE = re.compile(r"^\d+(\.\d+)?$")
LOG_PATH = os.path.join(tempfile.gettempdir(), "mpv-handler.log")

logger = logging.getLogger("mpv-handler")
logger.setLevel(logging.DEBUG)
_formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

_file_handler = logging.FileHandler(LOG_PATH, encoding="utf-8")
_file_handler.setFormatter(_formatter)
logger.addHandler(_file_handler)

_console_handler = logging.StreamHandler()
_console_handler.setFormatter(_formatter)
logger.addHandler(_console_handler)


def find_mpv():
    """Detect mpv binary path across Linux, macOS, and Windows."""
    mpv = shutil.which("mpv") or shutil.which("mpv.exe")
    if mpv:
        return mpv

    system = platform.system()

    if system == "Windows":
        candidates = [
            os.path.expandvars(r"%LOCALAPPDATA%\mpv\mpv.exe"),
            r"C:\Program Files\mpv\mpv.exe",
            r"C:\Program Files (x86)\mpv\mpv.exe",
            os.path.expanduser(r"~\scoop\apps\mpv\current\mpv.exe"),
            r"C:\ProgramData\chocolatey\bin\mpv.exe",
        ]
    elif system == "Darwin":
        candidates = [
            "/opt/homebrew/bin/mpv",
            "/usr/local/bin/mpv",
        ]
    else:
        candidates = [
            os.path.expanduser("~/.local/bin/mpv"),
            "/usr/bin/mpv",
            "/usr/local/bin/mpv",
        ]

    for path in candidates:
        if os.path.isfile(path):
            return path

    return None


MPV_PATH = find_mpv()


class MpvHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/play" and "url" in params:
            url = params["url"][0]
            logger.info("Play request: %s", url)

            mpv_args = [url]
            raw_timestamp = params.get("t", [None])[0]
            if raw_timestamp:
                if TIMESTAMP_RE.match(raw_timestamp):
                    mpv_args.append(f"--start={raw_timestamp}")
                else:
                    logger.warning("Ignoring invalid timestamp: %s", raw_timestamp)

            if not MPV_PATH:
                logger.error("mpv binary not found, cannot launch")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "mpv not found"}).encode())
                return

            try:
                logger.debug("Launching: %s %s", MPV_PATH, " ".join(mpv_args))
                proc = subprocess.Popen(
                    [MPV_PATH, *mpv_args],
                    stdout=self._mpv_log_handle(),
                    stderr=subprocess.STDOUT,
                )
                logger.info("mpv launched (pid=%s)", proc.pid)
            except Exception:
                logger.exception("Failed to launch mpv")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Failed to launch mpv"}).encode())
                return

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok"}).encode())
        elif parsed.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "running"}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def _mpv_log_handle(self):
        """Open mpv's own stdout/stderr into the shared log file, appended per launch."""
        return open(LOG_PATH, "a", encoding="utf-8")

    def log_message(self, format, *args):
        logger.debug(format % args)


if __name__ == "__main__":
    logger.info("MPV_PATH resolved to: %s", MPV_PATH)
    if not MPV_PATH:
        logger.warning("mpv not found. Install mpv or add it to PATH.")
        print("WARNING: mpv not found. Install mpv or add it to PATH.")
        print("  Linux:   sudo apt install mpv / sudo pacman -S mpv")
        print("  macOS:   brew install mpv")
        print("  Windows: scoop install mpv / choco install mpv")

    server = HTTPServer(("127.0.0.1", PORT), MpvHandler)
    print(f"MPV handler running on http://127.0.0.1:{PORT}")
    print(f"Log file: {LOG_PATH}")
    print("Press Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped")
