# Stream to MPV Userscript

## Project Overview

A Tampermonkey/Greasemonkey userscript that adds an icon to YouTube's and Twitch's player
control bars to open videos/streams in MPV media player via a local handler. One unified
`@match`es-both-hosts bundle — `main.ts` branches on `location.hostname` at startup, not two
separate scripts (see Architecture below).

**Primary target platforms**: Linux, macOS, Windows

## Tech Stack

- **Language**: TypeScript, bundled by tsup into a single dependency-free ES6+ file for
  Tampermonkey (source lives in `userscript/src/userscript/`; see Architecture below)
- **Runtime**: Tampermonkey / Greasemonkey userscript context
- **APIs**: YouTube DOM manipulation, `GM_*` privileged APIs, Clipboard API
- **Player**: MPV (external, system-installed)
- **Handler**: Python HTTP server on localhost:38421
- **YouTube extraction**: `yt-dlp`/`youtube-dl` (mpv's `ytdl_hook` shells out to one of these; pinned via `pyproject.toml` + `uv`, not imported by the handler)

## Architecture

```
userscript/                        ← TypeScript source + build (Node, dev-only)
├── src/baseline/                    MpvHandlerClient — HTTP transport, knows nothing about
│                                    platforms or the DOM
├── src/contracts/                   VideoSource interface + AbstractVideoSource template method
├── src/platforms/youtube/           YouTube URL/id validation + timestamp parsing
├── src/platforms/twitch/            Twitch channel/VOD validation + timestamp parsing
├── src/userscript/                  the actual browser entry point — one bundle, both sites:
│   ├── main.ts                        branches on location.hostname, wires up the matching
│   │                                   platform source + DOM module
│   ├── dom.ts                         YouTube: button, native menu injection, SPA nav
│   ├── domTwitch.ts                   Twitch: button + SPA nav only — no menu injection (see
│   │                                   "Twitch DOM Handling" below for why there's nothing to
│   │                                   inject into)
│   ├── twitchCookies.ts               GM_cookie.list(), hardcoded to the twitch.tv domain only
│   ├── icons.ts                       shared SVG icon markup (both DOM modules)
│   └── gmFetch.ts                     GM_xmlhttpRequest transport adapter, clipboard fallback
└── dist/youtube-to-mpv.user.js      ← build output — THE distributed userscript, generated
                                       by `npm run build` (tsup), never hand-edited

mpv-handler.py                     ← Local server (system, all platforms)
├── HTTP server on 127.0.0.1:38421
├── Auto-detects mpv binary (shutil.which + platform-specific paths)
├── GET /play?url=URL&t=SECONDS — legacy, no-cookies path (manual curl testing)
├── POST /play {url, t, cookies} — primary path; cookies (if any) become a short-lived
│   Netscape-format temp file for yt-dlp, deleted right after mpv exits (never persisted)
├── Launches mpv with the URL
└── Health check endpoint

Startup scripts (OS-specific):
├── start-handler.sh / stop-handler.sh       ← Linux/macOS
├── start-handler.ps1 / stop-handler.ps1     ← Windows
└── mpv-handler.service                      ← Systemd (Linux only)

pyproject.toml                     ← uv-managed pin for yt-dlp/youtube-dl (mpv's deps, not the handler's)
```

`dist/youtube-to-mpv.user.js` is the single dependency-free file Tampermonkey installs — that
constraint didn't go away, it just moved from "hand-write one file" to "let tsup bundle one
file." `mpv-handler.py` remains hand-written stdlib-only Python; only the userscript side gained
a build step. See `userscript/README.md` for the full package layout and build/test commands.

## Development Guidelines

### Code Style

- **TypeScript source, bundled output** — write TS under `userscript/src/userscript/`; `npm run
  build` (tsup) compiles it down to plain ES6+ for Tampermonkey's sandbox
- **No ES modules in the shipped artifact** — the *source* uses standard ESM `import`/`export`
  (matching the rest of `userscript/`); the bundler flattens it into one dependency-free IIFE,
  since Tampermonkey itself still can't load multiple files or npm packages at runtime
- **Use `GM_*` APIs** for storage and privileged operations
- **Strict equality** (`===`), `const`/`let` only, no `var`
- **Semicolons required**
- **2-space indentation**
- **Descriptive variable names** — no single-letter except loop counters
- **Error handling**: Always propagate errors upward; never swallow them silently. Use `try/catch` blocks around DOM operations and clipboard calls. Return generic error messages to users; log full details via `console.error`.
- **Async patterns**: Prefer `async/await` over raw Promise chains. Never mix callbacks and Promises.

### YouTube DOM Handling

- YouTube's DOM is **dynamic** (SPA navigation). Use `MutationObserver` to detect page changes.
- Video URLs can be extracted from:
  - `ytInitialPlayerResponse` (embedded in page script)
  - URL query parameters (`?v=VIDEO_ID`)
  - `<meta itemprop="videoId">` tag
- **Prefer URL parameters** — most reliable, least likely to break.
- Player control bar: `.ytp-right-controls` — inject button here for auto-hide behavior.

### Twitch DOM Handling

- Twitch's DOM is **dynamic** (SPA navigation), same as YouTube — `MutationObserver` + `popstate`.
- Channel/VOD identity always comes from the current page URL (`extractTwitchChannel`/
  `extractTwitchVodId` in `platforms/twitch/validation.ts`) — Twitch exposes no
  `ytInitialPlayerResponse`-equivalent global to read from.
- Player control bar: `.player-controls__right-control-group` (confirmed live against a real
  Twitch channel page) — same auto-hide-on-idle behavior as YouTube's `.ytp-right-controls`,
  inject the button as a child of it the same way. Twitch's OWN control buttons use
  webpack/styled-components-generated class names (e.g. `ScCoreButton-sc-ocjdkq-0 eBQIRH`) that
  change between deploys — never style off those; the injected button uses inline styles only.
- **No custom in-page context menu.** Confirmed by dispatching a real `contextmenu` event at the
  player and checking `event.defaultPrevented` — it's `false`, meaning Twitch never calls
  `preventDefault()` and just shows the browser's own native menu. A userscript cannot add items
  to a native browser context menu (that requires a browser extension's `contextMenus` API,
  which Tampermonkey userscripts don't have). So there is **no Twitch equivalent** of
  `.ytp-contextmenu` — don't try to build one.
- **No per-card "⋮" options menu** on stream preview cards (directory/category pages) either —
  checked their DOM structure directly; there's no options button to hook into, so there's no
  Twitch equivalent of YouTube's row-kebab injection either.
- Net effect: Twitch integration is button + `Ctrl+Shift+M` only. Don't add "right-click the
  Twitch player" or "kebab menu on a stream card" work items — they're not buildable, not
  deferred.

### MPV Launch Strategy

The script communicates with a local Python handler via HTTP:

1. **Primary**: `GM_xmlhttpRequest` POSTs a JSON body (`{url, t, cookies}`) to
   `http://127.0.0.1:38421/play` — never a GET query string, since a `cookies` payload must
   never end up somewhere it'd be logged (a request line, shell history, a proxy's access log).
   `cookies` is optional and omitted entirely for anonymous playback. A legacy `GET
   /play?url=VIDEO_URL&t=SECONDS` (no cookies) still works on the handler side, for manual
   `curl` testing — the shipped userscript itself always POSTs.
2. **Fallback**: Copies `mpv <url>` to clipboard if handler is offline

The handler approach is preferred because:

- Auto-launches mpv without user intervention
- Auto-detects mpv binary using `shutil.which()`
- Works across all browsers (Chrome, Firefox, Brave)
- No clipboard permission issues

The clipboard fallback ensures the script still works if the handler isn't running.

**Cookies (authenticated/subscriber-only playback)**: forwarded live, per request, from the
browser via `GM_cookie.list()` (`userscript/src/userscript/twitchCookies.ts`, wired into the
Twitch path only — YouTube never fetches or sends cookies today) — never stored in a standing
directory on disk. **Domain-scoped per platform, deliberately never combined**:
`twitchCookies.ts` hardcodes `GM_cookie.list({ domain: 'twitch.tv' })` rather than accepting a
domain parameter, specifically so a future YouTube cookie feature can't accidentally reuse that
call and blur the two platforms' cookie sets together — if you add cookie support for another
platform, write it its own equivalent file, don't parametrize this one.
`mpv-handler.py` writes the `cookies` payload (if any) to a short-lived Netscape-format temp
file under `<tempdir>/mpv-handler-cookies/`, passes it to yt-dlp via
`--ytdl-raw-options=cookies=<path>`, and deletes it as soon as mpv exits (a background thread
`wait()`s on the process; a startup + `atexit` sweep of that directory is the safety net for a
crash/kill, since a killed daemon thread never runs its cleanup). `mpv-handler.py` isn't
auto-updated the way the userscript is (no `@updateURL` equivalent) — pull the latest version
locally to get cookie/Twitch support.

### Platform Detection

```javascript
const PLATFORM = navigator.platform.toLowerCase();
const IS_LINUX = PLATFORM.includes('linux');
const IS_MAC = PLATFORM.includes('mac');
const IS_WINDOWS = PLATFORM.includes('win');
```

Always degrade gracefully if platform is unknown.

### User Configuration

Expose these as `@grant` GM_* values with defaults:

| Setting | Default | Description |
| --------- | --------- | ------------- |
| `mpvPath` | `mpv` | Path to MPV binary (auto-detected by handler) |
| `showButton` | `true` | Show icon in player controls (YouTube and Twitch) |
| `autoPlaylist` | `false` | (Reserved for future use) |
| `enableNativeMenuItems` | `true` | Show "Open in MPV" in the player right-click menu and row kebab ("⋮") menus — **YouTube only**, Twitch has no equivalent menus to inject into |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+M` | Open in MPV at current time |

## Common Patterns

### Injecting UI into YouTube

```javascript
function injectButton() {
  const controlBar = document.querySelector('.ytp-right-controls');
  if (!controlBar || document.getElementById('mpv-open-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'mpv-open-btn';
  btn.className = 'ytp-button';
  btn.innerHTML = `<svg>...</svg>`;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openInMpv();
  });

  controlBar.prepend(btn);
}
```

### Injecting into YouTube's native menus

Right-clicking the player and clicking a row's "⋮" kebab both open YouTube's
**own** DOM popups (not the browser's native context menu), so items can be
appended to them. Both popups are reused/toggled rather than recreated per
open, so guard with a `data-mpv-injected`-style marker and feature-detect via
visible item text rather than assuming a fixed child count. YouTube currently
ships two different component systems for the kebab popup depending on
page/experiment (legacy `ytd-menu-popup-renderer` vs newer
`yt-list-view-model`) — match on both.

```javascript
function maybeInjectContextMenuItems() {
  const panel = document.querySelector('.ytp-contextmenu .ytp-panel-menu');
  if (!panel || panel.dataset.mpvInjected) return;
  if (!/copy video url/i.test(panel.textContent)) return; // not the video's menu (e.g. an ad)

  panel.dataset.mpvInjected = 'true';
  panel.appendChild(buildContextMenuItem('Open in MPV', () => openInMpv()));

  // YouTube sizes the panel's height once, at open time — items appended
  // afterwards need the height re-applied or they overflow into a scrollbar.
  growContextMenuToFit(panel);
}
```

### Extracting Video ID

```javascript
function getVideoId() {
  const urlMatch = window.location.search.match(/[?&]v=([^&]+)/);
  if (urlMatch && /^[a-zA-Z0-9_-]{11}$/.test(urlMatch[1])) {
    return urlMatch[1];
  }

  if (window.ytInitialPlayerResponse) {
    const videoId = window.ytInitialPlayerResponse.videoDetails?.videoId;
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return videoId;
    }
  }

  return null;
}
```

### SPA Navigation Detection

```javascript
let lastUrl = '';

