/* OpenEdge.Net.HTTP client — all verbs against a PASOE WEB API (sketch). */
USING OpenEdge.Net.HTTP.*.
USING Progress.Lang.*.

DEFINE VARIABLE oClient   AS IHttpClient  NO-UNDO.
DEFINE VARIABLE oRequest  AS IHttpRequest NO-UNDO.
DEFINE VARIABLE oResponse AS IHttpResponse NO-UNDO.
DEFINE VARIABLE cBase     AS CHARACTER NO-UNDO
  INITIAL "http://localhost:8810/MyWebApp/web/api/customers".

oClient = ClientBuilder:Build():Client.

/* GET list / QUERY */
oRequest = RequestBuilder:Get(cBase):Request.
oResponse = oClient:Execute(oRequest).
MESSAGE "GET" oResponse:StatusCode.

/* GET by id */
oRequest = RequestBuilder:Get(cBase + "/1"):Request.
oResponse = oClient:Execute(oRequest).
MESSAGE "GET id" oResponse:StatusCode.

/* POST create */
oRequest = RequestBuilder:Post(cBase)
  :AddJsonBody('{"name":"Acme"}')
  :Request.
oResponse = oClient:Execute(oRequest).
MESSAGE "POST" oResponse:StatusCode.

/* PUT full update */
oRequest = RequestBuilder:Put(cBase + "/1")
  :AddJsonBody('{"name":"Acme","balance":10}')
  :Request.
oResponse = oClient:Execute(oRequest).
MESSAGE "PUT" oResponse:StatusCode.

/* PATCH partial update — use RequestBuilder with Method if Put/Post helpers differ by OE version */
oRequest = RequestBuilder:Build("PATCH", cBase + "/1")
  :AddJsonBody('{"balance":11}')
  :Request NO-ERROR.
IF NOT ERROR-STATUS:ERROR THEN DO:
  oResponse = oClient:Execute(oRequest).
  MESSAGE "PATCH" oResponse:StatusCode.
END.

/* DELETE */
oRequest = RequestBuilder:Delete(cBase + "/1"):Request.
oResponse = oClient:Execute(oRequest).
MESSAGE "DELETE" oResponse:StatusCode.

/* With Bearer token — see rest/auth/bearer-token.p
   oRequest = RequestBuilder:Get(cBase)
     :AddHeader("Authorization", "Bearer " + cToken)
     :Request.
*/
