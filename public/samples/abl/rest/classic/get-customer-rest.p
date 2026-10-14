/* @rest
   executionMode=EXTERNAL
   serviceName=CustomerRestService
*/
/* @rest detail
   method=GET
   path=/customers/{id}
   name=GetCustomerProc
*/
DEFINE INPUT  PARAMETER piId    AS INTEGER  NO-UNDO.
DEFINE OUTPUT PARAMETER plcJson AS LONGCHAR NO-UNDO.
plcJson = SUBSTITUTE('{"custNum":&1,"name":"Acme"}', piId).