function handleUrlChange() {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    removeButton();

    if (window.location.pathname.startsWith('/watch')) {
      setTimeout(injectButton, 500);
    }
  }
}

const observer = new MutationObserver(handleUrlChange);
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('popstate', handleUrlChange);
```

### Toast Notification (Dark Mode Aware)

```javascript
function showToast(message, type) {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isError = type === 'error';

  const bgColor = isError ? '#e74c3c' : isDark ? '#333' : '#fff';
  const textColor = isError ? '#fff' : isDark ? '#fff' : '#333';

  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${bgColor};
    color: ${textColor};
    border-radius: 8px;
    z-index: 99999;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}
```

### Handler Auto-Detection

```python
import shutil
import platform
import os

def find_mpv():
    mpv = shutil.which("mpv") or shutil.which("mpv.exe")
    if mpv:
        return mpv

    system = platform.system()
    if system == "Windows":
        candidates = [
            os.path.expandvars(r"%LOCALAPPDATA%\mpv\mpv.exe"),
            r"C:\Program Files\mpv\mpv.exe",
            os.path.expanduser(r"~\scoop\apps\mpv\current\mpv.exe"),
            r"C:\ProgramData\chocolatey\bin\mpv.exe",
        ]
    elif system == "Darwin":
        candidates = ["/opt/homebrew/bin/mpv", "/usr/local/bin/mpv"]
    else:
        candidates = [os.path.expanduser("~/.local/bin/mpv"), "/usr/bin/mpv"]

    for path in candidates:
        if os.path.isfile(path):
            return path
    return None
