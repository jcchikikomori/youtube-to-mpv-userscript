#!/usr/bin/env python3
"""Local server to open YouTube/Twitch videos in mpv."""

import atexit
import json
import logging
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = 38421
TIMESTAMP_RE = re.compile(r"^\d+(\.\d+)?$")
LOG_PATH = os.path.join(tempfile.gettempdir(), "mpv-handler.log")

# POST /play body limits — enforced before self.rfile.read(), so a lying/huge Content-Length
# can't be used to exhaust memory.
MAX_BODY_BYTES = 2 * 1024 * 1024  # 2 MiB
MAX_COOKIES = 200
MAX_COOKIE_FIELD_LEN = 4096
# A tab or newline in any cookie field would corrupt the tab-separated Netscape file below —
# real browser cookies can't contain these per RFC 6265, but it's checked here too rather than
# trusting that invariant to hold all the way from the browser.
COOKIE_FORBIDDEN_CHARS = ("\t", "\n")
RECOGNIZED_COOKIE_KEYS = {"domain", "name", "value", "path", "secure", "httpOnly", "expirationDate"}

# Cookies are never persisted — each /play request that carries any writes exactly one
# Netscape-format file here for yt-dlp to read, and it's deleted right after mpv exits (see
# _cleanup_cookie_file_after_exit). This directory only ever holds those transient files, which
# is what makes the startup/atexit sweep below safe.
COOKIE_TMP_DIR = os.path.join(tempfile.gettempdir(), "mpv-handler-cookies")
NETSCAPE_COOKIE_HEADER = "# Netscape HTTP Cookie File\n"

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


def _validate_cookie_string_field(value, field_name, required):
    """Returns the validated string (or None if absent/optional). Raises ValueError — never
    including the actual value, only the field name — on any problem."""
    if value is None:
        if required:
            raise ValueError(f"cookie {field_name} is required")
        return None
    if not isinstance(value, str):
        raise ValueError(f"cookie {field_name} must be a string")
    if len(value) > MAX_COOKIE_FIELD_LEN:
        raise ValueError(f"cookie {field_name} exceeds {MAX_COOKIE_FIELD_LEN} characters")
    if any(char in value for char in COOKIE_FORBIDDEN_CHARS):
        raise ValueError(f"cookie {field_name} contains a forbidden control character")
    if required and not value:
        raise ValueError(f"cookie {field_name} must not be empty")
    return value


def validate_cookies_payload(raw):
    """Validates the `cookies` field of a POST /play body. Returns a list of cleaned cookie
    dicts (only the recognized keys, coerced types) or None for absent/empty input. Raises
    ValueError — never including actual cookie values — on any problem."""
    if raw is None:
        return None
    if not isinstance(raw, list):
        raise ValueError("cookies must be a list")
    if len(raw) > MAX_COOKIES:
        raise ValueError(f"cookies exceeds the maximum of {MAX_COOKIES} entries")

    cleaned = []
    for entry in raw:
        if not isinstance(entry, dict):
            raise ValueError("cookie entry must be an object")
        unexpected = set(entry.keys()) - RECOGNIZED_COOKIE_KEYS
        if unexpected:
            raise ValueError("unexpected cookie field(s)")

        domain = _validate_cookie_string_field(entry.get("domain"), "domain", True)
        name = _validate_cookie_string_field(entry.get("name"), "name", True)
        value = _validate_cookie_string_field(entry.get("value"), "value", False) or ""
        path = _validate_cookie_string_field(entry.get("path"), "path", False)

        secure = entry.get("secure")
        if secure is not None and not isinstance(secure, bool):
            raise ValueError("cookie secure must be a boolean")

        http_only = entry.get("httpOnly")
        if http_only is not None and not isinstance(http_only, bool):
            raise ValueError("cookie httpOnly must be a boolean")

        expiration_date = entry.get("expirationDate")
        if expiration_date is not None and not isinstance(expiration_date, (int, float)):
            raise ValueError("cookie expirationDate must be a number or null")

        cleaned.append(
            {
                "domain": domain,
                "name": name,
                "value": value,
                "path": path or "/",
                "secure": bool(secure),
                "httpOnly": bool(http_only),
                "expirationDate": expiration_date,
            }
        )

    return cleaned or None


def parse_play_request_body(raw_bytes):
    """Parses and structurally validates a POST /play body. Returns {"url", "t", "cookies"}.
    Raises ValueError — never including the raw body — on any problem."""
    try:
        text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError("body is not valid UTF-8") from error

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as error:
        raise ValueError("body is not valid JSON") from error

    if not isinstance(parsed, dict):
        raise ValueError("body must be a JSON object")

    unexpected = set(parsed.keys()) - {"url", "t", "cookies"}
    if unexpected:
        raise ValueError("unexpected field(s) in body")

    url = parsed.get("url")
    if not isinstance(url, str) or not url:
        raise ValueError("url is required and must be a non-empty string")

    raw_timestamp = parsed.get("t")
    if raw_timestamp is not None and not isinstance(raw_timestamp, str):
        raise ValueError("t must be a string")

    cookies = validate_cookies_payload(parsed.get("cookies"))

    return {"url": url, "t": raw_timestamp, "cookies": cookies}


