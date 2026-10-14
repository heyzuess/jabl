/* Shared auth gate for REST WebHandlers (sketch). */
USING Progress.Lang.*.

CLASS samples.rest.auth.AuthFilter:

  METHOD PUBLIC LOGICAL RequireBearer
    (INPUT pcAuthorization AS CHARACTER, INPUT pcExpectedToken AS CHARACTER):
    IF pcAuthorization = ? OR NOT pcAuthorization BEGINS "Bearer " THEN
      RETURN FALSE.
    RETURN TRIM(SUBSTRING(pcAuthorization, 8)) = pcExpectedToken.
  END METHOD.

  METHOD PUBLIC LOGICAL RequireBasic
    (INPUT pcAuthorization AS CHARACTER,
     INPUT pcUser AS CHARACTER,
     INPUT pcPassword AS CHARACTER):
    DEFINE VARIABLE cCred AS CHARACTER NO-UNDO.
    IF pcAuthorization = ? OR NOT pcAuthorization BEGINS "Basic " THEN
      RETURN FALSE.
    /* Decode Base64 in real code (OpenEdge.Core.ByteBucket / crypto helpers). */
    cCred = TRIM(SUBSTRING(pcAuthorization, 7)).
    RETURN cCred > "" AND pcUser > "" AND pcPassword > "".
  END METHOD.

  METHOD PUBLIC LONGCHAR UnauthorizedJson():
    RETURN '{"error":"Unauthorized","code":"AUTH_REQUIRED"}'.
  END METHOD.

  METHOD PUBLIC LONGCHAR ForbiddenJson():
    RETURN '{"error":"Forbidden","code":"AUTH_FORBIDDEN"}'.
  END METHOD.

END CLASS.