```

## Security (OWASP Principles)

This userscript runs in a privileged context with access to `GM_*` APIs. Apply these principles:

### Input Validation

- **Never trust YouTube's or Twitch's DOM** — validate extracted video IDs against
  `/^[a-zA-Z0-9_-]{11}$/` (YouTube) before use. Twitch channel names validate against
  `/^[a-zA-Z0-9_]{4,25}$/` **plus a reserved-path denylist** (`settings`, `videos`, `directory`,
  etc.) so `twitch.tv/settings` is never misread as a channel — see
  `platforms/twitch/validation.ts`. Twitch VOD ids are only ever recognized from the full
  `/videos/<id>` URL form, never a bare numeric string — a bare all-digit string is ambiguous
  with an all-digit channel name (Twitch allows those), so accepting it would break the
  `supports()`/`resolveUrl()` non-disagreement invariant every platform module must satisfy.
- Sanitize any user-configured values (MPV path) before passing to command construction.
- Validate URLs before opening — only allow `https://youtube.com/watch?v=...` and
  `https://twitch.tv/<channel>` / `https://twitch.tv/videos/<id>` patterns.
- **The handler's base URL is checked against a literal loopback-hostname allowlist** (`userscript/src/baseline/loopback.ts`), never resolved via DNS (a resolve-then-check would open a DNS-rebinding/TOCTOU gap). `GM_xmlhttpRequest` (`userscript/src/userscript/gmFetch.ts`) follows redirects by default and isn't subject to the browser's own cross-origin checks, so the response's *final* URL is re-checked against the same allowlist before its body is trusted — a redirect can't be used to turn this privileged transport into an SSRF gadget against another local/internal address.
- **Cookie payloads are validated on both ends, never trusted as-is.** TS side:
  `userscript/src/baseline/cookies.ts`'s `sanitizeCookiesForWire` strips any field outside a
  fixed allowlist (data minimization), caps entry count and per-field length, and rejects a
  literal tab/newline in any field before it's ever sent. Python side: `mpv-handler.py`'s
  `validate_cookies_payload`/`parse_play_request_body` re-enforce the same limits independently
  (the handler's `/play` endpoint is reachable by anything on localhost, not only this
  userscript) — a tab/newline is rejected because it would corrupt the Netscape cookie file's
  tab-separated line structure, which is a real injection vector even though the file is never
  passed through a shell (`subprocess.Popen` always uses argv-list form, no `shell=True`).
  `Content-Length` is checked against a cap *before* `self.rfile.read()`, so a lying/huge header
  can't be used to exhaust memory. Cookie values are never written to `logger.*` at any level —
  only a count (`cookies=N`).

