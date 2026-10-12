/* Fetch PASOE CatalogWebHandler OpenAPI document (modern DOH discovery). */
USING OpenEdge.Net.HTTP.*.
USING Progress.Lang.*.

DEFINE VARIABLE oClient   AS IHttpClient  NO-UNDO.
DEFINE VARIABLE oRequest  AS IHttpRequest NO-UNDO.
DEFINE VARIABLE oResponse AS IHttpResponse NO-UNDO.
DEFINE VARIABLE cUrl      AS CHARACTER NO-UNDO
  INITIAL "http://localhost:8810/MyWebApp/web/catalogService/openapi".

/* Register: handlerN=OpenEdge.Web.CatalogWebHandler : catalogService/openapi
   See pasoe-handler-registration.md */

oClient = ClientBuilder:Build():Client.
oRequest = RequestBuilder:Get(cUrl):Request.
oResponse = oClient:Execute(oRequest).
MESSAGE "OpenAPI status" oResponse:StatusCode.
/* oResponse:Entity holds OpenAPI 3.1 JSON for registered DOH services. */
