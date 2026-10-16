# Fix: Reject an Ask Atlas tool call whose argument is not in the user's message

**Type:** Fix
**Status:** verified
**Branch:** `fix/ungrounded-tool-call-guard`
**Completed:** 2026-10-16

## Problem

After a place turn, an unrelated message could make the model call a tool with the
previous turn's text and answer with the stale place. `runTool` validates argument
shape only; nothing checked whether the user actually said the quoted text.

Live reproduction (on the merged code):
- Turn 1: `12 Allen Avenue is in Ikeja, Lagos.` → `interpretAddress({"text":"12 Allen Avenue is in Ikeja, Lagos"})` → answer about Ikeja.
- Turn 2: `are you listening to what I am saying` → `interpretAddress({"text":"12 Allen Avenue, Ikeja, Lagos"})` → answered again about the earlier address.

Turn 2's argument was copied from turn 1 and was not grounded in turn 2's text.

## Fix

Add a narrow argument guard in the client tool loop. For round-0 calls, reject
`interpretAddress.text` and `searchLocation.query` when not grounded in the
current message; skip the guard for an anaphoric follow-up or a spatial
question (those legitimately resolve from the referent or the map selection).
Grounding uses normalized token overlap (case/diacritics folded, punctuation
ignored) with a short-prefix allowance for light typos and a shared-number
fallback.

Implementation:
- `src/lib/ask/argumentGuard.ts` (new, pure) exports `findUngroundedArg()`.
- `src/lib/ask/argumentGuard.test.ts` (new) — 12 cases covering grounding,
  diacritics, typos, shared number, follow-up/spatial skip, and that only the
  two quoted-text tools are guarded.
- `src/lib/ask/responder.ts` wires the guard: `executeToolCalls()` now takes
  `text` and, for a guarded ungrounded call, pushes a failed result with
  `error.code = 'ungrounded_args'`.
- `src/lib/tools/types.ts` adds `'ungrounded_args'` to `ToolErrorCode`.
- `src/server/ask/handler.ts` adds `'ungrounded_args'` to `TOOL_ERROR_CODES`
  so the server accepts tool results carrying it.

## Verify

- `npm run test && npm run lint && npm run build` → 484 tests passed (was 472, +12). `tsc --noEmit` clean. Build succeeded.

## Known limits

- A stale **code** argument is not caught (only the two quoted-text arguments are guarded).
- `explainAtlas` drift is not caught (enum argument). The live probe showed it on
  `tell me a bit about how you work` (off-topic but not a stale place).
- The guard prevents feeding the model an unsupported tool result; it cannot stop
  the model from recalling a place from its own priors.