### Output Encoding

- When constructing shell commands, escape arguments properly — never interpolate raw user input.

### Secrets & Sensitive Data

- Never log video URLs, user IDs, or session tokens to console in production.
- GM_* storage values are user-controlled; treat them as untrusted input.

### Dependency Management

- The userscript and `mpv-handler.py` have no external dependencies (by design, stdlib only). If `@require` is ever used, pin versions and audit sources.
- Keep the script self-contained to minimize supply chain risk.
- `pyproject.toml` (managed via `uv`) exists solely to pin `yt-dlp`/`youtube-dl` — these are mpv's dependencies (its `ytdl_hook` shells out to them), not the handler's. `mpv-handler.py` never imports them. Run `uv sync` and point mpv's `ytdl_hook-ytdl_path` script-opt at `.venv/bin/yt-dlp` (or use `uv tool install yt-dlp` for a system-PATH install instead).

### Error Handling

- Return generic messages to users ("Failed to extract video URL").
- Log detailed errors via `console.error` — never expose internal paths or stack traces in UI.

## Testing

- **Manual testing** (full, real Tampermonkey install) on actual YouTube/Twitch pages in
  Chrome/Firefox — still the only way to verify against a real userscript-manager sandbox
  end-to-end (privilege boundaries, `@grant`-gated APIs actually being present, etc.).
