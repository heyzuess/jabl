# PASOE WEB handler registration

Add handlers under your ABL application's web transport section in `openedge.properties`
(or deploy an `.oeds` package). Example:

```properties
# Custom WebHandler for Customer resource
handler1=samples.rest.CustomersHandler : api/customers

# OpenAPI catalog for DataObjectHandler services
handler2=OpenEdge.Web.CatalogWebHandler : catalogService/openapi
```

URI examples (adjust host/port/webapp):

- `GET  http://localhost:8810/MyWebApp/web/api/customers`
- `GET  http://localhost:8810/MyWebApp/web/catalogService/openapi`

For DOH-based services, also deploy the `.map` / `.gen` files under `doh/`.
