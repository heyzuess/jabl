/* PUT /api/customers/{id} — full UPDATE sketch. */
DEFINE INPUT  PARAMETER piCustNum AS INTEGER  NO-UNDO.
DEFINE INPUT  PARAMETER plcBody   AS LONGCHAR NO-UNDO.
DEFINE OUTPUT PARAMETER plcJson   AS LONGCHAR NO-UNDO.

plcJson = SUBSTITUTE('{"custNum":&1,"replaced":true}', piCustNum).
