# Feature: Voice input for Ask Atlas

**From build-plan:** feature 25

**Status:** verified

## Goal

Let a user dictate an Ask Atlas question instead of typing it. A mic button in the composer starts the browser's speech recognition, the words appear in the composer as they are spoken, and the user confirms or cancels, then sends through the existing Ask flow. Where the browser has no speech recognition, the mic is simply absent rather than a dead control.

This removes the biggest friction on a phone, where typing a place name or postcode is slow, and it matches the voice affordance people already expect from ChatGPT and Grok: one tap to start, a live transcript that keeps growing while you speak, and a clear cancel / confirm pair to end the session.

## Design reference

No mockup. The reference is the app's own composer at `src/components/ask/AskAtlasComposer.tsx` plus the voice-entry pattern shared by ChatGPT, Grok, and the `assistant-ui` dictation adapter: `continuous: true` with `interimResults: true`, a session the user ends (not a pause), and a cancel / confirm pair while recording. The composer keeps the same `touch-target` 44px sizing, rounded shape, and the app's green accent (`#008751` / `#0F7B4D`, `#10B981` in dark); the recording state uses the app's existing red (`#EF4444`) as in the clear dialog, not a new palette. This is a refinement of an existing surface, not a new screen.

## In scope

- A mic button in `AskAtlasComposer`, shown only where the browser exposes speech recognition.
- A client-only speech layer: the Web Speech API type surface, feature detection, and a hook that wraps one recognizer (start, stop, interim and final transcripts, errors, cleanup).
- Live dictation into the composer: the transcript appears as it is spoken and keeps growing, with no auto-send; the user ends the session explicitly.
- Continuous listening: recognition stays live across pauses and only ends when the user stops it, matching ChatGPT and Grok.
- A cancel / confirm pair while dictating: cancel discards the transcript and restores the composer exactly as it was; confirm commits the whole transcript into the composer for review and sending.
- A visible, announced (aria-live) listening state with a recording animation, reduced-motion aware.
- A soft synthesized earcon on record start and on record stop, so the session is audible without looking at the screen, as in Grok.
- An auto-growing composer that wraps long dictated text and grows upward instead of scrolling sideways.
- Recognition language follows the Ask Atlas language mode: Auto and English use `en-NG`, Yoruba `yo-NG`, Hausa `ha-NG`, Igbo `ig-NG`.
- Predictable shutdown: recognition stops on commit, cancel, send, panel close, clear-conversation, unmount, and when the language mode changes while listening.
- Readable, inline error handling for denied permission, no speech, and network failure; the composer stays usable and Send still works afterwards.
- Vitest coverage for the pure speech helpers.

## Out of scope

- **Server transcription.** Recording audio with `MediaRecorder` and POSTing it to a new endpoint is the fallback for browsers without the Web Speech API, and it is a separate slice (new route, provider cost, audio handling). This feature ships the browser-native path only.
- **Text-to-speech.** Reading replies aloud is a different capability.
- **A mute or volume setting for the cues.** The earcons are short and low gain and only fire on a tap; a preference toggle is a later addition, not this slice.
- **Auto-send on confirm or on silence.** Confirm commits the transcript to the composer; the user sends.
- **Auto-send or auto-stop on a pause.** ChatGPT and Grok keep listening until the user stops; so does this.
- **Editing the transcript while dictating.** The composer is read-only during dictation, then editable after confirm, which keeps the transcript from fighting a caret.
- **Voice anywhere else.** The composer only; no voice for search fields, the Hunt, or the assembly engine.
- **Any change to the ask flow, providers, server, routes, or stored shape.** The transcript becomes ordinary composer text.
- **Storing audio.** No audio is captured, saved, or sent through our server. The browser vendor's speech service handles recognition, as it does on any site using this API.

## Build loop

Small steps, each reviewed before the next. `/implement` ticks the steps off here as it finishes them, so a fresh session resumes from the first unchecked one.

## Build steps

