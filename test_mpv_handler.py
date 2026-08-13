"""Tests for mpv-handler.py. Run with: python3 -m unittest test_mpv_handler

Loaded via importlib (the module's filename has a hyphen, so it can't be a normal import
target) — this only executes the module body, never the `if __name__ == "__main__":` block,
so no real server/atexit hook starts as a side effect of importing it.
"""

import http.client
import importlib.util
import json
import os
import shutil
import sys
import tempfile
import threading
import time
import unittest
from http.server import HTTPServer

_MODULE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mpv-handler.py")
_spec = importlib.util.spec_from_file_location("mpv_handler_under_test", _MODULE_PATH)
mpv_handler = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mpv_handler)


VALID_COOKIE = {"domain": ".twitch.tv", "name": "auth-token", "value": "secretvalue"}


class BuildNetscapeCookieFileTest(unittest.TestCase):
    def test_starts_with_netscape_header(self):
        content = mpv_handler.build_netscape_cookie_file(
            [{**VALID_COOKIE, "path": "/", "secure": False, "expirationDate": None}]
        )
        self.assertTrue(content.startswith("# Netscape HTTP Cookie File\n"))

    def test_session_cookie_has_zero_expiry(self):
        content = mpv_handler.build_netscape_cookie_file(
            [{**VALID_COOKIE, "domain": "www.twitch.tv", "path": "/", "secure": False, "expirationDate": None}]
        )
        self.assertIn("\nwww.twitch.tv\tFALSE\t/\tFALSE\t0\tauth-token\tsecretvalue\n", content)

    def test_persistent_cookie_has_expiry(self):
        content = mpv_handler.build_netscape_cookie_file(
            [{**VALID_COOKIE, "path": "/", "secure": False, "expirationDate": 1750000000}]
        )
        self.assertIn("\t1750000000\t", content)

    def test_subdomain_cookie_marked_true(self):
        content = mpv_handler.build_netscape_cookie_file(
            [{**VALID_COOKIE, "domain": ".twitch.tv", "path": "/", "secure": False, "expirationDate": None}]
        )
        self.assertIn(".twitch.tv\tTRUE\t", content)

    def test_exact_domain_marked_false(self):
        content = mpv_handler.build_netscape_cookie_file(
            [{**VALID_COOKIE, "domain": "www.twitch.tv", "path": "/", "secure": False, "expirationDate": None}]
        )
        self.assertIn("www.twitch.tv\tFALSE\t", content)

    def test_secure_cookie_marked_true(self):
        content = mpv_handler.build_netscape_cookie_file(
            [{**VALID_COOKIE, "path": "/", "secure": True, "expirationDate": None}]
        )
        self.assertIn("\tTRUE\t0\t", content)


class ValidateCookiesPayloadTest(unittest.TestCase):
    def test_none_and_empty_list_return_none(self):
        self.assertIsNone(mpv_handler.validate_cookies_payload(None))
        self.assertIsNone(mpv_handler.validate_cookies_payload([]))

    def test_valid_minimal_cookie(self):
        result = mpv_handler.validate_cookies_payload([VALID_COOKIE])
        self.assertEqual(result[0]["domain"], VALID_COOKIE["domain"])
        self.assertEqual(result[0]["name"], VALID_COOKIE["name"])
        self.assertEqual(result[0]["value"], VALID_COOKIE["value"])
        self.assertEqual(result[0]["path"], "/")
        self.assertFalse(result[0]["secure"])
        self.assertFalse(result[0]["httpOnly"])
        self.assertIsNone(result[0]["expirationDate"])

    def test_rejects_non_list(self):
        with self.assertRaises(ValueError):
            mpv_handler.validate_cookies_payload("not a list")

    def test_rejects_more_than_max_cookies(self):
        with self.assertRaises(ValueError):
            mpv_handler.validate_cookies_payload([VALID_COOKIE] * (mpv_handler.MAX_COOKIES + 1))

    def test_accepts_exactly_max_cookies(self):
        result = mpv_handler.validate_cookies_payload([VALID_COOKIE] * mpv_handler.MAX_COOKIES)
        self.assertEqual(len(result), mpv_handler.MAX_COOKIES)

    def test_rejects_non_dict_entry(self):
        with self.assertRaises(ValueError):
            mpv_handler.validate_cookies_payload(["not an object"])

    def test_rejects_unexpected_field(self):
        with self.assertRaises(ValueError):
            mpv_handler.validate_cookies_payload([{**VALID_COOKIE, "sameSite": "lax"}])

    def test_rejects_missing_required_field(self):
        cookie = dict(VALID_COOKIE)
        del cookie["domain"]
        with self.assertRaises(ValueError):
            mpv_handler.validate_cookies_payload([cookie])

    def test_rejects_empty_required_field(self):
        with self.assertRaises(ValueError):
            mpv_handler.validate_cookies_payload([{**VALID_COOKIE, "name": ""}])

    def test_rejects_non_string_field(self):
        with self.assertRaises(ValueError):
            mpv_handler.validate_cookies_payload([{**VALID_COOKIE, "domain": 123}])

    def test_rejects_field_exceeding_max_length(self):
        with self.assertRaises(ValueError):
            mpv_handler.validate_cookies_payload(
                [{**VALID_COOKIE, "value": "x" * (mpv_handler.MAX_COOKIE_FIELD_LEN + 1)}]
            )

    def test_rejects_tab_in_field(self):
        with self.assertRaises(ValueError):
            mpv_handler.validate_cookies_payload([{**VALID_COOKIE, "value": "bad\tvalue"}])

    def test_rejects_newline_in_field(self):
        with self.assertRaises(ValueError):
            mpv_handler.validate_cookies_payload([{**VALID_COOKIE, "value": "bad\nvalue"}])

    def test_rejects_non_bool_secure(self):
        with self.assertRaises(ValueError):
            mpv_handler.validate_cookies_payload([{**VALID_COOKIE, "secure": "yes"}])

    def test_rejects_non_bool_http_only(self):
        with self.assertRaises(ValueError):
            mpv_handler.validate_cookies_payload([{**VALID_COOKIE, "httpOnly": 1}])

    def test_accepts_null_expiration_date(self):
        result = mpv_handler.validate_cookies_payload([{**VALID_COOKIE, "expirationDate": None}])
        self.assertIsNone(result[0]["expirationDate"])

    def test_rejects_non_numeric_expiration_date(self):
        with self.assertRaises(ValueError):
            mpv_handler.validate_cookies_payload([{**VALID_COOKIE, "expirationDate": "never"}])

    def test_no_cookie_value_leaks_into_error_message(self):
        secret = "super-secret-session-value"
        try:
            mpv_handler.validate_cookies_payload([{**VALID_COOKIE, "value": f"bad\t{secret}"}])
            self.fail("expected ValueError")
        except ValueError as error:
            self.assertNotIn(secret, str(error))


