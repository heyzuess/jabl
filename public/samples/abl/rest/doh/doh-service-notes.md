# Registering a DOH service

1. Create an ABL WEB service that uses `OpenEdge.Web.DataObjectHandler`.
2. Deploy `customers.map` (and `.gen` when present) where PASOE discovers service maps.
3. Optionally register `OpenEdge.Web.CatalogWebHandler : catalogService/openapi` for OpenAPI 3.1 discovery.

See Progress docs: *Use a DataObjectHandler* and *ABL application catalog service*.