- [x] **Step 1 - Speech types and pure helpers** - add `src/types/speech-recognition.d.ts` with the minimal ambient `SpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent`, `SpeechRecognitionResultList`, and `SpeechRecognitionAlternative` declarations plus the `Window` members (`SpeechRecognition` and `webkitSpeechRecognition`), because `lib.dom` does not ship them and no dependency will be added. Add `src/lib/ask/speech.ts` with `speechLanguageTag(mode: LanguageMode): string` (Auto and English to `en-NG`, Yoruba `yo-NG`, Hausa `ha-NG`, Igbo `ig-NG`) and `hasSpeechRecognition(win: Pick<Window, 'SpeechRecognition'> & { webkitSpeechRecognition?: unknown }): boolean` (true when either constructor is a function). Add `src/lib/ask/speech.test.ts` covering every `LanguageMode` to its tag and the capability check for both prefixed and unprefixed constructors and for neither. *Done when:* `npm run test` passes with the new suite and the running app is unchanged.

- [x] **Step 2 - The `useSpeechRecognition` hook** - add `src/hooks/useSpeechRecognition.ts`. It takes a `lang` string, feature-detects on the client, and returns `{ supported, listening, transcript, interim, error, start, stop }`. It constructs one recognizer, sets `lang`, `continuous: false`, and `interimResults: true`, routes `onresult` interim versus final results into `interim` and the accumulated `transcript`, maps `onerror` codes to a small error union (at least `permission`, `no-speech`, `network`, `other`), treats an `aborted` error as a silent user or programmatic stop rather than a surfaced error, wraps `start` in a try/catch so a throwing recognizer surfaces an error instead of breaking render, clears `interim` on `onend`, and aborts and drops handlers on unmount. `start` is a no-op when unsupported or already listening; `stop` is idempotent. *Done when:* the hook compiles clean under `npm run lint` and the app is unchanged because nothing consumes it yet.

Note: the hook is internal until Step 3 wires it, so this step's evidence is the typecheck rather than runtime behavior.

- [x] **Step 3 - The mic button and live dictation** - in `AskAtlasComposer` add props `micSupported`, `listening`, `onToggleMic`, and an optional `micError`; render a mic button before Send only when `micSupported`, with `aria-label` toggling between `Start voice input` and `Stop voice input`, the `touch-target` class, and a `Mic`/`Square` (or `MicOff`) icon from `lucide-react`. In `AskAtlasPanel` consume the hook, remember the composer text at the moment dictation starts as the base, show base plus interim (plus any committed transcript) in the field while listening, and set the field to base plus final transcript when recognition ends; a dictation that captures no text leaves the field exactly as it was, so a stray tap never erases typed input. The mic button mirrors the composer's busy state, disabled while a reply is in flight, the same as Send. Stop recognition in `handleSend` before sending and when the panel closes, and never auto-send. *Done when:* at 390x844 and at desktop, tapping the mic enters a listening state, dictated words appear in the field, Send submits them through the existing flow, and the mic button is absent for a browser without the API.

- [x] **Step 4 - Language mapping, error states, and shutdown** - derive the recognition tag from the current language mode with `speechLanguageTag` (Auto and English `en-NG`, Yoruba/Hausa/Igbo the matching `-NG` tag); changing the chip while listening stops recognition and the new tag applies the next time. Stop recognition on clear-conversation and on unmount as well as on send and close. Add an inline `aria-live="polite"` status for the listening state and for errors, with plain copy for denied permission, no speech, and network failure (for example `Microphone access was blocked`, `No speech heard`, `Voice input is unavailable right now`), and keep the composer and Send usable after any error. *Done when:* dictation uses the `-NG` tag that matches the selected language, switching the chip cancels an active dictation, a denied permission shows readable copy and leaves the composer usable, and closing or clearing the conversation stops the mic.

- [x] **Step 5 - Sweep and evidence** - confirm the mic is absent (not disabled) where the API is missing; that recognition state lives only in the composer/panel and no second recognizer can run; that no server, route, endpoint, env var, or stored shape changed; and that the input still meets the `<=768px` 16px rule. Capture browser evidence with a scratch Playwright probe in system Chrome, deleted before `/complete`: with an injected fake `webkitSpeechRecognition` that emits an interim result and then a final one, prove the field fills and Send submits; in a context with the constructors removed, prove the mic is absent; check the listening state and that closing the panel stops it. *Done when:* `npm run test && npm run lint && npm run build` passes and the probe results are recorded for the completion archive.

## Revision 1 - ChatGPT and Grok voice UX