class ParsePlayRequestBodyTest(unittest.TestCase):
    def test_valid_minimal_body(self):
        result = mpv_handler.parse_play_request_body(json.dumps({"url": "https://example.com"}).encode())
        self.assertEqual(result, {"url": "https://example.com", "t": None, "cookies": None})

    def test_valid_full_body(self):
        body = {"url": "https://example.com", "t": "12.5", "cookies": [VALID_COOKIE]}
        result = mpv_handler.parse_play_request_body(json.dumps(body).encode())
        self.assertEqual(result["url"], "https://example.com")
        self.assertEqual(result["t"], "12.5")
        self.assertEqual(result["cookies"][0]["name"], VALID_COOKIE["name"])

    def test_rejects_invalid_json(self):
        with self.assertRaises(ValueError):
            mpv_handler.parse_play_request_body(b"not json")

    def test_rejects_non_object_body(self):
        with self.assertRaises(ValueError):
            mpv_handler.parse_play_request_body(b"[]")

    def test_rejects_unexpected_top_level_field(self):
        body = json.dumps({"url": "https://example.com", "extra": True}).encode()
        with self.assertRaises(ValueError):
            mpv_handler.parse_play_request_body(body)

    def test_rejects_missing_url(self):
        with self.assertRaises(ValueError):
            mpv_handler.parse_play_request_body(json.dumps({}).encode())

    def test_rejects_empty_url(self):
        with self.assertRaises(ValueError):
            mpv_handler.parse_play_request_body(json.dumps({"url": ""}).encode())

    def test_rejects_non_string_t(self):
        with self.assertRaises(ValueError):
            mpv_handler.parse_play_request_body(json.dumps({"url": "https://example.com", "t": 5}).encode())

    def test_propagates_cookie_validation_error(self):
        body = {"url": "https://example.com", "cookies": [{"name": "x"}]}
        with self.assertRaises(ValueError):
            mpv_handler.parse_play_request_body(json.dumps(body).encode())


