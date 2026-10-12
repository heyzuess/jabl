/* POST /api/customers — create (201 + Location) sketch. */
DEFINE INPUT  PARAMETER plcBody AS LONGCHAR NO-UNDO.
DEFINE OUTPUT PARAMETER piNewId AS INTEGER  NO-UNDO.
DEFINE OUTPUT PARAMETER plcJson AS LONGCHAR NO-UNDO.

piNewId = 1001.
plcJson = SUBSTITUTE('{"custNum":&1,"name":"New"}', piNewId).
/* Response headers: Location: /api/customers/1001  Status: 201 */
