# YouTube to MPV Userscript

## Project Overview

A Tampermonkey/Greasemonkey userscript that adds an icon to YouTube's player control bar to open videos in MPV media player via a local handler.

**Primary target platforms**: Linux, macOS, Windows

## Tech Stack

- **Language**: JavaScript (ES6+, userscript-compatible — no modules, no build step)
- **Runtime**: Tampermonkey / Greasemonkey userscript context
- **APIs**: YouTube DOM manipulation, `GM_*` privileged APIs, Clipboard API
- **Player**: MPV (external, system-installed)
- **Handler**: Python HTTP server on localhost:38421
- **YouTube extraction**: `yt-dlp`/`youtube-dl` (mpv's `ytdl_hook` shells out to one of these; pinned via `pyproject.toml` + `uv`, not imported by the handler)

## Architecture

```
youtube-to-mpv.user.js   ← Userscript (browser)
├── Metadata block (@grant, @match, etc.)
├── Config section (user-adjustable settings)
├── YouTube page detection & URL extraction
├── Local handler communication (GM_xmlhttpRequest)
├── Clipboard fallback (if handler offline)
├── UI injection (icon in player control bar)
├── Toast notification (dark mode aware)
└── SPA navigation detection (MutationObserver)

mpv-handler.py                     ← Local server (system, all platforms)
├── HTTP server on 127.0.0.1:38421
├── Auto-detects mpv binary (shutil.which + platform-specific paths)
├── /play?url=URL endpoint
├── Launches mpv with the URL
└── Health check endpoint

Startup scripts (OS-specific):
├── start-handler.sh / stop-handler.sh       ← Linux/macOS
├── start-handler.ps1 / stop-handler.ps1     ← Windows
└── mpv-handler.service                      ← Systemd (Linux only)

pyproject.toml                     ← uv-managed pin for yt-dlp/youtube-dl (mpv's deps, not the handler's)
```

The entire script is a single `.user.js` file. No build system, no dependencies, no npm.

## Development Guidelines

### Code Style

- **No transpilation** — write plain ES6+ that runs in Tampermonkey's sandbox
- **No ES modules** — userscripts use `@require` or inline code; keep everything in one file
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

### MPV Launch Strategy

The script communicates with a local Python handler via HTTP:

1. **Primary**: `GM_xmlhttpRequest` to `http://127.0.0.1:38421/play?url=VIDEO_URL`
2. **Fallback**: Copies `mpv <url>` to clipboard if handler is offline

The handler approach is preferred because:

- Auto-launches mpv without user intervention
- Auto-detects mpv binary using `shutil.which()`
- Works across all browsers (Chrome, Firefox, Brave)
- No clipboard permission issues

The clipboard fallback ensures the script still works if the handler isn't running.

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
| `showButton` | `true` | Show icon in player controls |
| `autoPlaylist` | `false` | (Reserved for future use) |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+M` | Open in MPV |

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

- **Never trust YouTube's DOM** — validate extracted video IDs against `/^[a-zA-Z0-9_-]{11}$/` before use.
- Sanitize any user-configured values (MPV path) before passing to command construction.
- Validate URLs before opening — only allow `https://youtube.com/watch?v=...` patterns.

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

- **Manual testing** on actual YouTube pages in Chrome/Firefox with Tampermonkey installed.
- Test on Linux (Ubuntu/Fedora/Arch), macOS, and optionally Windows.
- Verify SPA navigation: navigate between videos without full page reload.
- Verify icon appears in player controls, click opens mpv.
- Test keyboard shortcut `Ctrl+Shift+M`.
- Test notification colors in light and dark mode.
- No automated test framework — this is a userscript, tested via browser developer tools.

### Test Video

Use `https://www.youtube.com/watch?v=eYT5mlLPS0Q` for testing — confirmed working URL with 3:23 duration. The player control bar is present and the video loads correctly.

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

- The `.user.js` file is distributed directly — users install it by opening the URL in Tampermonkey.
- Host the raw `.user.js` on GitHub (raw.githubusercontent.com) for one-click install.
- The `@updateURL` and `@installURL` metadata should point to the raw GitHub URL.
- Version with semver in the metadata block.

## Common Issues & Troubleshooting

| Issue | Cause | Solution |
| ------- | ------- | ---------- |
| Icon doesn't appear | SPA not re-injected | Ensure MutationObserver is running |
| Handler offline | Service not running | `systemctl --user start mpv-handler` (Linux) or `.\start-handler.ps1` (Windows) |
| mpv not found | Binary not in PATH | Install mpv or check `~/.local/bin` (Linux), `/opt/homebrew/bin` (macOS), or `%LOCALAPPDATA%\mpv` (Windows) |
| mpv never launches on Windows, no error | Windows Security/Defender blocking `python.exe`/`mpv.exe` | Add project folder + mpv install folder to Windows Security exclusions; check `%TEMP%\mpv-handler.log` |
| Toast not showing | CSS animation issue | Check for conflicting styles |
| Wrong video opens | URL extraction failed | Check `ytInitialPlayerResponse` fallback |

## See Also

- [Tampermonkey Documentation](https://www.tampermonkey.net/documentation.php)
- [mpv-player/mpv](https://mpv.io/)
- [mpv-handler](https://github.com/akiirui/mpv-handler)
