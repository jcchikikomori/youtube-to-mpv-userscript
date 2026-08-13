// Ambient declarations for the Tampermonkey GM_* APIs this userscript uses. Hand-rolled rather
// than a dependency (e.g. @types/greasemonkey) — five signatures, fully controlled, zero
// supply-chain surface. Kept intentionally narrow: only the members gmFetch.ts/config.ts/dom.ts
// actually read.

interface GMXmlHttpRequestResponse {
  readonly status: number;
  readonly responseText: string;
}

interface GMXmlHttpRequestDetails {
  method: 'GET';
  url: string;
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
