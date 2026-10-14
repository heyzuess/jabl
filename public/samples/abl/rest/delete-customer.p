/* DELETE /api/customers/{id} sketch. */
DEFINE INPUT PARAMETER piCustNum AS INTEGER NO-UNDO.
/* Return 204 No Content from the WebHandler. */
MESSAGE "Deleted" piCustNum.
