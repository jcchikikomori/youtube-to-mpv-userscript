// ==UserScript==
// @name         YouTube to MPV
// @namespace    https://github.com/your-username/youtube-to-mpv-userscript
// @version      0.1.0
// @description  Open YouTube videos directly in MPV media player via system protocol handlers
// @author       John Cyrill Corsanes
// @match        https://www.youtube.com/watch*
// @match        https://youtube.com/watch*
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

  function getVideoUrl() {
    const videoId = getVideoId();
    if (!videoId) return null;

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    return isValidYoutubeUrl(url) ? url : null;
  }

  function getPlaylistId() {
    const urlMatch = window.location.search.match(/[?&]list=([^&]+)/);
    return urlMatch ? urlMatch[1] : null;
  }

  // ==================== MPV Launch ====================

  const HANDLER_URL = 'http://127.0.0.1:38421';

  async function openInMpv() {
    const videoUrl = getVideoUrl();
    if (!videoUrl) {
      console.error('[YouTube to MPV] Could not extract video URL');
      showToast('Failed to extract video URL', 'error');
      return;
    }

    try {
      GM_xmlhttpRequest({
        method: 'GET',
        url: `${HANDLER_URL}/play?url=${encodeURIComponent(videoUrl)}`,
        onload: (response) => {
          if (response.status === 200) {
            showToast('Opening in MPV...', 'success');
          } else {
            fallbackToClipboard(videoUrl);
          }
        },
        onerror: () => {
          fallbackToClipboard(videoUrl);
        }
      });
    } catch {
      fallbackToClipboard(videoUrl);
    }
  }

  async function fallbackToClipboard(videoUrl) {
    const mpvPath = getConfig('mpvPath');
    const isWindows = getPlatform() === 'windows';
    const command = isWindows
      ? `${mpvPath} "${videoUrl}"`
      : `${mpvPath} '${videoUrl}'`;

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
    btn.innerHTML = `
      <svg height="24" width="24" viewBox="0 0 24 24" fill="white">
        <path d="M8 5v14l11-7z"/>
        <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3z" fill-opacity="0.7"/>
      </svg>
    `;
    btn.style.cssText = `
      padding: 0 8px;
      min-width: auto;
      display: flex;
      align-items: center;
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

  // MutationObserver for SPA navigation
  const observer = new MutationObserver(handleUrlChange);
  observer.observe(document.body, { childList: true, subtree: true });

  // Also listen for popstate (back/forward navigation)
  window.addEventListener('popstate', handleUrlChange);

  // ==================== Menu Commands ====================

  GM_registerMenuCommand('Open current video in MPV', openInMpv);
  GM_registerMenuCommand('Toggle button visibility', () => {
    const current = getConfig('showButton');
    setConfig('showButton', !current);
    if (!current) {
      injectButton();
    } else {
      removeButton();
    }
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
  `;
  document.head.appendChild(style);

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'M') {
      e.preventDefault();
      openInMpv();
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
