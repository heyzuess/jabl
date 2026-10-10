/* Sample ABL class */
USING Progress.Lang.*.

CLASS samples.Customer:

  DEFINE PUBLIC PROPERTY CustNum AS INTEGER NO-UNDO
    GET.
    SET.

  DEFINE PUBLIC PROPERTY Name AS CHARACTER NO-UNDO
    GET.
    SET.

  DEFINE PUBLIC PROPERTY Balance AS DECIMAL NO-UNDO
    GET.
    SET.

  CONSTRUCTOR PUBLIC Customer(INPUT piCustNum AS INTEGER,
                              INPUT pcName AS CHARACTER):
    ASSIGN
      THIS-OBJECT:CustNum = piCustNum
      THIS-OBJECT:Name    = pcName
      THIS-OBJECT:Balance = 0.
  END CONSTRUCTOR.

  METHOD PUBLIC VOID AddCharge(INPUT pdAmount AS DECIMAL):
    THIS-OBJECT:Balance = THIS-OBJECT:Balance + pdAmount.
  END METHOD.

  METHOD PUBLIC CHARACTER ToString():
    RETURN SUBSTITUTE("&1 (&2) Balance=&3",
                      THIS-OBJECT:Name,
                      THIS-OBJECT:CustNum,
                      THIS-OBJECT:Balance).
  END METHOD.

END CLASS.
