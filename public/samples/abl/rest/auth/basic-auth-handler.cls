/* WebHandler stub that requires HTTP Basic (sketch). */
USING Progress.Lang.*.
USING OpenEdge.Web.*.
USING OpenEdge.Net.HTTP.*.

CLASS samples.rest.auth.BasicAuthHandler INHERITS WebHandler:

  DEFINE VARIABLE oFilter AS samples.rest.auth.AuthFilter NO-UNDO.

  CONSTRUCTOR PUBLIC BasicAuthHandler():
    SUPER().
    oFilter = NEW samples.rest.auth.AuthFilter().
  END CONSTRUCTOR.

  METHOD OVERRIDE PROTECTED INTEGER HandleGet(INPUT poRequest AS IWebRequest):
    DEFINE VARIABLE cAuth AS CHARACTER NO-UNDO.
    cAuth = poRequest:GetHeader("Authorization"):Value NO-ERROR.
    IF NOT oFilter:RequireBasic(cAuth, "demo", "secret") THEN
      RETURN INTEGER(StatusCodeEnum:Unauthorized).
    RETURN INTEGER(StatusCodeEnum:OK).
  END METHOD.

END CLASS.
