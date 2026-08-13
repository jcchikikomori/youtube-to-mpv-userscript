const MPV_ICON_PATHS = `
  <path d="M8 5v14l11-7z"/>
  <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3z" fill-opacity="0.7"/>
`;

/** Shared across dom.ts (YouTube) and domTwitch.ts (Twitch) — same icon, no site-specific styling. */
export const MPV_ICON_SVG_WHITE = `<svg height="24" width="24" viewBox="0 0 24 24" fill="white">${MPV_ICON_PATHS}</svg>`;
export const MPV_ICON_SVG_CURRENT = `<svg height="24" width="24" viewBox="0 0 24 24" fill="currentColor">${MPV_ICON_PATHS}</svg>`;
