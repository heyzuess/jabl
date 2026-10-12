# DataObjectHandler (DOH) samples

Modern PASOE **WEB** mapped APIs using `OpenEdge.Web.DataObjectHandler` and a JSON `.map` file instead of a custom WebHandler for every route.

- `customers.map` — URI → ABL operations
- `CustomerEntity.cls` — resource methods
- `customers.gen.notes.md` — role of `.gen` companions
- `doh-service-notes.md` — registration

Runtime OpenAPI: register `CatalogWebHandler` and call `../catalog-openapi-client.p`.
