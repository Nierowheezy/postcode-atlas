# Fix: Ask Atlas chat UX polish (copy, thinking, language select)

**Type:** Fix
**Status:** verified

## The problem

Reported from live testing of feature 4 (2026-10-09):

1. **Reply text cannot be selected or copied.** `DraggableCard` puts both `drag`
   and `select-none` on the entire card surface, so every pointer-down starts a
   panel drag and native text selection is switched off. The handle bar claims
   "Click and drag anywhere on this bar to move this card", but dragging
   actually starts anywhere on the card. All five DraggableCard panels inherit
   this (Ask Atlas, Hunt Target, Postcode Inspector, Drag Telemetry, +1).
2. **The pending state is one static line.** While a reply is in flight the
   panel shows a single pulsing "Understanding your request..." line. The
   requested feel: an animated thinking state like Grok or Claude or OpenCode
   shows (spinner, evolving status text, animated dots).
3. **The reply-language select arrow is cramped.** The native `<select>`
   (EN/YO/HA/IG) renders its arrow flush against the 2-letter value with no
   breathing room.

Asked and answered, deliberately out of scope here: **`[View on map]` stays
disabled on purpose.** Feature 4 wires the `location` slot; activating the
button is feature 8 (map navigation), and its title attribute already says so.
Pulling feature 8 forward is a build-plan decision, not part of this fix.

## The fix

1. **Drag from the handle bar only; text becomes selectable.** In
   `DraggableCard`, turn off the root drag listener (`dragListener={false}`)
   and start the drag from the header bar's pointer-down via `useDragControls`.
   Drop `select-none` from the root, keep it on the header bar only. Dragging
   keeps working from the bar (its tooltip becomes true), and reply text,
   telemetry, and inspector values become highlightable and copyable in all
   five cards. Must not break the other four usages.
   Discovery while implementing: `App.tsx` also sets `select-none` on the whole
   app root, so the card root needs an explicit `select-text` to override the
   inherited value; the bar keeps its own `select-none`.
2. **Animated thinking bubble.** New `AskAtlasThinkingBubble` component rendered
   while `isReplying`: an assistant-styled row with a spinner, status lines
   cycling on a timer ("Contacting Ask Atlas...", "Searching the atlas...",
   "Verifying the postcode...", "Wrapping up..."), and animated bouncing dots.
   Pure Tailwind + lucide, no new dependencies, no changes to the 3c loop,
   transport, cache, or caps (the cycle is a timer, deliberately not wired to
   real phases). Screen readers hear one stable phrase; the cycling visuals are
   decorative. The bubble disappears when the reply or error lands.
3. **Language select spacing.** `appearance-none` on the select inside a
   relative wrapper with a lucide `ChevronDown` at a fixed right offset, and
   padding that keeps the arrow clear of the value; green focus border to match
   the header.

## Build steps

- [x] **Step 1 - DraggableCard: header-only drag + selectable text** - switch
  root drag to a `useDragControls` started from the handle bar, remove
  `select-none` from the root and keep it on the bar.
  *Done when:* browser check shows dragging from the bar still moves the card,
  pressing and dragging on bubble text does NOT move the card and instead
  selects it (`window.getSelection().toString()` returns the highlighted
  text); the other DraggableCard usages still render; lint + build green.
- [x] **Step 2 - thinking bubble** - new component + wire it into
  `AskAtlasPanel` in place of the static pending line.
  *Done when:* sending a question renders the thinking bubble with spinner,
  cycling status text (observed changing at least once during a live reply),
  and dots; it disappears on reply or error; lint + build green.
- [x] **Step 3 - language select arrow spacing** - appearance-none wrapper +
  ChevronDown with clear space, focus styling unchanged in spirit.
  *Done when:* screenshot shows the arrow with clear space from the value in
  light and dark; changing language still sends `language` on requests;
  lint + build green.

## Verify

- No `Browser tests` command is declared, so evidence is dev-server browser
  checks with screenshots: copy/select assertion, thinking animation observed
  across a real reply, select arrow in both themes.
- `npm run lint` + `npm run build` stay green after each step.

**Observed (2026-10-09):**

- App evidence: 9 app-level checks pass (custom chevron present; arrow gap
  8.0px at a 44px-wide select; thinking bubble + spinner during flight; two
  distinct status lines observed on a live reply; bubble gone after the reply;
  reply text selectable via `window.getSelection()`; content press+drag moves
  the card 0px; handle-bar drag moves it 70px; zero page errors).
- Deterministic thinking proof (component-only page, no provider in the path):
  all four status lines cycle, spinner and three dots per instance, zero page
  errors.
- Language probe: POST /api/ask carried `language: "yo"` after changing the
  select.
- Screenshots and raw results:
  `/private/var/folders/h4/3166h1zx4gz107nx96p8gszc0000gs/T/opencode/atlas-ux-fix/`.

## Files / areas

- `src/components/ui/DraggableCard.tsx` (step 1) - header-only drag, root text
  selectable; affects all five cards.
- `src/components/ask/AskAtlasThinkingBubble.tsx` (new, step 2).
- `src/components/ask/AskAtlasPanel.tsx` (step 2) - render the thinking bubble
  while `isReplying`.
- `src/components/ask/AskAtlasHeader.tsx` (step 3) - language select wrapper +
  arrow spacing.
- Consumes (no edits): `motion/react` `useDragControls`, `lucide-react`
  `ChevronDown`, `useAskAtlas` `isReplying`.

## Notes for the AI

- No em dashes, no ellipsis character in generated copy; three dots (`...`).
- No new dependencies; no inline styles; keep the 3c loop untouched.
- The cycling statuses are decorative approximation, never wired to real
  provider phases (zero transport change).
- Keep each step a small readable diff; checkpoints are disabled, so verify
  inline with lint + build + browser evidence.
