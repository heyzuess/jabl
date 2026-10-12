# PASOE / jabl bridge (spike notes)

## Goal
Exercise WEB handlers from the IDE without full PDSOE.

## Constraints
- JABL oe-agent runs **batch** Progress (`_progres` / `bpro`), not PASOE's WEB transport.
- `WEB-CONTEXT`, `IWebRequest`, and handler dispatch are PASOE runtime concepts.
- A faithful bridge needs a real PASOE instance (or Progress's test host), not a fabricated ABL session.

## Recommended path
1. Develop/edit handlers in JABL.
2. Deploy `.r` / source to a local PASOE web app.
3. Call with `client-calls.p` or curl; use Output pane only for batch compile checks.

## Deferred / not in v1
- Embedding PASOE in the browser
- Mock Node façade that pretends to be `HandleGet` without OE libraries
- Automatic Ant `.paar` packaging from the browser

When `DLC` + PASOE extras are available on the machine, a future oe-agent endpoint could shell out to `pasman` / deploy scripts — out of scope until that is productized.
