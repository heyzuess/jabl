/* OAuth 2.0 client_credentials — obtain token then call API (sketch). */
USING OpenEdge.Net.HTTP.*.
USING Progress.Lang.*.

DEFINE VARIABLE oClient   AS IHttpClient  NO-UNDO.
DEFINE VARIABLE oRequest  AS IHttpRequest NO-UNDO.
DEFINE VARIABLE oResponse AS IHttpResponse NO-UNDO.
DEFINE VARIABLE cTokenUrl AS CHARACTER NO-UNDO
  INITIAL "https://idp.example.com/oauth/token".
DEFINE VARIABLE cApiUrl   AS CHARACTER NO-UNDO
  INITIAL "http://localhost:8810/MyWebApp/web/api/customers".

oClient = ClientBuilder:Build():Client.

/* POST token: grant_type=client_credentials&client_id=…&client_secret=… */
oRequest = RequestBuilder:Post(cTokenUrl)
  :ContentType("application/x-www-form-urlencoded")
  :AddBody("grant_type=client_credentials&client_id=demo&client_secret=secret")
  :Request.
oResponse = oClient:Execute(oRequest).
MESSAGE "token" oResponse:StatusCode.
/* Parse access_token from JSON body, then: */

oRequest = RequestBuilder:Get(cApiUrl)
  :AddHeader("Authorization", "Bearer access_token_here")
  :Request.
oResponse = oClient:Execute(oRequest).
MESSAGE "api" oResponse:StatusCode.