Review feedback: the first build stopped the microphone as soon as the speaker paused, had no way to discard a misheard transcript, and grew the single-line input sideways. ChatGPT and Grok keep listening until the user stops, show a cancel / confirm pair while recording, and grow the composer as the text arrives. These steps close that gap. Steps 1-5 stand; the replacement behavior is described here.

- [x] **Step 6 - Continuous, user-stopped dictation (hook)** - change `src/hooks/useSpeechRecognition.ts` so a session runs with `continuous: true` and `interimResults: true` and ends only when the user stops it. Track an internal "the user wants to listen" flag: on `onstart` set `listening`; on a browser-initiated `onend` (Chrome still ends a continuous session after a long silence), restart the recognizer while that flag is set, so a pause never ends dictation; on `stop()` clear the flag, detach the handlers first, and call `abort()` so no trailing result arrives. An `onerror` still clears the flag, stops, and surfaces the mapped error, so a denied mic or a missing device cannot loop restarts. `start` stays a no-op when unsupported or already live; `stop` stays idempotent; a language change still stops the session. Keep the returned shape `{ supported, listening, transcript, interim, error, start, stop }`. *Done when:* the hook compiles under `npm run lint`, a simulated pause restarts rather than ends the session, and any error ends it without looping.

- [x] **Step 7 - Cancel / confirm cluster and a live transcript (composer + panel)** - in `AskAtlasComposer` replace the single mic toggle with the recording pattern: while not listening, the mic and Send buttons as today; while listening, a small recording indicator plus a cancel (X) and a confirm (check) button, with Send hidden. Labels: `Start voice input`, `Cancel voice input`, `Confirm voice input`. In `AskAtlasPanel` stop writing the transcript into `input` during dictation. Instead show a read-only preview composed from the captured base text plus the final transcript plus the interim text, and only on confirm write the composed text back into `input` (focusing it) and stop; on cancel stop and leave `input` exactly as it was, so a misheard phrase is discarded and typed text is never lost. Nothing auto-sends. Add `composeDictation(base, transcript, interim)` to `src/lib/ask/speech.ts` for the join (a single space where the base does not already end in whitespace, no double space) with unit tests. Keep every existing shutdown point stopping the session (send, close, clear, unmount, language change). *Done when:* at 390x844 and desktop, dictating shows live text, X discards it and restores the prior composer text, check commits the whole transcript and Send submits it, and Send is not offered while dictating.

- [x] **Step 8 - An auto-growing composer** - replace the single-line `<input type="text">` in `AskAtlasComposer` with a `<textarea rows={1}>` that wraps and grows upward with its content up to a capped height (about five lines) and then scrolls internally, so dictated or typed text is never hidden to the right. Enter submits on a fine pointer and inserts a newline on a coarse pointer (touch keyboards), and Shift+Enter always inserts a newline. Keep the existing `aria-label`, placeholder, focus behavior, and the `<=768px` 16px rule (already covers `textarea`). The panel's `inputRef` becomes a `HTMLTextAreaElement`. *Done when:* a long sentence wraps to multiple lines with no horizontal scrolling at 390x844, the composer grows and stops at the cap, Enter sends on desktop, and the mobile zoom rule still applies.

