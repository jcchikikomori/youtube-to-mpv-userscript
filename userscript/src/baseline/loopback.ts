/** `new URL(...).hostname` for an IPv6 literal includes the brackets, e.g. "[::1]". */
const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * SSRF guard for the handler base URL: checked against a literal hostname allowlist,
 * never resolved via DNS. Resolve-then-check would open a DNS-rebinding/TOCTOU gap where
 * a hostname could resolve to loopback at check time and something else at request time.
 * Port is unrestricted — only the host is locked down, so tests can use an ephemeral port.
 */
export function assertLoopbackUrl(rawUrl: string): void {
  const parsed = new URL(rawUrl);

  if (parsed.protocol !== 'http:') {
    throw new RangeError(`mpv-handler base URL must use http:, got "${parsed.protocol}"`);
  }
  if (parsed.username || parsed.password) {
    throw new RangeError('mpv-handler base URL must not contain credentials');
  }
  if (!LOOPBACK_HOSTNAMES.has(parsed.hostname)) {
    const allowed = [...LOOPBACK_HOSTNAMES].join(', ');
    throw new RangeError(
      `mpv-handler base URL host must be loopback (one of ${allowed}), got "${parsed.hostname}"`,
    );
  }
}

/**
 * Non-throwing form of assertLoopbackUrl — used to re-check a response's *final* URL after a
 * possible redirect (GM_xmlhttpRequest follows redirects by default and isn't subject to the
 * browser's own cross-origin restrictions, so without this a redirect could turn the privileged
 * transport into an SSRF gadget against an arbitrary local/internal address).
 */
export function isLoopbackUrl(rawUrl: string): boolean {
  try {
    assertLoopbackUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}
