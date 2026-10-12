# Classic `.paar` catalog sketch (CustomerRestService)

A real `.paar` is a Progress package (zip-like). Logical contents:

## Service
- Name: `CustomerRestService`
- Base: `/rest/CustomerRestService`

## Resources
| Verb | URI | ABL target |
|------|-----|------------|
| GET | /customers | CustomerRest.ListCustomers |
| GET | /customers/{id} | CustomerRest.GetCustomer |
| POST | /customers | CustomerRest.CreateCustomer |
| PUT | /customers/{id} | CustomerRest.UpdateCustomer |
| DELETE | /customers/{id} | CustomerRest.DeleteCustomer |

## Build
1. Map in PDSOE (produces `.pidl` / `resourceModel.xml`) **or** use jabl **Generate REST catalog**
2. Ant `PaarGeneration` with `DLC` → binary `.paar`
3. Deploy to PASOE REST transport

Prefer WEB + WebHandler/DOH for new APIs.
