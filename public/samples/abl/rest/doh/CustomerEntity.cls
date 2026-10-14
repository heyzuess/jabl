/* Business entity for DOH Customer resource (in-memory sketch). */
USING Progress.Lang.*.

CLASS samples.rest.doh.CustomerEntity:

  METHOD PUBLIC LONGCHAR List():
    RETURN '[{"custNum":1,"name":"Acme"},{"custNum":2,"name":"Beta"}]'.
  END METHOD.

  METHOD PUBLIC LONGCHAR Get(INPUT piId AS INTEGER):
    RETURN SUBSTITUTE('{"custNum":&1,"name":"Acme","balance":0}', piId).
  END METHOD.

  METHOD PUBLIC LONGCHAR Create(INPUT plcBody AS LONGCHAR):
    RETURN '{"custNum":1001,"name":"New"}'.
  END METHOD.

  METHOD PUBLIC LONGCHAR Update(INPUT piId AS INTEGER, INPUT plcBody AS LONGCHAR):
    RETURN SUBSTITUTE('{"custNum":&1,"replaced":true}', piId).
  END METHOD.

  METHOD PUBLIC LONGCHAR Patch(INPUT piId AS INTEGER, INPUT plcBody AS LONGCHAR):
    RETURN SUBSTITUTE('{"custNum":&1,"patched":true}', piId).
  END METHOD.

  METHOD PUBLIC VOID Delete(INPUT piId AS INTEGER):
    MESSAGE "Deleted" piId.
  END METHOD.

END CLASS.
