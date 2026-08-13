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
