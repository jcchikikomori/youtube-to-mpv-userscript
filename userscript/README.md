# userscript

TypeScript source for `youtube-to-mpv.user.js`. `npm run build` bundles it into a single,
dependency-free `dist/youtube-to-mpv.user.js` — that file, not anything hand-edited, is what
Tampermonkey installs (via the `@updateURL`/`@installURL` in its metadata block, pointing at this
path on GitHub's raw content host).

```
baseline/      -> talks to mpv-handler.py over HTTP, knows nothing about video platforms or the DOM
contracts/     -> VideoSource interface + AbstractVideoSource template method
platforms/     -> youtube/ (implemented), twitch/ (recipe only, see platforms/twitch/README.md)
userscript/    -> the actual browser entry point: DOM/menu injection, GM_xmlhttpRequest transport
                  adapter, clipboard fallback — wires baseline/contracts/platforms into main.ts
```

`baseline/` and `contracts/`/`platforms/` are transport- and DOM-agnostic on purpose — they're
reusable pieces, not dead architecture kept "for later." The `userscript/` layer is the only
consumer today, but a hypothetical second browser bundle (e.g. Twitch) would compose the exact
same baseline client and just add its own platform module + entry point.

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

- The DOM/UI code, the HTTP client, and the YouTube validation logic can be unit tested in
  isolation (132 tests, `npm test`), instead of only being checkable by hand in a real browser.
- `MpvHandlerClient` reuses its existing `fetchImpl` injection seam for a
  `GM_xmlhttpRequest`-backed adapter (`userscript/gmFetch.ts`) instead of a raw `fetch()` — a
  page running on `https://` calling `http://127.0.0.1:38421` hits the browser's mixed-content
  check even though the handler already sends `Access-Control-Allow-Origin: *` (that header
  satisfies CORS; mixed-content is a separate, earlier check). `GM_xmlhttpRequest` runs with the
  userscript manager's privileges and isn't subject to it.

## Adding a new platform

See [`src/platforms/twitch/README.md`](src/platforms/twitch/README.md) for the concrete,
step-by-step recipe (written against Twitch specifically, as the next platform planned). In
short: implement `VideoSource` (typically by extending `AbstractVideoSource`, which already
provides `open()`), reusing the same `MpvHandlerClient`. Nothing under `src/baseline/` or
`src/contracts/` needs to change. A second userscript bundle would get its own
`src/userscript-<platform>/main.ts` entry and its own `tsup.config.ts` entry — the DOM/UI layer
here is YouTube-page-specific and isn't meant to be shared across platforms.

## Scripts

| Script              | What it does                                                              |
| ------------------- | -------------------------------------------------------------------------- |
| `npm run build`     | Bundles `src/userscript/main.ts` to `dist/youtube-to-mpv.user.js` via tsup |
| `npm run build:test`| Same, to `dist/youtube-to-mpv.test.user.js` — see Testing build above     |
| `npm run typecheck` | `tsc --noEmit`                                                              |
| `npm run lint`      | ESLint, including the `no-restricted-imports` guard against `child_process`|
| `npm test`          | vitest (happy-dom) — mocked `GM_*`/`fetch`, no live handler or browser needed |
| `npm run format`    | `prettier --check .`                                                       |
| `npm run verify`    | typecheck && lint && test && build, in that order                          |

## Manual smoke test

The unit test suite mocks `GM_xmlhttpRequest`/`GM_getValue`/etc. and never talks to a live
handler or real YouTube page — it proves the pieces behave correctly in isolation, not that mpv
actually launches from a real browser. Run this checklist against the real `mpv-handler.py` (see
the repo root README) before relying on a change:

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
