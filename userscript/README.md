# userscript

TypeScript source for `youtube-to-mpv.user.js`. `npm run build` bundles it into a single,
dependency-free `dist/youtube-to-mpv.user.js` — that file, not anything hand-edited, is what
Tampermonkey installs (via the `@updateURL`/`@installURL` in its metadata block, pointing at this
path on GitHub's raw content host).

```
baseline/      -> talks to mpv-handler.py over HTTP, knows nothing about video platforms or the DOM
contracts/     -> VideoSource interface + AbstractVideoSource template method
platforms/     -> youtube/ and twitch/ platform modules (URL validation + timestamp parsing)
userscript/    -> the actual browser entry point — ONE bundle, both sites: main.ts branches on
                  location.hostname and wires up the matching platform source + DOM module
                  (dom.ts for YouTube, domTwitch.ts for Twitch — see domTwitch.ts's own doc
                  comments for why it has no menu-injection code, unlike dom.ts)
```

`baseline/` and `contracts/`/`platforms/` are transport- and DOM-agnostic on purpose — they're
reusable pieces, not dead architecture kept "for later." Both `dom.ts` and `domTwitch.ts` compose
the exact same `MpvHandlerClient`/`AbstractVideoSource` and just add their own platform module +
DOM wiring — `main.ts` picks which pair to use per page load.

## Requirements

- Node.js >= 20 to **develop** this package — `vitest`/`happy-dom` (devDependencies) require it.
- Any Tampermonkey/Greasemonkey-compatible userscript manager to **run** the built output — the
  bundle itself has no Node dependency at all once built.
- `mpv-handler.py` running locally (see the repo root README) and a real `mpv` install, for
  anything beyond the unit tests.

## Build & install

```bash
npm install
npm run build
```

Then, in Tampermonkey: **Utilities → Import from file** → `dist/youtube-to-mpv.user.js`, or drag
the file into a browser tab (Tampermonkey intercepts `.user.js` files and offers to install).
Once published, `dist/youtube-to-mpv.user.js` is also the file this repo hosts on
raw.githubusercontent.com for one-click install/update — see the root README's Installation
section.

### Testing build (side-by-side install)

```bash
npm run build:test
```

Produces `dist/youtube-to-mpv.test.user.js` — unminified, with a source map, `@name` suffixed
`(Testing)`, and no `@updateURL`/`@installURL`. Installing it in Tampermonkey adds it as a
**separate** script next to the real one (Tampermonkey keys installed scripts off `@name` +
`@namespace`) instead of overwriting it, and since it has no update URLs, Tampermonkey will never
silently pull the published version back over your local test copy. Both `npm run build` and
`npm run build:test` can be run in either order without clobbering each other's output file.

## Why a bundler for a userscript

Tampermonkey userscripts must ship as one dependency-free file — that constraint doesn't go away,
it just moves from "hand-write one file" to "let tsup produce one file." Writing the source as
normal ESM modules (this repo's existing TypeScript convention) means:

- The DOM/UI code, the HTTP client, and the YouTube/Twitch validation logic can be unit tested
  in isolation (238 tests, `npm test`), instead of only being checkable by hand in a real browser.
- `MpvHandlerClient` reuses its existing `fetchImpl` injection seam for a
  `GM_xmlhttpRequest`-backed adapter (`userscript/gmFetch.ts`) instead of a raw `fetch()` — a
  page running on `https://` calling `http://127.0.0.1:38421` hits the browser's mixed-content
  check even though the handler already sends `Access-Control-Allow-Origin: *` (that header
  satisfies CORS; mixed-content is a separate, earlier check). `GM_xmlhttpRequest` runs with the
  userscript manager's privileges and isn't subject to it.

## Adding a new platform

[`src/platforms/twitch/`](src/platforms/twitch/README.md) is a worked, complete example end to
end: a platform module implementing `VideoSource` (by extending `AbstractVideoSource`, which
already provides `open()`) plus its own DOM wiring (`src/userscript/domTwitch.ts`) — both
composing the same `MpvHandlerClient`, with zero changes needed under `src/baseline/` or
`src/contracts/`. Unlike YouTube's `dom.ts`, `domTwitch.ts` has no menu-injection code at all —
Twitch doesn't override the browser's native right-click menu and its stream cards have no
kebab/options button, so there's nothing to inject into (confirmed against real twitch.tv, see
its README and the repo root `CLAUDE.md`'s "Twitch DOM Handling" section). Check that early for
any new platform — don't assume every site has YouTube's menu surfaces.

Wiring a new platform into the single unified bundle means: add `<Platform>Source extends
AbstractVideoSource`, add `dom<Platform>.ts` mirroring `domTwitch.ts`'s shape, add its
`@match`/`@grant` lines to `metadata.txt`, and add a branch in `main.ts`'s
`location.hostname` dispatch. No new `tsup.config.ts` entry or separate bundle needed — this
repo deliberately ships one script matching every supported site rather than one script per
site (see the repo root `CLAUDE.md`'s Project Overview).

Cookie forwarding for authenticated/subscriber-only playback is already plumbed all the way
through `MpvHandlerClient`/`AbstractVideoSource`/`mpv-handler.py` (see `src/baseline/cookies.ts`
and the repo root `CLAUDE.md`'s "MPV Launch Strategy" section) — a new platform module just
needs its own `<platform>Cookies.ts` (mirroring `twitchCookies.ts`) with the domain filter
**hardcoded** to that platform's own domain, never parametrized — that's what keeps different
platforms' cookies from ever being combined in one request.

## Scripts

| Script               | What it does                                                                  |
| -------------------- | ----------------------------------------------------------------------------- |
| `npm run build`      | Bundles `src/userscript/main.ts` to `dist/youtube-to-mpv.user.js` via tsup    |
| `npm run build:test` | Same, to `dist/youtube-to-mpv.test.user.js` — see Testing build above         |
| `npm run typecheck`  | `tsc --noEmit`                                                                |
| `npm run lint`       | ESLint, including the `no-restricted-imports` guard against `child_process`   |
| `npm test`           | vitest (happy-dom) — mocked `GM_*`/`fetch`, no live handler or browser needed |
| `npm run format`     | `prettier --check .`                                                          |
| `npm run verify`     | typecheck && lint && test && build, in that order                             |

## Manual smoke test

The unit test suite mocks `GM_xmlhttpRequest`/`GM_getValue`/etc. and never talks to a live
handler or real YouTube/Twitch page — it proves the pieces behave correctly in isolation, not
that mpv actually launches from a real browser, and not that a real Tampermonkey install's
`GM_cookie`/Trusted-Types behavior matches this repo's assumptions (see the repo root
`CLAUDE.md`'s Testing section for exactly what has and hasn't been verified this way already).
Run this checklist against the real `mpv-handler.py` (see the repo root README) before relying
on a change:

**YouTube:**

1. `npm run build`, then install `dist/youtube-to-mpv.user.js` into Tampermonkey from disk.
2. Start `mpv-handler.py`.
3. Open `https://www.youtube.com/watch?v=eYT5mlLPS0Q` — the mpv icon should appear in the player
   controls; clicking it should open mpv.
4. `Ctrl+Shift+M` should do the same, starting at the current playback position if paused/seeked.
5. Right-click the player — "Open in MPV" and "Open in MPV at current time" should appear and
   work (skip any pre-roll/mid-roll ad first; YouTube shows a reduced menu during ads that this
   script correctly skips).
6. Open a video row's "⋮" kebab menu (home/search/sidebar) — "Open in MPV" should appear and
   work.
7. Toggle OS/browser dark mode and confirm the toast colors adapt.
8. Stop `mpv-handler.py`, retry step 3 — a warning toast should report the handler is offline and
   copy an equivalent `mpv '<url>' --start=N` command to the clipboard.
9. On Windows, also check `%TEMP%\mpv-handler.log` for the repo's known Windows Defender caveat
   (documented in the repo root `CLAUDE.md`/`README.md`) — the HTTP call can succeed while mpv
   silently never launches.

**Twitch:**

1. With the handler running, open any live channel (`https://www.twitch.tv/<channel>`) — hover
   the player to reveal its controls; the mpv icon should appear alongside settings/fullscreen.
2. Click it — mpv should open the live stream. Confirm no "Open in MPV" appears on right-click
   or on a stream card's area (there's nothing to right-click/kebab into — see "Twitch DOM
   Handling" in the repo root `CLAUDE.md`).
3. Open a VOD (`https://www.twitch.tv/videos/<id>`), let it play a bit, then `Ctrl+Shift+M` —
   mpv should open at roughly the current playback position.
4. Navigate to a non-watchable Twitch page (e.g. `/directory`) — the icon should not appear (or
   should disappear if it was showing on a previous channel/VOD page beforehand).
5. If you have a Twitch login and access to subscriber-only content, confirm it actually plays
   (proves `GM_cookie.list()`'s real field shape matches `twitchCookies.ts`'s assumptions — this
   is the one piece genuinely unverified without a live Tampermonkey session with real cookies).
