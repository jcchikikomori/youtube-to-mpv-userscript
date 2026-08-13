# Twitch

The platform module (steps 1/3/4 below) is implemented — `TwitchSource` supports live channels
(`twitch.tv/<channel>`) and VODs (`twitch.tv/videos/<id>`) and is unit-tested. What's still
open is step 2 (an actual Twitch-page bundle) and forwarding live browser cookies into it for
authenticated/subscriber-only playback — see "What's still open" below.

## Steps

1. ~~Create these files, mirroring `../youtube/`~~ — done: `validation.ts`, `timestamp.ts`,
   `TwitchSource.ts`, `index.ts`. Clips (`clips.twitch.tv/<slug>`) were left out of scope (not
   asked for). `extractTwitchVodId` deliberately only recognizes the `/videos/<id>` URL form,
   never a bare numeric string — a bare digit string is ambiguous with an all-digit channel
   name (Twitch allows those), so accepting it would have broken the
   `supports()`/`resolveUrl()` non-disagreement invariant.
2. **Still open.** Wire it up in an actual Twitch-page userscript: `src/userscript/main.ts`
   only ever constructs a single `YoutubeSource` directly — it's a single-site bundle. A Twitch
   userscript needs its own bundle (`src/userscript-twitch/` entry + its own `tsup.config.ts`
   entry, `metadata.txt` with `@match` for `twitch.tv` and a new `@grant GM_cookie`), plus the
   actual "Open in MPV" button/menu-item DOM injection on Twitch's live player. This needs real
   trial-and-error against Twitch's actual markup (the same way YouTube's own `dom.ts` did) and
   a live browser session to verify — tracked as a follow-up issue, not done here.
3. ~~Re-export it from the library root~~ — done, in `src/index.ts`.
4. ~~Add tests~~ — done: `validation.test.ts`, `timestamp.test.ts`, `TwitchSource.test.ts`.

## What's still open

- **Twitch-page bundle** (step 2 above) — deferred, needs a live browser session.
- **Live cookie forwarding** — the transport (`MpvHandlerClient`/`AbstractVideoSource`) and
  `mpv-handler.py` already support an optional `cookies` payload end-to-end (see
  `src/baseline/cookies.ts`), so subscriber-only content can play once something supplies
  cookies. What's missing is the Twitch-page side: calling `GM_cookie.list({ domain:
'twitch.tv' })` and passing the result into `TwitchSource.open(input, { cookies })`. That
  call belongs in the step-2 bundle above, not in this platform module — `GM_cookie` is a
  browser/DOM-context API with uneven support across userscript managers, needs
  feature-detection and a real page to verify against.

## What should NOT change

- `src/baseline/**` — the HTTP client has no notion of "platform" and shouldn't gain one.
- `src/contracts/**` — the `VideoSource` interface and `AbstractVideoSource` template method
  already cover everything a live-stream-vs-VOD distinction needs (`resolveUrl()` can return a
  channel's live URL or a VOD URL — mpv/yt-dlp handles both the same way once it has a URL).
- `src/platforms/youtube/**` — no cross-platform sharing beyond what's already in `contracts/`.
