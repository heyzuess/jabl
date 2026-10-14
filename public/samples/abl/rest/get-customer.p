/* GET /api/customers/{id} — fetch one customer (sketch).
   Prefer CustomersHandler:HandleGet on PASOE; this .p shows the verb in isolation. */
DEFINE INPUT  PARAMETER piCustNum AS INTEGER   NO-UNDO.
DEFINE OUTPUT PARAMETER plcJson   AS LONGCHAR  NO-UNDO.

/* In-memory stand-in — replace with FIND Customer ... */
plcJson = SUBSTITUTE('{"custNum":&1,"name":"Acme","balance":0}', piCustNum).
