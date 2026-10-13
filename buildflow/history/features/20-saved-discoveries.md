# Feature: Saved discoveries

**From build-plan:** feature 20
**Status:** verified

## Goal

Let a user keep the postcode results, locations, and Atlas discoveries they care
about, then reopen or share them later. Today a result exists only while it is on
screen: the postcode inspector, an Ask Atlas reply, and a "Surprise me" landmark
are all ephemeral, and the only way back is to remember and re-run the lookup.
This feature adds a client-local collection of saved discoveries, a save action
on the surfaces that produce them, a drawer to review, reopen, and remove them,
and a share link built from the deep links the app already resolves on load.

## In scope

- A client-local, versioned saved-discovery store in `localStorage`, following
  the best-effort style of `src/lib/ask/persistence.ts` (swallow errors, degrade
  to no persistence, never break the UI).
- Two saved kinds, which cover the three named categories:
  - `postcode` - a verified postcode result or a discovery landmark (an "Atlas
    discovery" is a landmark with a postcode, saved with its name and category).
  - `place` - a state or LGA selection that has no postcode of its own.
- Pure converters from a `PostcodeLocation`, a state, an LGA, and an Ask Atlas
  message into a saved draft, with stable ids so the same thing saves once.
- A save toggle in the postcode inspector and on an Ask Atlas reply that carries
  a savable finding, both driven by one store through a small React hook.
- A `SavedDiscoveriesDrawer` that lists saves newest-first, reopens one on the
  map, removes one, clears all, and shows an honest empty state.
- Sharing a saved discovery as the deep link the app already handles (`?code=`
  for a postcode, `?state=` for a place), reusing the inspector's Web Share plus
  clipboard fallback so there is one share path, not two.

## Out of scope

- Accounts, a server-side collection, cross-device sync, and a public URL that
  exposes the whole saved list. The project plan excludes a user database, so
  saves stay on the device and the user can clear them.
- Saving curated explanations (feature 19), hierarchy lists, nearby lists, and
  address interpretations. Only a single postcode result or a place selection is
  savable here; the rest have no single reopen target yet.
- LGA-level deep links. `?state=` opens the state; the drawer's in-app open
  restores the LGA, but a shared place link lands on the state. Extending the
  deep-link contract is a later change.
- Reordering, renaming, folders, tags, and search over saved items.
- The developer API and its documentation (items 21 and 22) and phone drawer or
  modal presentation (items 24c and 24d).
- Any change to the tool layer, the provider, `decodePostcode`, the N-ATLAS
  request path, or `DatasetStoryModal.tsx`.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on. Checkpoints are optional; `/complete` makes the real feature-level commit at the end. This project runs `stepReview: "feature"`, so the one review packet lands after the last step.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Saved contract and local store.** Add `src/lib/saved/types.ts` with `SAVED_KINDS = ['postcode', 'place']`, `SavedKind`, and `SavedDiscovery`. Add `src/lib/saved/store.ts`: a versioned `localStorage` store under `atlas:saved-discoveries:v1` that keeps an in-memory cache plus a listener set, exposes `subscribe`, `getSnapshot` (a stable reference), `listSaved` (newest-first), `isSaved`, `toggleSaved`, `removeSaved`, and `clearSaved`, caps the list at `MAX_SAVED = 100` by dropping the oldest, drops malformed entries on read, and syncs across tabs through the `storage` event. Touch `window` only inside functions, never at module load, so the store imports cleanly where there is no DOM. Add `src/lib/saved/store.test.ts`. *Done when* `npm run test` passes new cases: toggle on inserts at the front, toggle off removes, re-saving the same id does not duplicate, the cap drops the oldest, corrupt JSON and unknown shapes are ignored, and `getSnapshot()` returns the same reference between reads but a new one after a mutation. The test's fake window follows `persistence.test.ts` and provides `addEventListener` and `removeEventListener`; the store must feature-detect both so a missing listener API degrades to no cross-tab sync instead of throwing.

- [x] **Step 2 - Draft converters and the React hook.** Add `src/lib/saved/drafts.ts` with `savedFromLocation`, `savedFromState`, `savedFromLga`, and `savedFromMessage`, each returning a `SavedDiscovery` or `null`, plus a shared `savedId` helper. `savedFromMessage` prefers `lookup`, then a `valid` `decoded`, then `location`, and returns `null` otherwise. Add `src/hooks/useSavedDiscoveries.ts` binding the store with `useSyncExternalStore` and returning `{ saved, isSaved, toggle, remove, clear }`. Add `src/lib/saved/drafts.test.ts`. *Done when* `npm run test` passes new cases (each converter, message precedence, an invalid `decoded` is not savable, a location-only reply yields a `place`, id stability across calls) and `npm run lint` is clean.

- [x] **Step 3 - Save from the postcode inspector.** In `PostcodeInspector.tsx`, add a bookmark toggle beside the close button, using `Bookmark` and `BookmarkCheck`, fed by new `isSaved` and `onToggleSave` props. In `App.tsx`, wire both from `useSavedDiscoveries` and `savedFromLocation`, with a `useToast` confirmation on save and remove. *Done when* selecting a postcode shows an empty bookmark, one click saves it (icon fills, toast confirms) and a second click removes it, in light and dark mode; capture a screenshot to `.playwright-mcp/feature20/`.

- [x] **Step 4 - Save from an Ask Atlas reply.** In `AskAtlasMessageBubble.tsx`, render a `[Save]` / `[Saved]` text action beside `[View on map]` when `savedFromMessage(message)` is non-null, fed by new optional `isSaved` and `onToggleSave` props. Forward both through `AskAtlasPanel.tsx` and supply them from `App.tsx`. *Done when* a postcode reply and a place (`location`) reply show the save action and toggle it, and a small-talk reply shows none; confirm on the dev server and `npm run lint` is clean.

- [x] **Step 5 - The saved discoveries drawer.** Add `src/components/saved/SavedDiscoveriesDrawer.tsx` mirroring `StateExplorerDrawer.tsx` (right drawer, `AnimatePresence`, Escape and backdrop close): newest-first rows, per-row open, share, and remove, a two-step `Clear all`, and an empty state. Add a Saved action with a count badge to `TopBar.tsx` (`onOpenSaved`, `savedCount`). In `App.tsx`, add the drawer state, an open handler that routes a postcode item through `handleSelectLocation` and a place item through `handleSelectState` or `handleSelectLGA`, and wire remove and clear. *Done when* saved items survive a reload, opening one moves the map and closes the drawer, remove and clear work, and the empty state reads honestly; confirm on the dev server.

- [x] **Step 6 - Share a saved discovery, then verify.** Add `src/lib/share/shareLink.ts` with `postcodeShareUrl`, `stateShareUrl`, `discoveryShareUrl`, and `shareOrCopy` (Web Share, then clipboard, then the legacy `execCommand` fallback, returning `'shared' | 'copied' | 'cancelled' | 'failed'` and never throwing on a user cancel). Move `PostcodeInspector.handleShare` onto `shareOrCopy` with its current toasts and cancel behavior preserved, and use `discoveryShareUrl` for the drawer's share action. Add `src/lib/share/shareLink.test.ts`. *Done when* the share tests pass, the inspector's share still behaves, the drawer shares a working `?code=` or `?state=` link, and the full Verify `npm run test && npm run lint && npm run build` is green.

## Files / areas

- `src/lib/saved/types.ts` (new), `src/lib/saved/store.ts` (new), `store.test.ts` (new) - the contract and the client-local collection.
- `src/lib/saved/drafts.ts` (new), `drafts.test.ts` (new) - pure converters from existing payloads.
- `src/hooks/useSavedDiscoveries.ts` (new) - the `useSyncExternalStore` binding and actions.
- `src/lib/share/shareLink.ts` (new), `shareLink.test.ts` (new) - deep-link building and share-or-copy.
- `src/components/saved/SavedDiscoveriesDrawer.tsx` (new) - the review and reopen surface.
- `src/components/postcode/PostcodeInspector.tsx` - the bookmark toggle and the share refactor.
- `src/components/ask/AskAtlasMessageBubble.tsx`, `AskAtlasPanel.tsx` - the reply save action and its plumbing.
- `src/components/navigation/TopBar.tsx` - the Saved entry point and badge.
- `src/App.tsx` - store wiring, drawer state, open, remove, clear, and share handlers.

## Data / contracts

- `SavedDiscovery` is the local, load-bearing shape: `{ id, kind, label, postcode?, stateCode?, stateName?, lgaCode?, lgaName?, lat?, lng?, category?, savedAt }`. `id` is the dedupe key: `postcode:<CODE>` for a postcode or landmark, and for a place `place:<state>[-<lga>]`, falling back to `place:<lat>,<lng>` when there is no code. Keep the shape stable; the drawer and the share builder both read it.
- The store is one versioned JSON array under `atlas:saved-discoveries:v1`, so a later shape change migrates or drops it rather than corrupting a live list. Section 8 of `project-plan.md` excludes a user database; this collection is device-local and clearable, not synced.
- Share reuses the deep links `App.tsx` already resolves on mount: `?code=<postcode>` and `?state=<stateCode>`. `discoveryShareUrl` returns `undefined` when neither applies, and the drawer hides share rather than emitting a link that opens an unrelated view.
- A discovery landmark is a `postcode` item carrying `label` (the landmark name or address) and `category`, so "Atlas discoveries" ride the same save path as a plain postcode result.

## Testing

- Unit tests: Steps 1, 2, and 6 ship tests (store semantics and snapshot stability, draft converters and message precedence, share URL building and fallback results), since `npm run test` is configured in `AGENTS.md`. Steps 3, 4, and 5 are UI only and ride on dev-server evidence, screenshots, and the build.
- Full Verify before completion: `npm run test && npm run lint && npm run build`.
- There is no project `Browser tests` command (`AGENTS.md` ships the `npm run eval` benchmark, not a browser suite), so use the dev server, screenshots, and accessibility snapshots rather than adding a runner mid-feature. Save them under `.playwright-mcp/feature20/` (generated, gitignored).

## Notes for the AI

- Everything here is client-local. Do not add a server route, a database, an account, or a network call for saves. Read and write through the store so a disabled or full `localStorage` degrades to "no persistence" and never throws into render.
- Follow `ask/persistence.ts` for the store's shape: versioned key, best-effort reads and writes, and a cap so the list cannot grow without bound.
- `useSyncExternalStore` loops forever if `getSnapshot` returns a fresh array on every call. Cache the array and replace it only on a mutation; Step 1 tests this directly.
- Reuse existing patterns instead of inventing new ones: `StateExplorerDrawer.tsx` for the drawer shell, `PostcodeInspector.handleShare` for sharing, `useToast` for confirmations.
- New files carry the `@license SPDX-License-Identifier: Apache-2.0` header, comments explain why, and no em dash, en dash, or ellipsis appears in code, copy, or docs.
- This feature does not touch the tool layer, the provider, the N-ATLAS request path, `decodePostcode`, or `DatasetStoryModal.tsx`. A save never leaves the device and is never sent to the model.
- Phone presentation for drawers and modals is items 24c and 24d. Keep the Saved drawer consistent with the drawers that exist today and do not fold that work in here.

## Red-team notes

- The project plan's storage exclusions are about the MVP and about accounts, a database, and saved conversations. Feature 20 is post-MVP and explicit about saving, so a device-local, clearable collection of discoveries is in bounds, and the spec says so.
- A `postcode` id is the code alone, so saving the same postcode from two surfaces keeps one row whose label is whichever saved first. The icon is a toggle, so a second save removes; both behaviors are intentional and tested.
- Opening a saved postcode runs through `handleSelectLocation`, so an active Postcode Hunt scores it. The hunt still requires the code to match the target, so this is a legitimate find, not a shortcut, and the spec accepts it rather than forking the handler.
- The share refactor is the one place that touches existing behavior. Keep the inspector's toasts and its `AbortError` cancel path identical so the change is a move, not a rewrite.
- Deciding what to save from a reply is where scope can creep. The rule is one finding per reply by precedence (`lookup`, then a valid `decoded`, then `location`); lists, nearby results, addresses, and explanations are not savable here. If saving explanations is wanted, it belongs in a follow-up with a real reopen target, and this spec defers it.
- Six steps is at the upper end for one feature. The seam is clean if it grows: saving (Steps 1 to 5) and sharing (Step 6) can split into 20a and 20b without rework, since share reads only the store's shape.
