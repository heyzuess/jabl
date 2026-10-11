/* OpenEdge.Net.HTTP client sketch */
USING OpenEdge.Net.HTTP.*.
USING Progress.Lang.*.

DEFINE VARIABLE oClient   AS IHttpClient  NO-UNDO.
DEFINE VARIABLE oRequest  AS IHttpRequest NO-UNDO.
DEFINE VARIABLE oResponse AS IHttpResponse NO-UNDO.

oClient = ClientBuilder:Build():Client.
oRequest = RequestBuilder:Get("https://httpbin.org/get"):Request.

oResponse = oClient:Execute(oRequest).
MESSAGE oResponse:StatusCode.
