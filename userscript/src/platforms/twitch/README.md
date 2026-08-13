# Twitch

Fully implemented and wired up: `TwitchSource` supports live channels (`twitch.tv/<channel>`)
and VODs (`twitch.tv/videos/<id>`); the userscript bundle (`src/userscript/main.ts` +
`domTwitch.ts`) injects an "Open in MPV" button into Twitch's real player controls and forwards
live browser cookies for authenticated/subscriber-only playback. See the repo root `CLAUDE.md`'s
"Twitch DOM Handling" section for the concrete DOM selectors and — importantly — for the two
YouTube features that have **no** Twitch equivalent (right-click menu, row kebab menu) and why.

## Steps (all done)

1. `validation.ts`, `timestamp.ts`, `TwitchSource.ts`, `index.ts` — mirroring `../youtube/`.
   Clips (`clips.twitch.tv/<slug>`) were left out of scope (not asked for). `extractTwitchVodId`
   deliberately only recognizes the `/videos/<id>` URL form, never a bare numeric string — a
   bare digit string is ambiguous with an all-digit channel name (Twitch allows those), so
   accepting it would have broken the `supports()`/`resolveUrl()` non-disagreement invariant.
2. Wired up in the userscript: `src/userscript/main.ts` branches on `location.hostname` and
   constructs `TwitchSource` + `src/userscript/domTwitch.ts` on the Twitch path (`YoutubeSource`
   + `dom.ts` on the YouTube path) — one bundle, both sites, not a separate `userscript-twitch/`
   entry. `domTwitch.ts` injects the button into `.player-controls__right-control-group`
   (confirmed against a real live Twitch channel) and has **no** menu-injection code at all,
   unlike `dom.ts` — see its own doc comments for why (Twitch doesn't override the browser's
   native right-click menu, and its stream preview cards have no kebab/options button).
   `metadata.txt` carries `@match` for `twitch.tv`/`www.twitch.tv`/`m.twitch.tv` and
   `@grant GM_cookie`.
3. Re-exported from the library root, in `src/index.ts`.
4. Tests: `validation.test.ts`, `timestamp.test.ts`, `TwitchSource.test.ts`, plus
   `domTwitch.test.ts`/`twitchCookies.test.ts` under `src/userscript/`.

**Live cookie forwarding**: `src/userscript/twitchCookies.ts` calls
`GM_cookie.list({ domain: 'twitch.tv' })` — hardcoded, not a parameter, so a future platform's
cookie feature can never accidentally reuse this call and blur the two platforms' cookie sets
together — and feeds the result into `TwitchSource.open(input, { cookies })`. The transport
(`MpvHandlerClient`/`AbstractVideoSource`) and `mpv-handler.py` already supported an optional
`cookies` payload end-to-end before this (see `src/baseline/cookies.ts`); this is what actually
supplies it on the Twitch path.

**Genuinely still unverified** (needs a real Tampermonkey install, not this repo's scripted
real-browser check — see the repo root `CLAUDE.md`'s Testing section): `GM_cookie.list()`'s
actual field shape in a real Tampermonkey runtime (this module's mapping in `twitchCookies.ts`
is written to the documented API shape, not observed live), and that subscriber-only content
actually plays end-to-end through mpv/yt-dlp given those cookies.

## What should NOT change

+ `src/baseline/**` — the HTTP client has no notion of "platform" and shouldn't gain one.
+ `src/contracts/**` — the `VideoSource` interface and `AbstractVideoSource` template method
  already cover everything a live-stream-vs-VOD distinction needs (`resolveUrl()` can return a
  channel's live URL or a VOD URL — mpv/yt-dlp handles both the same way once it has a URL).
+ `src/platforms/youtube/**` — no cross-platform sharing beyond what's already in `contracts/`.
