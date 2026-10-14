/* HTTP Basic authentication — username + password (sketch). */
DEFINE INPUT  PARAMETER pcAuthorization AS CHARACTER NO-UNDO.
DEFINE OUTPUT PARAMETER plOk            AS LOGICAL   NO-UNDO.

DEFINE VARIABLE cUser AS CHARACTER NO-UNDO INITIAL "demo".
DEFINE VARIABLE cPass AS CHARACTER NO-UNDO INITIAL "secret".

/* Authorization: Basic base64(user:pass) */
plOk = pcAuthorization BEGINS "Basic ".
IF NOT plOk THEN
  MESSAGE '{"error":"Unauthorized","code":"AUTH_REQUIRED"}'.
/* Validate decoded credentials against your user store / PASOE realm. */
