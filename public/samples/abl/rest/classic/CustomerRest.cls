/* @rest
   executionMode=SINGLETON
   serviceName=CustomerRestService
*/
USING Progress.Lang.*.

CLASS samples.rest.classic.CustomerRest:

  /* @rest detail
     method=GET
     path=/customers/{id}
     name=GetCustomer
  */
  METHOD PUBLIC LONGCHAR GetCustomer(INPUT piId AS INTEGER):
    RETURN SUBSTITUTE('{"custNum":&1,"name":"Acme"}', piId).
  END METHOD.

  /* @rest detail
     method=GET
     path=/customers
     name=ListCustomers
  */
  METHOD PUBLIC LONGCHAR ListCustomers():
    RETURN '[{"custNum":1,"name":"Acme"}]'.
  END METHOD.

  /* @rest detail
     method=POST
     path=/customers
     name=CreateCustomer
  */
  METHOD PUBLIC LONGCHAR CreateCustomer(INPUT plcBody AS LONGCHAR):
    RETURN '{"custNum":1001,"name":"New"}'.
  END METHOD.

  /* @rest detail
     method=PUT
     path=/customers/{id}
     name=UpdateCustomer
  */
  METHOD PUBLIC LONGCHAR UpdateCustomer(INPUT piId AS INTEGER, INPUT plcBody AS LONGCHAR):
    RETURN SUBSTITUTE('{"custNum":&1,"replaced":true}', piId).
  END METHOD.

  /* @rest detail
     method=DELETE
     path=/customers/{id}
     name=DeleteCustomer
  */
  METHOD PUBLIC VOID DeleteCustomer(INPUT piId AS INTEGER):
    MESSAGE "Deleted" piId.
  END METHOD.

END CLASS.
