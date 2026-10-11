/* Query customers — demonstrates FOR EACH, FIND, and temp-tables */
{utils.i}

DEFINE TEMP-TABLE ttCustomer NO-UNDO
  FIELD CustNum  AS INTEGER
  FIELD Name     AS CHARACTER
  FIELD Balance  AS DECIMAL
  INDEX idxCust CustNum.

PROCEDURE LoadCustomers:
  /* In a real app this would read from the Customer table */
  CREATE ttCustomer.
  ASSIGN
    ttCustomer.CustNum = 1
    ttCustomer.Name    = "Acme Corp"
    ttCustomer.Balance = 1250.50.

  CREATE ttCustomer.
  ASSIGN
    ttCustomer.CustNum = 2
    ttCustomer.Name    = "Globex Inc"
    ttCustomer.Balance = 0.
END PROCEDURE.

RUN LoadCustomers.

FOR EACH ttCustomer NO-LOCK WHERE ttCustomer.Balance > 0 BY ttCustomer.Name:
  DISPLAY ttCustomer.CustNum ttCustomer.Name ttCustomer.Balance
    WITH FRAME fCust DOWN.
END.

FIND FIRST ttCustomer WHERE ttCustomer.CustNum = 1 NO-ERROR.
IF AVAILABLE ttCustomer THEN
  MESSAGE "Found:" ttCustomer.Name VIEW-AS ALERT-BOX INFO.
