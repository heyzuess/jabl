/* OpenEdge.Net.HTTP client — GET/POST/PUT/PATCH/DELETE sketches */
USING OpenEdge.Net.HTTP.*.
USING Progress.Lang.*.

DEFINE VARIABLE oClient   AS IHttpClient  NO-UNDO.
DEFINE VARIABLE oRequest  AS IHttpRequest NO-UNDO.
DEFINE VARIABLE oResponse AS IHttpResponse NO-UNDO.
DEFINE VARIABLE cBase     AS CHARACTER NO-UNDO
  INITIAL "https://httpbin.org".

oClient = ClientBuilder:Build():Client.

/* GET */
oRequest = RequestBuilder:Get(cBase + "/get"):Request.
oResponse = oClient:Execute(oRequest).
MESSAGE "GET" oResponse:StatusCode.

/* POST JSON */
oRequest = RequestBuilder:Post(cBase + "/post")
  :AddJsonBody('{"hello":"world"}')
  :Request.
oResponse = oClient:Execute(oRequest).
MESSAGE "POST" oResponse:StatusCode.

/* PUT */
oRequest = RequestBuilder:Put(cBase + "/put")
  :AddJsonBody('{"replaced":true}')
  :Request.
oResponse = oClient:Execute(oRequest).
MESSAGE "PUT" oResponse:StatusCode.

/* PATCH — RequestBuilder:Build if dedicated helper unavailable */
oRequest = RequestBuilder:Build("PATCH", cBase + "/patch")
  :AddJsonBody('{"patched":true}')
  :Request NO-ERROR.
IF NOT ERROR-STATUS:ERROR THEN DO:
  oResponse = oClient:Execute(oRequest).
  MESSAGE "PATCH" oResponse:StatusCode.
END.

/* DELETE */
oRequest = RequestBuilder:Delete(cBase + "/delete"):Request.
oResponse = oClient:Execute(oRequest).
MESSAGE "DELETE" oResponse:StatusCode.

/* Auth header example (Bearer) — see samples/rest/auth/
oRequest = RequestBuilder:Get(cBase + "/get")
  :AddHeader("Authorization", "Bearer your-token")
  :Request.
*/

/* Full Customer API client: samples/rest/client-calls.p */
