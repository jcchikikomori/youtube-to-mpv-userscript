// Ambient declarations for the Tampermonkey GM_* APIs this userscript uses. Hand-rolled rather
// than a dependency (e.g. @types/greasemonkey) — fully controlled, zero supply-chain surface.
// Kept intentionally narrow: only the members gmFetch.ts/config.ts/dom.ts/twitchCookies.ts
// actually read.

interface GMXmlHttpRequestResponse {
  readonly status: number;
  readonly responseText: string;
  /** The URL the response actually arrived from, after following any redirects. */
  readonly finalUrl: string;
}

interface GMXmlHttpRequestDetails {
  method: 'GET' | 'POST';
  url: string;
  headers?: Record<string, string>;
  data?: string;
  onload?: (response: GMXmlHttpRequestResponse) => void;
  onerror?: (response: unknown) => void;
}

interface GMXmlHttpRequestHandle {
  abort(): void;
}

declare function GM_xmlhttpRequest(details: GMXmlHttpRequestDetails): GMXmlHttpRequestHandle;
declare function GM_getValue<T>(name: string, defaultValue: T): T;
declare function GM_setValue(name: string, value: unknown): void;
declare function GM_registerMenuCommand(name: string, onClick: () => void): number;

/**
 * Tampermonkey extension API — not part of the original Greasemonkey spec, so support is
 * uneven across userscript managers. Runs at userscript-manager privilege, so (unlike
 * document.cookie) it can read HttpOnly cookies. Only declared here, never called unguarded —
 * twitchCookies.ts feature-detects `typeof GM_cookie === 'undefined'` before use.
 */
interface GMCookie {
  domain: string;
  name: string;
  value: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  session: boolean;
  /** Seconds since epoch. Absent for session cookies (see `session` instead). */
  expirationDate?: number;
}

interface GMCookieListDetails {
  domain?: string;
  name?: string;
  path?: string;
  url?: string;
}

declare const GM_cookie: {
  list(
    details: GMCookieListDetails,
    listCallback: (cookies: GMCookie[], error: string | null) => void,
  ): void;
};