class MpvHandlerServerTest(unittest.TestCase):
    """End-to-end HTTP tests against a real server instance (MPV_PATH stubbed to the current
    Python interpreter, which spawns and exits near-instantly regardless of exit code — enough
    to exercise the real Popen + reaper-thread cleanup path without depending on mpv/yt-dlp
    being installed)."""

    @classmethod
    def setUpClass(cls):
        cls._original_mpv_path = mpv_handler.MPV_PATH
        cls._original_cookie_dir = mpv_handler.COOKIE_TMP_DIR
        mpv_handler.MPV_PATH = sys.executable
        mpv_handler.COOKIE_TMP_DIR = tempfile.mkdtemp(prefix="mpv-handler-cookies-test-")
        mpv_handler._init_cookie_tmp_dir()

        cls.server = HTTPServer(("127.0.0.1", 0), mpv_handler.MpvHandler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        mpv_handler.MPV_PATH = cls._original_mpv_path
        shutil.rmtree(mpv_handler.COOKIE_TMP_DIR, ignore_errors=True)
        mpv_handler.COOKIE_TMP_DIR = cls._original_cookie_dir

    def _connection(self):
        return http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)

    def _cookie_dir_contents(self):
        return os.listdir(mpv_handler.COOKIE_TMP_DIR)

    def test_get_play_still_works_without_a_body(self):
        conn = self._connection()
        conn.request("GET", "/play?url=https%3A%2F%2Fexample.com")
        response = conn.getresponse()
        body = json.loads(response.read())
        conn.close()

        self.assertEqual(response.status, 200)
        self.assertEqual(body["status"], "ok")

    def test_get_health(self):
        conn = self._connection()
        conn.request("GET", "/health")
        response = conn.getresponse()
        body = json.loads(response.read())
        conn.close()

        self.assertEqual(response.status, 200)
        self.assertEqual(body, {"status": "running"})

    def test_post_play_without_cookies(self):
        conn = self._connection()
        payload = json.dumps({"url": "https://example.com"}).encode()
        conn.request("POST", "/play", body=payload, headers={"Content-Type": "application/json"})
        response = conn.getresponse()
        body = json.loads(response.read())
        conn.close()

        self.assertEqual(response.status, 200)
        self.assertEqual(body["status"], "ok")

    def test_post_play_with_cookies_writes_and_cleans_up_the_temp_file(self):
        conn = self._connection()
        payload = json.dumps({"url": "https://example.com", "cookies": [VALID_COOKIE]}).encode()
        conn.request("POST", "/play", body=payload, headers={"Content-Type": "application/json"})
        response = conn.getresponse()
        body = json.loads(response.read())
        conn.close()

        self.assertEqual(response.status, 200)
        self.assertEqual(body["status"], "ok")

        deadline = time.time() + 5
        while time.time() < deadline and self._cookie_dir_contents():
            time.sleep(0.05)
        self.assertEqual(self._cookie_dir_contents(), [], "cookie temp file was not cleaned up after mpv exited")

    def test_post_play_rejects_missing_content_length(self):
        # http.client's own request()/getresponse() helpers auto-add "Content-Length: 0" for a
        # bodyless POST, which would mask this exact code path (it'd hit the empty-body/invalid
        # JSON branch instead) — so this drops to the low-level API to genuinely omit it, the
        # same way a hand-rolled chunked-transfer POST would.
        conn = self._connection()
        conn.putrequest("POST", "/play", skip_host=True, skip_accept_encoding=True)
        conn.putheader("Host", "127.0.0.1")
        conn.endheaders()
        response = conn.getresponse()
        body = json.loads(response.read())
        conn.close()

        self.assertEqual(response.status, 400)
        self.assertEqual(body["message"], "Content-Length header is required")

    def test_post_play_rejects_non_numeric_content_length(self):
        conn = self._connection()
        conn.request("POST", "/play", body=b"{}", headers={"Content-Length": "not-a-number"})
        response = conn.getresponse()
        body = json.loads(response.read())
        conn.close()

        self.assertEqual(response.status, 400)
        self.assertEqual(body["message"], "Content-Length header is required")

    def test_post_play_rejects_oversized_body(self):
        # The size check reads only the Content-Length header, before any body bytes are read
        # — so a lying header is enough to trigger it without actually sending 2MiB+ over the
        # wire (and avoids a broken-pipe race against the server's early 413 response).
        conn = self._connection()
        conn.request(
            "POST",
            "/play",
            body=b"{}",
            headers={"Content-Length": str(mpv_handler.MAX_BODY_BYTES + 1)},
        )
        response = conn.getresponse()
        body = json.loads(response.read())
        conn.close()

        self.assertEqual(response.status, 413)
        self.assertEqual(body["message"], "request body too large")

    def test_post_play_rejects_malformed_json(self):
        conn = self._connection()
        conn.request("POST", "/play", body=b"not json", headers={"Content-Type": "application/json"})
        response = conn.getresponse()
        body = json.loads(response.read())
        conn.close()

        self.assertEqual(response.status, 400)
        self.assertEqual(body["status"], "error")

    def test_post_play_rejects_cookie_line_injection_attempt(self):
        conn = self._connection()
        payload = json.dumps(
            {"url": "https://example.com", "cookies": [{**VALID_COOKIE, "value": "bad\tvalue"}]}
        ).encode()
        conn.request("POST", "/play", body=payload, headers={"Content-Type": "application/json"})
        response = conn.getresponse()
        body = json.loads(response.read())
        conn.close()

        self.assertEqual(response.status, 400)
        self.assertEqual(body["status"], "error")

    def test_post_play_unknown_path_is_404(self):
        conn = self._connection()
        conn.request("POST", "/nope", body=b"{}")
        response = conn.getresponse()
        conn.close()

        self.assertEqual(response.status, 404)


if __name__ == "__main__":
    unittest.main()
