# YouTube to MPV

A Tampermonkey userscript that adds a button to YouTube's player controls to open videos in MPV media player.

## Features

- **One-click open**: Click the icon to open directly in MPV
- **Keyboard shortcut**: Press `Ctrl+Shift+M`
- **Right-click the player**: "Open in MPV" and "Open in MPV at current time" alongside YouTube's own "Copy video URL" items
- **Right-click (kebab) any row**: "Open in MPV" from the "⋮" menu on home/search/sidebar rows — no need to open the video first
- **Timestamp-aware**: Opening from a link with `?t=` (or "at current time" from the player) starts mpv at that point via `--start=`
- **Auto-launch**: Starts mpv automatically via local handler
- **Auto-detect**: Handler finds mpv binary automatically
- **Fallback**: Copies command if handler is offline
- **Dark mode**: Notifications adapt to system theme
- **SPA-aware**: Works with YouTube's dynamic navigation
- **Icon-only**: Subtle SVG icon in player controls
- **Systemd support**: Run as a background service

## Installation

### 1. Install the userscript

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Click to install: [youtube-to-mpv.user.js](userscript/dist/youtube-to-mpv.user.js) (built from source in `userscript/` — see `userscript/README.md`)

### 2. Install yt-dlp/youtube-dl (required for mpv to play YouTube)

mpv streams YouTube via its built-in `ytdl_hook`, which shells out to `yt-dlp` (or `youtube-dl`) — without one of these, mpv can't resolve a YouTube URL into a playable stream. This repo's `pyproject.toml` pins both via [uv](https://docs.astral.sh/uv/):

```bash
uv sync
```

This creates a `.venv` with `yt-dlp` and `youtube-dl` installed. Point mpv at the pinned binary so it doesn't depend on system PATH — add to `mpv.conf` (`~/.config/mpv/mpv.conf` on Linux/macOS, `%APPDATA%\mpv\mpv.conf` on Windows):

```
# Linux/macOS
script-opts=ytdl_hook-ytdl_path=/absolute/path/to/repo/.venv/bin/yt-dlp

# Windows
script-opts=ytdl_hook-ytdl_path=C:\absolute\path\to\repo\.venv\Scripts\yt-dlp.exe
```

Alternatively, install yt-dlp as a standalone CLI tool on PATH instead of a per-project venv:

```bash
uv tool install yt-dlp
```

### 3. Set up the handler

#### Linux/macOS

**Option A: Manual start**

```bash
./start-handler.sh
```

**Option B: Systemd service (recommended, Linux only)**

```bash
./install-service.sh
```

#### Windows

**Prerequisites**: Python 3.6+ installed and in PATH.

**Option A: Manual start (recommended)**

```powershell
.\start-handler.ps1
```

**Option B: NSSM service (auto-start on boot)**

```powershell
# Install NSSM: scoop install nssm
nssm install mpv-handler python mpv-handler.py
nssm start mpv-handler
```

**Windows Security / Defender**: Windows Security may silently block `python.exe` or `mpv.exe` from launching (no error, mpv just never opens). If the handler responds to `/health` but mpv never launches, add the project folder (and/or the mpv install folder) to Windows Security exclusions:

`Windows Security → Virus & threat protection → Manage settings → Add or remove exclusions → Add an exclusion → Folder`

Check `%TEMP%\mpv-handler.log` for launch errors before/after adding the exclusion.

The handler runs on `http://127.0.0.1:38421` and auto-launches mpv.

### 4. Use

Navigate to any YouTube video and click the icon (▶↗) in the player controls — or right-click the player, or open any row's "⋮" menu on the home/search/sidebar and pick "Open in MPV".

## Usage

### Linux/macOS

```bash
# Systemd service
./install-service.sh          # Install and start
./uninstall-service.sh        # Stop and remove
systemctl --user status mpv-handler   # Check status
systemctl --user restart mpv-handler  # Restart

# Manual
./start-handler.sh
./stop-handler.sh
curl http://127.0.0.1:38421/health
```

### Windows

```powershell
# Manual
.\start-handler.ps1
.\stop-handler.ps1
curl http://127.0.0.1:38421/health

# NSSM service
nssm start mpv-handler
nssm stop mpv-handler
nssm status mpv-handler
```

## How it works

1. Userscript sends `GET http://127.0.0.1:38421/play?url=VIDEO_URL`
2. Python handler auto-detects mpv and runs `mpv VIDEO_URL`
3. Falls back to clipboard if handler is offline

## Notifications

- **Success**: White (light mode) / Dark gray (dark mode)
- **Error**: Red (YouTube color, always)
- **Copy button**: Adapts to current theme

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+M` | Open in MPV at current time |

## Configuration

Access via Tampermonkey menu:

| Setting | Default | Description |
| --------- | --------- | ------------- |
| `mpvPath` | `mpv` | Path to mpv binary (auto-detected by handler) |
| `showButton` | `true` | Show icon in player controls |
| `autoPlaylist` | `false` | (Reserved for future use) |

## Systemd Service

The service file is installed at `~/.config/systemd/user/mpv-handler.service`.

```bash
# Enable auto-start on login
loginctl enable-linger $USER

# View logs
journalctl --user -u mpv-handler
```

## Platform Support

| Platform | Status | mpv Detection |
| ---------- | -------- | --------------- |
| Linux | Supported | PATH, `~/.local/bin`, `/usr/bin`, `/usr/local/bin` |
| macOS | Supported | PATH, Homebrew (`/opt/homebrew/bin`, `/usr/local/bin`) |
| Windows | Supported | PATH, `%LOCALAPPDATA%\mpv`, `Program Files`, Scoop, Chocolatey |

## Browser Compatibility

| Browser | Status |
| --------- | -------- |
| Chrome/Brave/Edge | Works |
| Firefox | Works |
| Safari | Untested |

## Testing

Use this confirmed working video:
`https://www.youtube.com/watch?v=eYT5mlLPS0Q`

## License

MIT