- Test on Linux (Ubuntu/Fedora/Arch), macOS, and optionally Windows.
- Verify SPA navigation: navigate between videos/channels without a full page reload.
- Verify icon appears in player controls, click opens mpv, on **both** YouTube and Twitch.
- Test keyboard shortcut `Ctrl+Shift+M` on **both** sites.
- Test notification colors in light and dark mode.
- Verify the player right-click menu ("Open in MPV" / "Open in MPV at current time") and the row
  kebab ("⋮") menu ("Open in MPV") on home/search/sidebar rows — **YouTube only**, see "Twitch
  DOM Handling" above for why Twitch has nothing equivalent.
- `userscript/` has a vitest suite (`npm test`, happy-dom) covering the HTTP client, YouTube and
  Twitch validation/timestamp parsing, cookie sanitization, and the parts of the DOM layer that
  don't depend on either site's real markup (button add/remove, `GM_cookie` mocked responses,
  toast shape). It mocks `GM_*`/`fetch` — it proves those pieces behave correctly in isolation,
  not that mpv actually launches from a real browser.
- **Scripted real-browser verification** (this repo's own history, not a standing test suite):
  the Twitch button-injection selector (`.player-controls__right-control-group`), the
  right-click/kebab-menu limitation, and the full click → extract URL → `GM_cookie.list` →
  `MpvHandlerClient.play()` → POST body chain were all confirmed by scripting a real Chrome
  instance against live `twitch.tv`/`youtube.com` pages with `GM_*` stubbed (never a real
  Tampermonkey extension, never a real running handler). This is stronger than a pure unit test
  for DOM-selector correctness, but it's still not the same as a real Tampermonkey sandbox —
  notably, `youtube.com` enforces a Trusted Types CSP that blocks a page-context script's raw
  `element.innerHTML =` assignment (worked around in that verification via a `default`
  TrustedTypes policy shim); a real Tampermonkey content script is exempt from the page's CSP by
  browser design, so this isn't a real bug in `dom.ts`/`domTwitch.ts`'s existing
  `btn.innerHTML = MPV_ICON_SVG_WHITE` pattern, but it means a full Tampermonkey install is still
  the only way to verify that exemption itself holds. `GM_cookie.list()`'s *real* Tampermonkey
  field shape (leading-dot domain convention, `expirationDate` units) is also still unverified
  against a real install — `twitchCookies.ts`'s mapping is written to the documented API shape.
- `test_mpv_handler.py` (repo root, stdlib `unittest` — run with `python3 -m unittest
  test_mpv_handler`) covers `mpv-handler.py`'s cookie validation, Netscape-file generation, and
  the POST `/play` HTTP contract end-to-end against a real (but `MPV_PATH`-stubbed) server
  instance — including that a cookie temp file actually gets deleted after the launched process
  exits.

### Test Video / Test Channel

YouTube: use `https://www.youtube.com/watch?v=eYT5mlLPS0Q` — confirmed working URL with 3:23
duration. The player control bar is present and the video loads correctly.

**Caveat**: skip any pre-roll/mid-roll ad before testing the player right-click menu. During an ad, YouTube shows a reduced context menu without "Copy video URL" items — the feature-detection in `maybeInjectContextMenuItems` correctly (and intentionally) skips injecting into that reduced menu, so it can look like the feature is missing when it's actually just not the real video's menu yet.

Twitch: no fixed test URL — live channels come and go. Pick anything currently live from
`https://www.twitch.tv/directory`, or any VOD at `https://www.twitch.tv/videos/<id>`.

**Caveat**: Twitch auto-hides its player controls (including the injected button) until the
mouse hovers the player — a missing-looking button is almost always just that, not a bug. The
button lives in the same `.player-controls__right-control-group` container as Twitch's own
settings/fullscreen buttons, so it shows/hides in lockstep with them.

## Platform-Specific Notes

### Linux

- MPV must be installed and accessible in `$PATH` or at `~/.local/bin/mpv`.
- Handler auto-detects mpv binary.
- Systemd service available for background operation.

### macOS

- MPV or IINA (which uses MPV) must be installed.
- Homebrew users: `brew install mpv`
- Handler auto-detects mpv binary.

### Windows

- MPV must be installed and accessible in PATH or at common install locations.
- Handler auto-detects mpv binary (PATH, `%LOCALAPPDATA%\mpv`, `Program Files`, Scoop, Chocolatey).
- PowerShell scripts provided for start/stop (`start-handler.ps1`, `stop-handler.ps1`).
- Optional: NSSM for Windows service support.
- Clipboard fallback uses double quotes: `mpv.exe "URL"`.
- **Windows Security/Defender can silently block `python.exe`/`mpv.exe`** — handler responds to `/health` normally but mpv never launches, no error shown. Fix: add the project folder (and mpv's install folder) to Windows Security exclusions (`Virus & threat protection → Manage settings → Add or remove exclusions`). Check `%TEMP%\mpv-handler.log` to confirm whether this is the cause before/after excluding.

## Git Conventions

- **No auto-commits** — all commits are user-initiated.
- Commit messages: imperative mood, lowercase, no period.
  - `add mpv icon to player controls`
  - `fix button not appearing on SPA navigation`
  - `add keyboard shortcut ctrl+shift+m`
  - `add dark mode support for notifications`
- Branch naming: `feat/short-description`, `fix/short-description`

## Distribution

- `userscript/dist/youtube-to-mpv.user.js` (the tsup build output, committed to the repo despite
  living under `dist/` — see `.gitignore`'s negation for that one path) is distributed directly —
  users install it by opening the raw URL in Tampermonkey.
- Host it on GitHub (raw.githubusercontent.com) for one-click install.
- The `@updateURL` and `@installURL` metadata (set in `userscript/src/userscript/metadata.txt`,
  which tsup prepends verbatim as the build's banner) point at that raw GitHub URL.
- Version with semver in the metadata block.
- `@name` is `"Stream to MPV"` (renamed from `"Steam to MPV (YouTube)"` — matches the repo's own
  `stream-to-mpv` name now that Twitch is a real feature, not just YouTube). The **dist filename**
  (`youtube-to-mpv.user.js`) was deliberately left unchanged, even though it no longer matches
  the display name — `@updateURL`/`@installURL` point at that exact path, and renaming it would
  404 the next auto-update check for anyone who already has the script installed. Renaming the
  file is a separate, deliberate follow-up (would need a migration plan for existing installs),
  not something to do incidentally alongside an unrelated change.

## Common Issues & Troubleshooting

| Issue | Cause | Solution |
| ------- | ------- | ---------- |
| Icon doesn't appear | SPA not re-injected | Ensure MutationObserver is running |
| Handler offline | Service not running | `systemctl --user start mpv-handler` (Linux) or `.\start-handler.ps1` (Windows) |
| mpv not found | Binary not in PATH | Install mpv or check `~/.local/bin` (Linux), `/opt/homebrew/bin` (macOS), or `%LOCALAPPDATA%\mpv` (Windows) |
| mpv never launches on Windows, no error | Windows Security/Defender blocking `python.exe`/`mpv.exe` | Add project folder + mpv install folder to Windows Security exclusions; check `%TEMP%\mpv-handler.log` |
| Cookies/Twitch feature seems missing | Local `mpv-handler.py` predates this change — it isn't auto-updated like the userscript | Pull the latest `mpv-handler.py` and restart the handler |
| Toast not showing | CSS animation issue | Check for conflicting styles |
| Wrong video opens | URL extraction failed | Check `ytInitialPlayerResponse` fallback |
| Twitch icon doesn't appear | Twitch auto-hides player controls until hover | Move the mouse over the player — the icon lives in the same auto-hide group as Twitch's own settings/fullscreen buttons |
| Twitch right-click/kebab menu has no "Open in MPV" | Not a bug — Twitch has no custom context menu or per-card options menu (see "Twitch DOM Handling") | Use the player control-bar icon or `Ctrl+Shift+M` instead |

## See Also

- [Tampermonkey Documentation](https://www.tampermonkey.net/documentation.php)
- [mpv-player/mpv](https://mpv.io/)
- [mpv-handler](https://github.com/akiirui/mpv-handler)
