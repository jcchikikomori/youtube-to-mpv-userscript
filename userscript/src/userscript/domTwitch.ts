import {
  buildTwitchChannelUrl,
  buildTwitchVodUrl,
  extractTwitchChannel,
  extractTwitchVodId,
} from '../platforms/twitch/validation.js';
import type { CookieEntry } from '../baseline/types.js';
import { getConfig, setConfig } from './config.js';
import { MPV_ICON_SVG_WHITE } from './icons.js';
import { showToast } from './toast.js';
import { getTwitchCookies } from './twitchCookies.js';

export interface TwitchDomCallbacks {
  /** input is always a validated, canonical https://www.twitch.tv/<channel-or-videos/id> URL. */
  openInMpv: (
    input: string,
    timestampSeconds: number | null,
    cookies: CookieEntry[] | null,
  ) => void | Promise<void>;
}

// ==================== Page scraping ====================
// No cross-platform sharing with platforms/youtube/** or platforms/twitch/** beyond the pure
// validation helpers, per this module's own README — same convention dom.ts already follows.

function getCurrentTwitchUrl(): string | null {
  const href = window.location.href;
  const vodId = extractTwitchVodId(href);
  if (vodId) return buildTwitchVodUrl(vodId);

  const channel = extractTwitchChannel(href);
  return channel ? buildTwitchChannelUrl(channel) : null;
}

function isWatchablePage(): boolean {
  return getCurrentTwitchUrl() !== null;
}

function currentPlaybackTime(): number | null {
  const video = document.querySelector('video');
  const currentTime = video ? Math.floor(video.currentTime) : 0;
  return currentTime > 0 ? currentTime : null;
}

async function dispatchOpen(
  callbacks: TwitchDomCallbacks,
  timestampSeconds: number | null,
): Promise<void> {
  const videoUrl = getCurrentTwitchUrl();
  if (!videoUrl) {
    console.error('[Stream to MPV] Could not extract Twitch channel/VOD URL');
    showToast('Failed to extract video URL', 'error');
    return;
  }
  // Fetched fresh per open() call, scoped to twitch.tv only (see twitchCookies.ts) — never
  // cached, never shared with the YouTube path.
  const cookies = await getTwitchCookies();
  // dispatchOpen's caller (main.ts's openInMpv) handles all its own errors internally —
  // fire-and-forget by design, matching dom.ts's dispatchOpen.
  void callbacks.openInMpv(videoUrl, timestampSeconds, cookies);
}

// ==================== UI Injection ====================
//
// Unlike YouTube, Twitch does not render its own in-page context menu (confirmed live: a
// dispatched `contextmenu` event on the player has `defaultPrevented: false` — Twitch just uses
// the browser's native menu, which a userscript cannot add items to) and its stream preview
// cards (directory/category pages) have no "⋮" kebab/options button either. So the only
// integration point here is the player control-bar button plus the keyboard shortcut — there is
// no Twitch equivalent of dom.ts's maybeInjectContextMenuItems/maybeInjectRowMenuItem.

const BUTTON_ID = 'mpv-open-btn-twitch';

export function injectButton(callbacks: TwitchDomCallbacks): void {
  if (!getConfig('showButton')) return;
  if (document.getElementById(BUTTON_ID)) return;

  const controlBar = document.querySelector('.player-controls__right-control-group');
  if (!controlBar) return;

  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.title = 'Open in MPV (Ctrl+Shift+M)';
  btn.innerHTML = MPV_ICON_SVG_WHITE;
  // Twitch's own control buttons use webpack/styled-components-generated class names (e.g.
  // "ScCoreButton-sc-ocjdkq-0 eBQIRH") that change between deploys — inline styles here, never
  // borrowed site classes, same reasoning as dom.ts's #mpv-open-btn override but inline since
  // there's no stable class to hook a stylesheet rule off of.
  btn.style.cssText = `
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0 8px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    void dispatchOpen(callbacks, null);
  });

  controlBar.prepend(btn);
}

export function removeButton(): void {
  document.getElementById(BUTTON_ID)?.remove();
}

// ==================== Styles ====================

const STYLE_ID = 'mpv-open-styles-twitch';

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${BUTTON_ID}:hover svg {
      opacity: 0.7;
    }
  `;
  document.head.appendChild(style);
}

// ==================== SPA Navigation Detection ====================

let lastUrl = '';

function handleUrlChange(callbacks: TwitchDomCallbacks): void {
  const currentUrl = window.location.href;
  if (currentUrl === lastUrl) return;
  lastUrl = currentUrl;

  removeButton();

  if (isWatchablePage()) {
    // Small delay to let Twitch's DOM settle, matching dom.ts's YouTube equivalent.
    setTimeout(() => injectButton(callbacks), 500);
  }
}

// ==================== Wiring ====================

/** Wires up all page UI: button, SPA navigation, keyboard shortcut, GM menu commands. */
export function initTwitchUserscriptUi(callbacks: TwitchDomCallbacks): void {
  injectStyles();

  const observer = new MutationObserver(() => handleUrlChange(callbacks));
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('popstate', () => handleUrlChange(callbacks));

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'M') {
      e.preventDefault();
      void dispatchOpen(callbacks, currentPlaybackTime());
    }
  });

  GM_registerMenuCommand('Open current Twitch stream/VOD in MPV', () => {
    void dispatchOpen(callbacks, null);
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

  if (isWatchablePage()) {
    if (document.readyState === 'complete') {
      injectButton(callbacks);
    } else {
      window.addEventListener('load', () => injectButton(callbacks));
    }
  }
}
