import { isValidYoutubeVideoId, buildYoutubeWatchUrl } from '../platforms/youtube/validation.js';
import { parseYoutubeTimestamp } from '../platforms/youtube/timestamp.js';
import { getConfig, setConfig } from './config.js';
import { MPV_ICON_SVG_CURRENT, MPV_ICON_SVG_WHITE } from './icons.js';
import { showToast } from './toast.js';

export interface DomCallbacks {
  /** videoUrl is always a validated, canonical https://www.youtube.com/watch?v=<id> URL. */
  openInMpv: (videoUrl: string, timestampSeconds: number | null) => void | Promise<void>;
}

// ==================== Page scraping ====================
// Extracts candidate ids from wherever YouTube exposes them, then hands off to
// platforms/youtube/validation.ts's regex-backed checks — never re-implemented here.

function getVideoId(): string | null {
  const urlMatch = /[?&]v=([^&]+)/.exec(window.location.search);
  if (urlMatch?.[1] && isValidYoutubeVideoId(urlMatch[1])) {
    return urlMatch[1];
  }

  const playerVideoId = window.ytInitialPlayerResponse?.videoDetails?.videoId;
  if (playerVideoId && isValidYoutubeVideoId(playerVideoId)) {
    return playerVideoId;
  }

  const metaVideoId = document.querySelector('meta[itemprop="videoId"]')?.getAttribute('content');
  if (metaVideoId && isValidYoutubeVideoId(metaVideoId)) {
    return metaVideoId;
  }

  return null;
}

function getVideoUrl(videoId: string | null = getVideoId()): string | null {
  return videoId ? buildYoutubeWatchUrl(videoId) : null;
}

/** Reserved for future use alongside the autoPlaylist config option — see CLAUDE.md. */
export function getPlaylistId(): string | null {
  const urlMatch = /[?&]list=([^&]+)/.exec(window.location.search);
  return urlMatch?.[1] ?? null;
}

