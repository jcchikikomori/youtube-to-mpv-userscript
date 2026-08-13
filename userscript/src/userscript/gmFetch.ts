import { isLoopbackUrl } from '../baseline/loopback.js';
import type { FetchLike } from '../baseline/types.js';

/**
 * Adapts GM_xmlhttpRequest to the FetchLike shape MpvHandlerClient expects. A plain fetch()
 * from the page context is blocked by the browser's mixed-content check (an https:// page
 * calling http://127.0.0.1) even though mpv-handler.py sends Access-Control-Allow-Origin: *
 * — that header satisfies CORS, but mixed-content is a separate, earlier check. GM_xmlhttpRequest
 * runs with the userscript manager's privileges and isn't subject to it.
 */
export const gmFetch: FetchLike = (url, init) =>
  new Promise((resolve, reject) => {
    const handle = GM_xmlhttpRequest({
      method: 'GET',
      url,
      onload: (response) => {
        // GM_xmlhttpRequest follows redirects by default and isn't subject to normal
        // cross-origin restrictions — re-check the *actual* response origin against the same
        // loopback allowlist the constructor already enforced on the request URL, so a redirect
        // can't turn this privileged transport into an SSRF gadget against another local address.
        if (!isLoopbackUrl(response.finalUrl)) {
          reject(new Error(`response arrived via a non-loopback URL: ${response.finalUrl}`));
          return;
        }
        resolve({
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          text: () => Promise.resolve(response.responseText),
        });
      },
      onerror: () => {
        reject(new Error(`GM_xmlhttpRequest network error requesting ${url}`));
      },
    });

    init?.signal?.addEventListener('abort', () => {
      handle.abort();
      // Mirrors real fetch's behavior of rejecting with signal.reason as-is (a DOMException),
      // exactly like the neverRespondingFetch test helper in MpvHandlerClient.test.ts — this is
      // what lets MpvHandlerClient's existing error.name === 'TimeoutError' check keep working.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      reject(init.signal?.reason);
    });
  });
