/* PASOE WebHandler for /api/customers (sketch).
   INHERITS OpenEdge.Web.WebHandler — deploy on PASOE WEB transport. */
USING Progress.Lang.*.
USING OpenEdge.Web.*.
USING OpenEdge.Net.HTTP.*.

CLASS samples.rest.CustomersHandler INHERITS WebHandler:

  {rest/RestJson.i}

  DEFINE VARIABLE oRouter AS samples.rest.RestRouter NO-UNDO.

  CONSTRUCTOR PUBLIC CustomersHandler():
    SUPER().
    oRouter = NEW samples.rest.RestRouter().
  END CONSTRUCTOR.

  METHOD OVERRIDE PROTECTED INTEGER HandleGet(INPUT poRequest AS IWebRequest):
    DEFINE VARIABLE cKey AS CHARACTER NO-UNDO.
    cKey = oRouter:RouteKey("GET", poRequest:PathInfo).
    /* GET /customers          → list / query
       GET /customers/{id}     → get by id
       Auth: see rest/auth/auth-filter.cls */
    MESSAGE "HandleGet" cKey.
    RETURN INTEGER(StatusCodeEnum:OK).
  END METHOD.

  METHOD OVERRIDE PROTECTED INTEGER HandlePost(INPUT poRequest AS IWebRequest):
    /* POST /customers → create (201) */
    RETURN INTEGER(StatusCodeEnum:Created).
  END METHOD.

  METHOD OVERRIDE PROTECTED INTEGER HandlePut(INPUT poRequest AS IWebRequest):
    /* PUT /customers/{id} → full update */
    RETURN INTEGER(StatusCodeEnum:OK).
  END METHOD.

  METHOD OVERRIDE PROTECTED INTEGER HandleDelete(INPUT poRequest AS IWebRequest):
    /* DELETE /customers/{id} */
    RETURN INTEGER(StatusCodeEnum:NoContent).
  END METHOD.

  /* PATCH / OPTIONS: override additional methods or dispatch in HandleRequest as needed. */

END CLASS.
