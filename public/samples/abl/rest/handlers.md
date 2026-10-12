# Handler URI map (WebHandler)

| Method | Path | ABL |
|--------|------|-----|
| GET | /web/api/customers | CustomersHandler / query-customers.p |
| GET | /web/api/customers/{id} | CustomersHandler / get-customer.p |
| POST | /web/api/customers | CustomersHandler / post-customer.p |
| PUT | /web/api/customers/{id} | CustomersHandler / put-customer.p |
| PATCH | /web/api/customers/{id} | CustomersHandler / patch-customer.p |
| DELETE | /web/api/customers/{id} | CustomersHandler / delete-customer.p |
| OPTIONS | /web/api/customers | options-cors.p |

Registration: `pasoe-handler-registration.md`
OpenAPI: `openapi.yaml` (hand-authored) or runtime catalog for DOH via `catalog-openapi-client.p`