def build_netscape_cookie_file(cookies):
    """Builds Netscape-cookie-file-format content from an already-validated cookie list (see
    validate_cookies_payload) — the only format yt-dlp's --cookies flag accepts."""
    lines = [NETSCAPE_COOKIE_HEADER]
    for cookie in cookies:
        domain = cookie["domain"]
        include_subdomains = "TRUE" if domain.startswith(".") else "FALSE"
        secure = "TRUE" if cookie["secure"] else "FALSE"
        expiration = cookie["expirationDate"]
        expiry = str(int(expiration)) if expiration else "0"
        lines.append(
            "\t".join([domain, include_subdomains, cookie["path"], secure, expiry, cookie["name"], cookie["value"]])
        )
    return "\n".join(lines) + "\n"


def _init_cookie_tmp_dir():
    os.makedirs(COOKIE_TMP_DIR, exist_ok=True)
    os.chmod(COOKIE_TMP_DIR, 0o700)
    _sweep_cookie_tmp_dir()


def _sweep_cookie_tmp_dir():
    """Deletes any leftover cookie temp files. Safety net for a crash/kill — the reaper thread
    that normally deletes a file after mpv exits dies abruptly on interpreter exit, so this
    (run at startup and via atexit) is what keeps the directory's steady-state content empty.
    Safe because this directory only ever holds these transient files."""
    try:
        for name in os.listdir(COOKIE_TMP_DIR):
            try:
                os.remove(os.path.join(COOKIE_TMP_DIR, name))
            except OSError:
                pass
    except OSError:
        pass


def _write_cookie_file(cookies):
    """Writes a short-lived Netscape cookie file for one request. Caller is responsible for
    deleting it once mpv/yt-dlp is done reading it."""
    content = build_netscape_cookie_file(cookies)
    handle = tempfile.NamedTemporaryFile(
        mode="w",
        delete=False,
        dir=COOKIE_TMP_DIR,
        prefix="mpv-handler-cookies-",
        suffix=".txt",
        encoding="utf-8",
    )
    path = handle.name
    try:
        handle.write(content)
    finally:
        handle.close()
    # NamedTemporaryFile already creates non-world-readable on POSIX — explicit chmod is
    # defense-in-depth (and required for a consistent mode across platforms).
    os.chmod(path, 0o600)
    return path


def _cleanup_cookie_file_after_exit(proc, cookie_file_path):
    """Runs in a daemon thread so the HTTP response isn't held open waiting for mpv to exit."""
    try:
        proc.wait()
    finally:
        try:
            os.remove(cookie_file_path)
        except OSError:
            pass


class MpvHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/play" and "url" in params:
            url = params["url"][0]
            raw_timestamp = params.get("t", [None])[0]
            logger.info("Play request: %s", url)
            self._launch_mpv(url, raw_timestamp, None)
        elif parsed.path == "/health":
            self._send_json(200, {"status": "running"})
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/play":
            self.send_response(404)
            self.end_headers()
            return

        content_length_header = self.headers.get("Content-Length")
        if content_length_header is None or not content_length_header.isdigit():
            # Also covers a chunked-transfer request with no Content-Length — this stdlib
            # server doesn't decode chunked bodies, so treat it as a malformed request rather
            # than silently reading an empty one.
            self._send_error(400, "Content-Length header is required")
            return

        content_length = int(content_length_header)
        if content_length > MAX_BODY_BYTES:
            self._send_error(413, "request body too large")
            return

        raw_body = self.rfile.read(content_length)
        try:
            request = parse_play_request_body(raw_body)
        except ValueError as error:
            # Never log raw_body itself — only the ValueError's own field-name-only message.
            logger.warning("Rejected malformed /play request: %s", error)
            self._send_error(400, str(error))
            return

        cookies = request["cookies"]
        logger.info("Play request received (cookies=%d)", len(cookies) if cookies else 0)

        cookie_file_path = None
        if cookies:
            try:
                cookie_file_path = _write_cookie_file(cookies)
            except OSError:
                logger.exception("Failed to write cookie file")
                self._send_error(500, "failed to prepare cookies")
                return

        logger.info("Play request: %s", request["url"])
        self._launch_mpv(request["url"], request["t"], cookie_file_path)

    def _launch_mpv(self, url, raw_timestamp, cookie_file_path):
        mpv_args = [url]
        if raw_timestamp:
            if TIMESTAMP_RE.match(raw_timestamp):
                mpv_args.append(f"--start={raw_timestamp}")
            else:
                logger.warning("Ignoring invalid timestamp: %s", raw_timestamp)

        if cookie_file_path:
            mpv_args.append(f"--ytdl-raw-options=cookies={cookie_file_path}")

        if not MPV_PATH:
            logger.error("mpv binary not found, cannot launch")
            self._delete_cookie_file_now(cookie_file_path)
            self._send_error(500, "mpv not found")
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
            self._delete_cookie_file_now(cookie_file_path)
            self._send_error(500, "Failed to launch mpv")
            return

        if cookie_file_path:
            threading.Thread(
                target=_cleanup_cookie_file_after_exit,
                args=(proc, cookie_file_path),
                daemon=True,
            ).start()

        self._send_json(200, {"status": "ok"})

    @staticmethod
    def _delete_cookie_file_now(cookie_file_path):
        """Used only on a path where mpv never launched — no process to wait() on."""
        if not cookie_file_path:
            return
        try:
            os.remove(cookie_file_path)
        except OSError:
            pass

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, status, message):
        self._send_json(status, {"status": "error", "message": message})

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

    _init_cookie_tmp_dir()
    atexit.register(_sweep_cookie_tmp_dir)

    server = HTTPServer(("127.0.0.1", PORT), MpvHandler)
    print(f"MPV handler running on http://127.0.0.1:{PORT}")
    print(f"Log file: {LOG_PATH}")
    print("Press Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped")
