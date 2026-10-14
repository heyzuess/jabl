/* Bearer / opaque token validation (sketch). */
DEFINE INPUT  PARAMETER pcAuthorization AS CHARACTER NO-UNDO.
DEFINE INPUT  PARAMETER pcValidToken    AS CHARACTER NO-UNDO.
DEFINE OUTPUT PARAMETER plOk            AS LOGICAL   NO-UNDO.

plOk = pcAuthorization BEGINS "Bearer "
       AND TRIM(SUBSTRING(pcAuthorization, 8)) = pcValidToken.
IF NOT plOk THEN
  MESSAGE '{"error":"Unauthorized","code":"AUTH_REQUIRED"}'.

/* Issue tokens from your auth service; store hashed server-side. */
