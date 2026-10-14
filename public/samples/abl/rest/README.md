# PASOE WEB REST samples (modern)

These samples show **modern OpenEdge PASOE REST** using the **WEB transport**:

1. Custom `OpenEdge.Web.WebHandler` (code-first) — see `CustomersHandler.cls` + verb sketches
2. `OpenEdge.Web.DataObjectHandler` (DOH) — see `doh/`
3. OpenAPI discovery via `OpenEdge.Web.CatalogWebHandler` — `catalog-openapi-client.p`

Also see:

- `auth/` — Basic, Bearer, OAuth2 sketches
- `classic/` — legacy REST transport + jabl catalog generation inputs

## Important: Run in this IDE

JABL's local OE agent uses batch `_progres`, **not** PASOE. **Run → Run will not host HTTP.**
Deploy these handlers to PAS for OpenEdge (WEB transport) to exercise them live.

See `pasoe-handler-registration.md` and `PASOE-BRIDGE.md`.