- [x] **Step 9 - Audible start and stop cues** - add `src/lib/ask/voiceCues.ts`, a small Web Audio layer that plays a short earcon when a dictation session opens and a lower one when it ends, matching the sound Grok plays on record start / stop. Synthesize the tones with `OscillatorNode` plus a short attack / release envelope (no audio asset, no fetch, no dependency). Expose `primeVoiceCues()` (create or resume the `AudioContext` inside the user's tap so the browser autoplay policy does not block the cue) and `playVoiceCue('start' | 'stop')`, both best effort: a browser without the API or with audio blocked returns silently and never affects dictation. Wire the start cue into the hook's `start` and the stop cue into every session end (the hook's `stop`, and an `onerror` that ends a live session), so a cancel, a confirm, a send, a close, a clear, a language change, and an error all sound the same stop cue. Keep the pure note table exposed as `cueNotes` and unit test that the start cue is a rising two-note pair, the stop cue is a single lower note, and every note has a positive frequency and duration. *Done when:* `npm run test` covers `cueNotes`, and a real-mic Try pass hears a soft rising tone on start and a lower tone on stop with no asset fetched.

- [x] **Step 10 - Recording animation, sweep, and evidence** - add the listening animation in `src/index.css` as a small equalizer (a few bars with a staggered `@keyframes`), relying on the existing global `prefers-reduced-motion` rule so it stops for users who ask it to. Sweep: confirm the mic is still absent without the API, the recording state is announced, no server, route, endpoint, env var, or stored shape changed, and the composer still meets the 16px rule. Re-run the scratch Playwright probe and extend the fake `webkitSpeechRecognition` to emit several interim results and a late final one with no `onend`, proving live growth and that silence alone does not end the session; then drive cancel (composer restored) and confirm (transcript committed and Send works). *Done when:* `npm run test && npm run lint && npm run build` passes and the probe results are recorded for the completion archive.

## Files / areas

- `src/types/speech-recognition.d.ts` (new) - minimal ambient Web Speech API surface, since `lib.dom` omits it.
- `src/lib/ask/speech.ts` and `src/lib/ask/speech.test.ts` (new) - the language tag and capability helpers, plus the dictation join, with their test.
- `src/lib/ask/voiceCues.ts` and `src/lib/ask/voiceCues.test.ts` (new) - the Web Audio start / stop earcons and their pure note-table test.
- `src/hooks/useSpeechRecognition.ts` (new) - the recognizer wrapper, the continuous restart, and the cue wiring.
- `src/components/ask/AskAtlasComposer.tsx` - the auto-growing textarea, the mic button, the recording indicator, the cancel / confirm pair, and the error copy props.
- `src/components/ask/AskAtlasPanel.tsx` - owns input and language, so it wires the hook, the live transcript preview, the cancel / confirm handlers, and the shutdown points.
- `src/index.css` - the listening equalizer keyframe. It picks up the existing global `prefers-reduced-motion` rule, so no second reduced-motion guard is needed.

## Data / contracts

- **Client only.** No server, route, API endpoint, env var, dependency, or stored shape changes. Nothing here touches `postcodeClient`, the dataset snapshot, or the ask providers.
- `speechLanguageTag(mode: LanguageMode): string` maps the existing `LanguageMode` (`auto` | `en` | `yo` | `ha` | `ig`) onto a BCP-47 recognition tag. It is load-bearing for the language chip behavior and is unit tested.
- `composeDictation(base: string, transcript: string, interim: string): string` joins the composer text captured when dictation started with the recognition output, inserting a single separating space only where the base does not already end in whitespace. It is pure and unit tested; it is what both the live preview and the confirm commit use, so the two cannot drift.
- `playVoiceCue(cue: 'start' | 'stop')` and `primeVoiceCues()` are the only side-effecting speech helpers; they own a lazily created `AudioContext` and never throw. `cueNotes(cue)` returns the pure note table they schedule and is unit tested.
- **No new dependency or asset.** The earcons are synthesized with the built-in Web Audio API; no audio file is added and nothing is fetched.
- The recognition error union returned by the hook is internal to the UI; the panel turns it into copy.
- Transcripts are ordinary composer text and inherit the existing conversation persistence. No new persisted field.

## Testing

- **Logic (vitest):** `speech.test.ts` covers `speechLanguageTag` for every `LanguageMode`, `hasSpeechRecognition` with and without the constructors present, and `composeDictation` for the empty base, the empty transcript, the spaced base, and the unspaced base. `voiceCues.test.ts` covers the shape of the pure note table. The repo's `npm run test` must stay green.
- **No new test runner or dependency.** The hook and the audio playback are DOM APIs and the repo has no jsdom or component-test library, so they are not unit tested; they ride on browser evidence and a real-mic Try pass. The Web Audio scheduling is verified by ear on the Try pass, since headless Chrome has no audio device.
- **Browser evidence (direct, not a committed harness):** a scratch Playwright probe in system Chrome. Because headless Chrome has no usable microphone, the probe injects a fake `webkitSpeechRecognition` on `window` via `addInitScript`. The fake emits several interim results and a late final result and, in the continuous case, no `onend`, which proves the live transcript grows and that a pause does not end the session. It then drives the cancel button and checks the composer is restored, drives the confirm button and checks the transcript is committed and Send works, and makes the fake fire `onend` on its own to prove the session restarts instead of ending. A separate context removes both constructors to prove the button is absent. A manual real-mic Try path covers the parts automation cannot.
- `AGENTS.md` declares no `Browser tests` command, so none is added. The project's optional `npm run eval` benchmark is unrelated to this feature.
- Verify with the project command: `npm run test && npm run lint && npm run build`.

## Notes for the AI

- **Client-only, and do not add a dependency.** Declare the Web Speech API in a local `.d.ts`. `lib.dom` does not include `SpeechRecognition`, and `@types/dom-speech-recognition` is not worth a dependency for this surface.
- **Feature-detect at runtime, on `window`.** Never render a mic button that cannot work. The constructors are `SpeechRecognition` and the `webkit`-prefixed fallback.
- **Keep the composer controlled.** The panel owns `input`; the hook owns only transcripts and status. Do not let the hook write the field directly, and do not auto-send.
- **Continuous, user-stopped.** The recognizer runs `continuous: true` and only the user's cancel / confirm, a send, a close, a clear, an unmount, or a language change ends it. A pause is not a stop; restart on a browser `onend` while the session is live.
- **Nothing is committed until confirm.** During dictation the composer is a read-only preview; cancel discards it and restores the captured base text exactly, and confirm writes `composeDictation(base, transcript, interim)` back into `input`. Do not write the transcript into `input` while listening, or cancel cannot be honest.
- **One recognizer, one session.** A single instance in the panel; start/stop toggles it. Starting while listening is a no-op, and stop is idempotent, so double taps cannot stack sessions, and a refresh loop from a browser `onend` must not be able to start a second one.
- **Dictation owns the field while it runs.** The textarea is read-only during dictation and editable again after confirm, so a caret never fights the transcript. Do not build a keystroke-merge layer.
- **The browser vendor's service does the recognition.** Chrome and Safari send audio to their own speech service; our server and keys are untouched. Do not describe it as private or offline.
- **Do not touch the ask flow, providers, access, or rate limits.** This feature only decides what text goes into the composer.
- **Match the composer chrome.** Same sizing, radius, and palette as the Send button; `touch-target` for the coarse-pointer 44px rule from 24c; dark-mode pair for any new color.
- **Reduced motion.** The listening equalizer must respect `useReducedMotion`; a pulse that never stops is a distraction. The existing global `prefers-reduced-motion` rule in `src/index.css` already neutralizes animations, so the sweep is its own guard and no second one is needed.
- **iOS note.** The composer textarea is covered by the `<=768px` 16px rule at `src/index.css`, so dictation into it does not add a zoom case.
- No em dashes, en dashes, or the ellipsis character in code, comments, or docs. Use hyphens.
- Match existing file conventions: the SPDX header comment where the file has one, JSDoc on exported members, and comments that explain why rather than restating the code.

## Evidence

Completed 2026-10-15 on branch `feature/voice-input-for-ask-atlas`.

- **Verify:** `npm run test && npm run lint && npm run build` passed. 461 tests across 35 files (up from 452: six `composeDictation` cases and three `cueNotes` cases), `tsc --noEmit` clean, production build ok.
- **Browser probes (scratch Playwright in system Chrome, fake `webkitSpeechRecognition` via `addInitScript`, deleted before completion):**
  - Live growth: `What is postcode` then `What is postcode for` then `What is postcode for Ikeja`, settling on the final `What is postcode for Ikeja, Lagos`.
  - A browser-initiated `onend` mid-session restarted the recognizer (start count 2) and the session stayed live, so silence alone does not end dictation.
  - Cancel restored the composer to `What is `; confirm committed the whole transcript and Send posted it.
  - The composer grew 36px to 76px for a long sentence and wrapped with no horizontal scroll.
  - With both constructors removed, the mic button was absent (0 matches), not disabled.
  - Earcons: a stubbed `AudioContext` recorded 0 oscillators before start, 2 on start (the rising two-note cue), and 1 more on stop, from a single primed context.
- **Manual real-mic Try pass (user):** the start/stop earcons are audible, recognition keeps listening and waits through a pause, and the UI adjusts as text arrives.
- **No server, route, endpoint, env var, dependency, or stored-shape change.** Verified by the request payloads captured during the probes.
- **Related, out of scope:** on the Try pass, unrelated follow-up questions came back anchored on a place resolved earlier in the conversation. Request payloads proved the app sent the user's exact transcript with no history; the anchoring originates in the responder prompt (ambient map scope plus the follow-up referent block) and N-ATLAS itself. Tracked as a separate fix, not part of this feature.