function extractVideoIdFromHref(href: string | null): string | null {
  if (!href) return null;
  try {
    const videoId = new URL(href, window.location.origin).searchParams.get('v');
    return videoId && isValidYoutubeVideoId(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

function parseTimestampParam(href: string | null): number | null {
  if (!href) return null;
  try {
    return parseYoutubeTimestamp(new URL(href, window.location.origin).searchParams.get('t'));
  } catch {
    return null;
  }
}

function dispatchOpen(
  callbacks: DomCallbacks,
  videoUrl: string | null,
  timestampSeconds: number | null,
): void {
  if (!videoUrl) {
    console.error('[Stream to MPV] Could not extract video URL');
    showToast('Failed to extract video URL', 'error');
    return;
  }
  // openInMpv (main.ts) handles all its own errors internally — fire-and-forget by design.
  void callbacks.openInMpv(videoUrl, timestampSeconds);
}

function currentPlaybackTime(): number | null {
  const video = document.querySelector('video');
  const currentTime = video ? Math.floor(video.currentTime) : 0;
  return currentTime > 0 ? currentTime : null;
}

// ==================== UI Injection ====================

const BUTTON_ID = 'mpv-open-btn';

export function injectButton(callbacks: DomCallbacks): void {
  if (!getConfig('showButton')) return;
  if (document.getElementById(BUTTON_ID)) return;

  const controlBar = document.querySelector('.ytp-right-controls');
  if (!controlBar) return;

  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.className = 'ytp-button';
  btn.title = 'Open in MPV (Ctrl+Shift+M)';
  btn.innerHTML = MPV_ICON_SVG_WHITE;
  btn.style.cssText = `
    padding: 0 8px;
    min-width: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dispatchOpen(callbacks, getVideoUrl(), null);
  });

  controlBar.prepend(btn);
}

export function removeButton(): void {
  document.getElementById(BUTTON_ID)?.remove();
}

// ==================== Native Menu Injection ====================
//
// YouTube renders two menus as its own DOM (not the browser's native context menu), so a
// userscript can add items to them:
//   - Right-clicking the player opens `.ytp-contextmenu`.
//   - Clicking a video row's "⋮" kebab opens a shared `ytd-popup-container`.
// YouTube currently ships two different component systems for the kebab popup depending on
// page/experiment (legacy `ytd-menu-popup-renderer` vs newer `yt-list-view-model`), so detection
// below matches on visible item text/aria-label rather than a single hardcoded tag family.

const ROW_SELECTOR =
  'ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model';

interface PendingRowTarget {
  videoId: string;
  timestamp: number | null;
}

// Video ID/timestamp for whichever row's kebab was just clicked, captured before the (shared,
// singleton) popup opens.
let pendingRowTarget: PendingRowTarget | null = null;

function getRowAnchorHref(row: Element): string | null {
  return row.querySelector('a#thumbnail, a[href*="/watch"]')?.getAttribute('href') ?? null;
}

/** Escape closes both `.ytp-contextmenu` and the popup container's dialog. */
function dismissOpenMenus(): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
}

function buildContextMenuItem(label: string, onClick: () => void): HTMLElement {
  const item = document.createElement('div');
  item.className = 'ytp-menuitem';
  item.setAttribute('role', 'menuitem');
  item.tabIndex = 0;
  item.innerHTML = `
    <div class="ytp-menuitem-icon">${MPV_ICON_SVG_CURRENT}</div>
    <div class="ytp-menuitem-label"></div>
    <div class="ytp-menuitem-content"></div>
  `;
  const label_ = item.querySelector('.ytp-menuitem-label');
  if (label_) label_.textContent = label;
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return item;
}

/**
 * YouTube sizes `.ytp-contextmenu` (and its `.ytp-panel`/`.ytp-panel-menu` wrappers) with an
 * inline height computed once, at open time, from the original item count. Items appended
 * afterwards would otherwise overflow into an internal scrollbar instead of growing the panel,
 * so re-measure and re-apply the height to all three after inserting our items.
 */
function growContextMenuToFit(panel: HTMLElement): void {
  const panelWrap = panel.closest<HTMLElement>('.ytp-panel');
  const menu = panel.closest<HTMLElement>('.ytp-contextmenu');
  const newHeight = `${panel.scrollHeight}px`;
  panel.style.height = newHeight;
  if (panelWrap) panelWrap.style.height = newHeight;
  if (menu) menu.style.height = newHeight;
}

function maybeInjectContextMenuItems(callbacks: DomCallbacks): void {
  if (!getConfig('enableNativeMenuItems')) return;

  const panel = document.querySelector<HTMLElement>('.ytp-contextmenu .ytp-panel-menu');
  if (!panel || panel.dataset.mpvInjected) return;
  if (!/copy video url/i.test(panel.textContent ?? '')) return;

  panel.dataset.mpvInjected = 'true';

  panel.appendChild(
    buildContextMenuItem('Open in MPV', () => {
      dispatchOpen(callbacks, getVideoUrl(), null);
      dismissOpenMenus();
    }),
  );

  panel.appendChild(
    buildContextMenuItem('Open in MPV at current time', () => {
      dispatchOpen(callbacks, getVideoUrl(), currentPlaybackTime());
      dismissOpenMenus();
    }),
  );

  growContextMenuToFit(panel);
}

function buildRowMenuItem(label: string, onClick: () => void): HTMLElement {
  const item = document.createElement('div');
  item.className = 'mpv-row-menuitem';
  item.setAttribute('role', 'menuitem');
  item.tabIndex = 0;
  item.innerHTML = MPV_ICON_SVG_CURRENT;

  const text = document.createElement('span');
  text.textContent = label;
  item.appendChild(text);

  item.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return item;
}

function maybeInjectRowMenuItem(callbacks: DomCallbacks): void {
  if (!getConfig('enableNativeMenuItems')) return;
  if (!pendingRowTarget) return;

  const popup = document.querySelector('ytd-popup-container');
  if (!popup) return;

  const listbox = popup.querySelector<HTMLElement>('tp-yt-paper-listbox#items, yt-list-view-model');
  if (!listbox || listbox.dataset.mpvInjected) return;
  if (!/add to queue|save to playlist/i.test(listbox.textContent ?? '')) return;

  listbox.dataset.mpvInjected = 'true';

  listbox.appendChild(
    buildRowMenuItem('Open in MPV', () => {
      const target = pendingRowTarget;
      if (!target) return;
      dispatchOpen(callbacks, getVideoUrl(target.videoId), target.timestamp);
      dismissOpenMenus();
    }),
  );
}

// ==================== SPA Navigation Detection ====================

let lastUrl = '';

function handleUrlChange(callbacks: DomCallbacks): void {
  const currentUrl = window.location.href;
  if (currentUrl === lastUrl) return;
  lastUrl = currentUrl;

  removeButton();

  if (window.location.pathname.startsWith('/watch')) {
    // Small delay to let YouTube's DOM settle.
    setTimeout(() => injectButton(callbacks), 500);
  }
}

// ==================== Styles ====================

const STYLE_ID = 'mpv-open-styles';

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes mpv-fade-in {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes mpv-fade-out {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to { opacity: 0; transform: translateX(-50%) translateY(10px); }
    }
    /* Overrides YouTube's "Delhi" redesign, which pads every .ytp-button svg (12px 12px) and
       would otherwise squeeze our fixed-size icon down to a sliver. The #id selector outranks
       that rule's 4 classes regardless of stylesheet order. */
    #mpv-open-btn svg {
      width: 24px;
      height: 24px;
      padding: 0;
      display: block;
    }
    .mpv-row-menuitem {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 16px;
      font-size: 14px;
      line-height: 20px;
      cursor: pointer;
      color: #0f0f0f;
    }
    .mpv-row-menuitem svg {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }
    .mpv-row-menuitem:hover {
      background: rgba(0, 0, 0, 0.1);
    }
    html[dark] .mpv-row-menuitem {
      color: #fff;
    }
    html[dark] .mpv-row-menuitem:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  `;
  document.head.appendChild(style);
}

// ==================== Wiring ====================

/** Wires up all page UI: button, native menus, SPA navigation, keyboard shortcut, GM menu commands. */
export function initUserscriptUi(callbacks: DomCallbacks): void {
  injectStyles();

  document.addEventListener(
    'click',
    (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const kebab = target.closest(
        'button[aria-label="Action menu" i], button[aria-label="More actions" i]',
      );
      if (!kebab) return;

      const row = kebab.closest(ROW_SELECTOR);
      const href = row ? getRowAnchorHref(row) : null;
      const videoId = extractVideoIdFromHref(href);

      pendingRowTarget = videoId ? { videoId, timestamp: parseTimestampParam(href) } : null;
    },
    true,
  );

  const observer = new MutationObserver(() => {
    handleUrlChange(callbacks);
    maybeInjectContextMenuItems(callbacks);
    maybeInjectRowMenuItem(callbacks);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('popstate', () => handleUrlChange(callbacks));

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'M') {
      e.preventDefault();
      dispatchOpen(callbacks, getVideoUrl(), currentPlaybackTime());
    }
  });

  GM_registerMenuCommand('Open current video in MPV', () => {
    dispatchOpen(callbacks, getVideoUrl(), null);
  });
  GM_registerMenuCommand('Toggle button visibility', () => {
    const current = getConfig('showButton');
    setConfig('showButton', !current);
    if (current) {
      removeButton();
    } else {
      injectButton(callbacks);
    }
  });
  GM_registerMenuCommand('Toggle MPV menu items', () => {
    setConfig('enableNativeMenuItems', !getConfig('enableNativeMenuItems'));
  });

  if (window.location.pathname.startsWith('/watch')) {
    if (document.readyState === 'complete') {
      injectButton(callbacks);
    } else {
      window.addEventListener('load', () => injectButton(callbacks));
    }
  }
}
