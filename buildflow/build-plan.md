# Build Plan

> One of the two planning docs you provide. Write it directly, develop it through
> any AI conversation, or optionally run `/discovery`. Keep the items high-level
> even when `project-plan.md` is detailed; later `/feature` specs hold the depth
> for each build item.

The features that make up this project, high level and in rough build order, one
line each, no detail (that comes per feature). Rough is fine at first, but before
`/overview` runs this file should be shaped into a checkbox list the build loop
can track.

Keep it as a checklist. Run `/feature` with no number to spec the **next
unchecked** item, or `/feature 3` / `/feature "postcode lookup"` to pick a
specific one.

Completed features get checked off here, so the build plan doubles as your
progress tracker. A big item gets split into sub-items (4a, 4b, etc.) when you
spec it.

## Continuing after the initial build

This is a living roadmap, not a plan that freezes when the first release is
done. Keep completed items checked, then append new unchecked features as the
project grows. Optional milestone headings such as `## MVP` and `## Post-MVP`
keep a longer plan readable without changing how `/feature` finds the next
unchecked item.

Do not renumber completed features because their archived specs refer back to
those numbers. Continue with the next unused number. If a new feature
materially changes the product direction, users, data, stack, monetization, UI/UX,
or deployment, update the relevant part of `project-plan.md` too. Then re-run
`/overview` before spec'ing the feature.

You can edit this file directly or ask the AI to start a new feature by name. If
`/feature "address interpretation"` does not match an existing item, it will
propose the new build-plan line and any necessary project-plan changes, wait for
approval, refresh the overview, and then write the feature spec.

Scaffolding the app and prototyping the existing Nigerian Postcode Atlas are
pre-build steps, not features. The existing Atlas already provides the core
map, postcode exploration, decoding, assembly, nearby search, and related
functionality. The build starts with the first new N-ATLAS-powered slice.

A common order that works well: build the core conversational UI with the
existing Atlas capabilities first, then connect N-ATLAS and expose the Atlas
tools, then add grounded natural-language interactions, map control, evaluation,
and deployment readiness. Adapt it to the project as implementation progresses.

## MVP

- [x] 1. **Ask Atlas interface** - add a conversational entry point to the existing Nigerian Postcode Atlas

- [x] 2. **N-ATLAS integration** - connect Ask Atlas to N-ATLAS for natural-language understanding

- [x] 3. **Atlas tool layer** - expose postcode, location, hierarchy, nearby-search, and decoding capabilities as structured tools
  - [x] 3a. **Atlas dataset cache** - versioned IndexedDB store of the NDAPS naming hierarchy (states + LGAs; districts/areas are code-only at measured scale and stay gateway-served) and discovery postcodes, seeded once per release from a committed static snapshot, with local-first reads and gateway fallback
  - [x] 3b. **Atlas structured tools** - shared, validated schemas and client executors for the eight data tools (searchLocation, getState, getLgas, getDistricts, getAreas, getPostcode, decodePostcode, getNearby) backed by the 3a store; result shapes become the load-bearing contract for features 4-9
  - [x] 3c. **Tool-calling chat loop** - OpenAI-compatible tools in the Ask provider chain, a multi-round `/api/ask` contract with client-side tool execution and feed-back, plus an honest text-only fallback when a model does not call tools

- [x] 4. **Natural-language postcode lookup** - ask for a Nigerian postcode using normal language and return verified Atlas results

- [x] 5. **Natural-language location exploration** - explore states, LGAs, districts, areas, and postcode units through conversation

- [x] 6. **Postcode decoding** - submit a postcode conversationally and explain its structure and location

- [x] 7. **Nearby location queries** - ask conversationally about nearby postcode areas and locations

- [x] 8. **Conversational map control** - allow valid AI requests to navigate, zoom, select, and highlight locations on the map

- [x] 9. **Grounded responses** - ensure postcode and location facts come from NIPOST/Atlas data rather than model-generated guesses. Pass the model only the small retrieved match set from the local store, never the whole dataset; outside-topic questions are refused per the feature 2 prompt scope guard.

- [x] 10. **Conversation context** - support follow-up questions using the current location, selected map state, and previous conversation

- [ ] 11. **Nigerian query handling** - support common Nigerian English phrasing and location terminology

- [ ] 12. **Ambiguity handling** - ask for clarification when a location or postcode request cannot be resolved confidently

- [ ] 13. **AI evaluation benchmark** - test N-ATLAS against representative Nigerian postcode and location queries

- [ ] 14. **Production hardening** - handle API failures, invalid tool calls, loading states, rate limits, and security

- [ ] 15. **Challenge-ready demo** - polish the end-to-end conversational Atlas experience for the N-ATLAS Innovation Challenge

- [ ] 16. **Deployment readiness** - deploy and verify the production application and N-ATLAS integration

## Post-MVP

- [ ] 17. **Address interpretation** - interpret Nigerian addresses and resolve them into the Atlas location hierarchy where supported

- [ ] 18. **Multilingual queries** - support Yoruba, Hausa, Igbo, and Nigerian Pidgin queries where N-ATLAS supports them reliably

- [ ] 19. **Atlas explanations** - provide richer explanations of Nigeria's digital addressing and postcode system

- [ ] 20. **Saved discoveries** - save and share postcode results, locations, and Atlas discoveries

- [ ] 21. **Developer API** - expose Atlas postcode and location capabilities for external applications

- [ ] 22. **Developer documentation** - provide integration documentation and examples for the Atlas API

- [ ] 23. **Advanced evaluation** - expand testing across languages, regional terminology, ambiguity, and tool accuracy
