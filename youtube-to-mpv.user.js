// ==UserScript==
// @name         YouTube to MPV
// @namespace    https://github.com/your-username/youtube-to-mpv-userscript
// @version      0.2.0
// @description  Open YouTube videos directly in MPV media player via system protocol handlers
// @author       John Cyrill Corsanes
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @run-at       document-idle
// @license      MIT
// @updateURL    https://raw.githubusercontent.com/your-username/youtube-to-mpv-userscript/main/youtube-to-mpv.user.js
// @installURL   https://raw.githubusercontent.com/your-username/youtube-to-mpv-userscript/main/youtube-to-mpv.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ==================== Configuration ====================

  const DEFAULT_CONFIG = {
    mpvPath: 'mpv',
    showButton: true,
    autoPlaylist: false,
    enableNativeMenuItems: true,
  };

  function getConfig(key) {
    return GM_getValue(key, DEFAULT_CONFIG[key]);
  }

  function setConfig(key, value) {
    GM_setValue(key, value);
  }

  // ==================== Platform Detection ====================

  const PLATFORM = navigator.platform.toLowerCase();
  const IS_LINUX = PLATFORM.includes('linux');
  const IS_MAC = PLATFORM.includes('mac');
  const IS_WINDOWS = PLATFORM.includes('win');

  function getPlatform() {
    if (IS_LINUX) return 'linux';
    if (IS_MAC) return 'mac';
    if (IS_WINDOWS) return 'windows';
    return 'unknown';
  }

  // ==================== URL Extraction ====================

  /**
   * Validate video ID against YouTube's format (11 chars, alphanumeric + - _)
   * OWASP: Never trust DOM input — always validate before use
   */
  function isValidVideoId(id) {
    return /^[a-zA-Z0-9_-]{11}$/.test(id);
  }

  /**
   * Validate URL to ensure it's a legitimate YouTube watch URL
   */
  function isValidYoutubeUrl(url) {
    try {
      const parsed = new URL(url);
      return (
        (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') &&
        parsed.pathname === '/watch' &&
        parsed.searchParams.has('v')
      );
    } catch {
      return false;
    }
  }

  function getVideoId() {
    // From URL parameters
    const urlMatch = window.location.search.match(/[?&]v=([^&]+)/);
    if (urlMatch && isValidVideoId(urlMatch[1])) {
      return urlMatch[1];
    }

    // From YouTube's embedded player response
    if (window.ytInitialPlayerResponse) {
      const videoId = window.ytInitialPlayerResponse.videoDetails?.videoId;
      if (videoId && isValidVideoId(videoId)) {
        return videoId;
      }
    }

    // From page content (fallback)
    const metaTag = document.querySelector('meta[itemprop="videoId"]');
    if (metaTag) {
      const videoId = metaTag.getAttribute('content');
      if (videoId && isValidVideoId(videoId)) {
        return videoId;
      }
    }

    return null;
  }

  function getVideoUrl(videoId = getVideoId()) {
    if (!videoId) return null;

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    return isValidYoutubeUrl(url) ? url : null;
  }

  function getPlaylistId() {
    const urlMatch = window.location.search.match(/[?&]list=([^&]+)/);
    return urlMatch ? urlMatch[1] : null;
  }

  /**
   * Extract a validated video ID from a (possibly relative) link href,
   * e.g. the anchor inside a thumbnail/row on a listing page.
   */
  function extractVideoIdFromHref(href) {
    if (!href) return null;

    try {
      const videoId = new URL(href, window.location.origin).searchParams.get('v');
      return videoId && isValidVideoId(videoId) ? videoId : null;
    } catch {
      return null;
    }
  }

  /**
   * Parse YouTube's `t` timestamp param off a link href.
   * Supports plain seconds ("t=699") and the legacy duration form
   * ("t=1h2m3s", "t=90s", "t=1m30s"). Returns null (not 0) when absent.
   */
  function parseTimestampParam(href) {
    if (!href) return null;

    let raw;
    try {
      raw = new URL(href, window.location.origin).searchParams.get('t');
    } catch {
      return null;
    }
    if (!raw) return null;

    if (/^\d+$/.test(raw)) {
      return parseInt(raw, 10);
    }

    const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
    if (!match || !(match[1] || match[2] || match[3])) return null;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  // ==================== MPV Launch ====================

  const HANDLER_URL = 'http://127.0.0.1:38421';

  async function openInMpv(videoUrl = getVideoUrl(), timestamp = null) {
    if (!videoUrl) {
      console.error('[YouTube to MPV] Could not extract video URL');
      showToast('Failed to extract video URL', 'error');
      return;
    }

    const playUrl = timestamp !== null
      ? `${HANDLER_URL}/play?url=${encodeURIComponent(videoUrl)}&t=${timestamp}`
      : `${HANDLER_URL}/play?url=${encodeURIComponent(videoUrl)}`;

    try {
      GM_xmlhttpRequest({
        method: 'GET',
        url: playUrl,
        onload: (response) => {
          if (response.status === 200) {
            showToast('Opening in MPV...', 'success');
          } else {
            fallbackToClipboard(videoUrl, timestamp);
          }
        },
        onerror: () => {
          fallbackToClipboard(videoUrl, timestamp);
        }
      });
    } catch {
      fallbackToClipboard(videoUrl, timestamp);
    }
  }

  async function fallbackToClipboard(videoUrl, timestamp = null) {
    const mpvPath = getConfig('mpvPath');
    const isWindows = getPlatform() === 'windows';
    const startArg = timestamp !== null ? ` --start=${timestamp}` : '';
    const command = isWindows
      ? `${mpvPath} "${videoUrl}"${startArg}`
      : `${mpvPath} '${videoUrl}'${startArg}`;

    try {
      await navigator.clipboard.writeText(command);
      showToast('Handler offline. Copied: ' + command, 'warning');
    } catch {
      showToast('Run: ' + command, 'error');
    }
  }

  function showToast(message, type) {
    const existing = document.getElementById('mpv-toast');
    if (existing) existing.remove();

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isError = type === 'error';

    const bgColor = isError ? '#e74c3c' : isDark ? '#333' : '#fff';
    const textColor = isError ? '#fff' : isDark ? '#fff' : '#333';
    const borderColor = isError ? 'transparent' : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
    const btnBg = isError ? 'rgba(255,255,255,0.2)' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
    const btnBorder = isError ? 'rgba(255,255,255,0.3)' : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
    const btnColor = isError ? '#fff' : isDark ? '#fff' : '#333';

    const toast = document.createElement('div');
    toast.id = 'mpv-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: ${bgColor};
      color: ${textColor};
      border: 1px solid ${borderColor};
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: mpv-fade-in 0.3s ease;
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    copyBtn.style.cssText = `
      background: ${btnBg};
      border: 1px solid ${btnBorder};
      color: ${btnColor};
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(message.replace('Copied! Paste in terminal: ', ''));
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy', 1000);
      } catch {}
    };
    toast.appendChild(copyBtn);

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'mpv-fade-out 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  // ==================== Icons ====================

  const MPV_ICON_PATHS = `
    <path d="M8 5v14l11-7z"/>
    <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3z" fill-opacity="0.7"/>
  `;
  const MPV_ICON_SVG_WHITE = `<svg height="24" width="24" viewBox="0 0 24 24" fill="white">${MPV_ICON_PATHS}</svg>`;
  const MPV_ICON_SVG_CURRENT = `<svg height="24" width="24" viewBox="0 0 24 24" fill="currentColor">${MPV_ICON_PATHS}</svg>`;

  // ==================== UI Injection ====================

  const BUTTON_ID = 'mpv-open-btn';

  function injectButton() {
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
      openInMpv();
    });

    controlBar.prepend(btn);
  }

  function removeButton() {
    const btn = document.getElementById(BUTTON_ID);
    if (btn) btn.remove();
  }

  // ==================== Native Menu Injection ====================
  //
  // YouTube renders two menus as its own DOM (not the browser's native
  // context menu), so a userscript can add items to them:
  //   - Right-clicking the player opens `.ytp-contextmenu`.
  //   - Clicking a video row's "⋮" kebab opens a shared `ytd-popup-container`.
  // YouTube currently ships two different component systems for the kebab
  // popup depending on page/experiment (legacy `ytd-menu-popup-renderer` vs
  // newer `yt-list-view-model`), so detection below matches on visible item
  // text / aria-label rather than a single hardcoded tag family.

  const ROW_SELECTOR = 'ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model';

  // Video ID/timestamp for whichever row's kebab was just clicked, captured
  // before the (shared, singleton) popup opens.
  let pendingRowTarget = null;

  function getRowAnchorHref(row) {
    const anchor = row.querySelector('a#thumbnail, a[href*="/watch"]');
    return anchor ? anchor.getAttribute('href') : null;
  }

  document.addEventListener('click', (e) => {
    const kebab = e.target.closest('button[aria-label="Action menu" i], button[aria-label="More actions" i]');
    if (!kebab) return;

    const row = kebab.closest(ROW_SELECTOR);
    const href = row ? getRowAnchorHref(row) : null;
    const videoId = href ? extractVideoIdFromHref(href) : null;

    pendingRowTarget = videoId ? { videoId, timestamp: parseTimestampParam(href) } : null;
  }, true);

  /** Escape closes both `.ytp-contextmenu` and the popup container's dialog. */
  function dismissOpenMenus() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  }

  function buildContextMenuItem(label, onClick) {
    const item = document.createElement('div');
    item.className = 'ytp-menuitem';
    item.setAttribute('role', 'menuitem');
    item.tabIndex = 0;
    item.innerHTML = `
      <div class="ytp-menuitem-icon">${MPV_ICON_SVG_CURRENT}</div>
      <div class="ytp-menuitem-label"></div>
      <div class="ytp-menuitem-content"></div>
    `;
    item.querySelector('.ytp-menuitem-label').textContent = label;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return item;
  }

  /**
   * YouTube sizes `.ytp-contextmenu` (and its `.ytp-panel`/`.ytp-panel-menu`
   * wrappers) with an inline height computed once, at open time, from the
   * original item count. Items appended afterwards would otherwise overflow
   * into an internal scrollbar instead of growing the panel, so re-measure
   * and re-apply the height to all three after inserting our items.
   */
  function growContextMenuToFit(panel) {
    const panelWrap = panel.closest('.ytp-panel');
    const menu = panel.closest('.ytp-contextmenu');
    const newHeight = `${panel.scrollHeight}px`;
    panel.style.height = newHeight;
    if (panelWrap) panelWrap.style.height = newHeight;
    if (menu) menu.style.height = newHeight;
  }

  function maybeInjectContextMenuItems() {
    if (!getConfig('enableNativeMenuItems')) return;

    const panel = document.querySelector('.ytp-contextmenu .ytp-panel-menu');
    if (!panel || panel.dataset.mpvInjected) return;
    if (!/copy video url/i.test(panel.textContent)) return;

    panel.dataset.mpvInjected = 'true';

    panel.appendChild(buildContextMenuItem('Open in MPV', () => {
      openInMpv();
      dismissOpenMenus();
    }));

    panel.appendChild(buildContextMenuItem('Open in MPV at current time', () => {
      const video = document.querySelector('video');
      const currentTime = video ? Math.floor(video.currentTime) : 0;
      openInMpv(getVideoUrl(), currentTime > 0 ? currentTime : null);
      dismissOpenMenus();
    }));

    growContextMenuToFit(panel);
  }

  function buildRowMenuItem(label, onClick) {
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

  function maybeInjectRowMenuItem() {
    if (!getConfig('enableNativeMenuItems')) return;
    if (!pendingRowTarget) return;

    const popup = document.querySelector('ytd-popup-container');
    if (!popup) return;

    const listbox = popup.querySelector('tp-yt-paper-listbox#items, yt-list-view-model');
    if (!listbox || listbox.dataset.mpvInjected) return;
    if (!/add to queue|save to playlist/i.test(listbox.textContent)) return;

    listbox.dataset.mpvInjected = 'true';

    listbox.appendChild(buildRowMenuItem('Open in MPV', () => {
      if (!pendingRowTarget) return;
      openInMpv(getVideoUrl(pendingRowTarget.videoId), pendingRowTarget.timestamp);
      dismissOpenMenus();
    }));
  }

  // ==================== SPA Navigation Detection ====================

  let lastUrl = '';

  function handleUrlChange() {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;

      // Remove old button
      removeButton();

      // Inject new button if on watch page
      if (window.location.pathname.startsWith('/watch')) {
        // Small delay to let YouTube's DOM settle
        setTimeout(injectButton, 500);
      }
    }
  }

  function handleMutations() {
    handleUrlChange();
    maybeInjectContextMenuItems();
    maybeInjectRowMenuItem();
  }

  // MutationObserver for SPA navigation and native menu injection
  const observer = new MutationObserver(handleMutations);
  observer.observe(document.body, { childList: true, subtree: true });

  // Also listen for popstate (back/forward navigation)
  window.addEventListener('popstate', handleUrlChange);

  // ==================== Menu Commands ====================

  GM_registerMenuCommand('Open current video in MPV', () => openInMpv());
  GM_registerMenuCommand('Toggle button visibility', () => {
    const current = getConfig('showButton');
    setConfig('showButton', !current);
    if (!current) {
      injectButton();
    } else {
      removeButton();
    }
  });
  GM_registerMenuCommand('Toggle MPV menu items', () => {
    setConfig('enableNativeMenuItems', !getConfig('enableNativeMenuItems'));
  });

  // ==================== Initialize ====================

  const style = document.createElement('style');
  style.textContent = `
    @keyframes mpv-fade-in {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes mpv-fade-out {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to { opacity: 0; transform: translateX(-50%) translateY(10px); }
    }
    /* Overrides YouTube's "Delhi" redesign, which pads every .ytp-button svg
       (12px 12px) and would otherwise squeeze our fixed-size icon down to a
       sliver. The #id selector outranks that rule's 4 classes regardless of
       stylesheet order. */
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

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'M') {
      e.preventDefault();
      const video = document.querySelector('video');
      const currentTime = video ? Math.floor(video.currentTime) : 0;
      openInMpv(getVideoUrl(), currentTime > 0 ? currentTime : null);
    }
  });

  if (window.location.pathname.startsWith('/watch')) {
    if (document.readyState === 'complete') {
      injectButton();
    } else {
      window.addEventListener('load', injectButton);
    }
  }

})();
