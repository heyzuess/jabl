/* GET /api/customers?name=… — QUERY / filtered list (sketch). */
DEFINE INPUT  PARAMETER pcNameFilter AS CHARACTER NO-UNDO.
DEFINE OUTPUT PARAMETER plcJson      AS LONGCHAR  NO-UNDO.

plcJson = '[{"custNum":1,"name":"Acme"},{"custNum":2,"name":"Beta"}]'.
/* Apply pcNameFilter in real code. */
