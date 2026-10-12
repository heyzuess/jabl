/* Shared JSON helpers for REST sample handlers (sketch).
   Include from WebHandler / procedure samples. */

&GLOBAL-DEFINE REST-JSON-VERSION 1.0

FUNCTION RestErrorJson RETURNS LONGCHAR
  (INPUT pcCode AS CHARACTER, INPUT pcMessage AS CHARACTER):
  DEFINE VARIABLE lcOut AS LONGCHAR NO-UNDO.
  lcOut = SUBSTITUTE('{"error":&1,"code":&2}',
                     QUOTER(pcMessage),
                     QUOTER(pcCode)).
  RETURN lcOut.
END FUNCTION.

FUNCTION RestOkJson RETURNS LONGCHAR
  (INPUT plcBody AS LONGCHAR):
  IF plcBody = ? OR plcBody = "" THEN
    RETURN "{}".
  RETURN plcBody.
END FUNCTION.
