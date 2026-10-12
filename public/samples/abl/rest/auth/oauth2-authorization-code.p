/* OAuth 2.0 authorization_code flow (sketch).
   Browser redirects to IdP; callback exchanges code for tokens. */

DEFINE VARIABLE cAuthUrl AS CHARACTER NO-UNDO
  INITIAL "https://idp.example.com/oauth/authorize?response_type=code&client_id=demo&redirect_uri=http://localhost/callback&scope=api".
DEFINE VARIABLE cTokenUrl AS CHARACTER NO-UNDO
  INITIAL "https://idp.example.com/oauth/token".

/* 1) Redirect user-agent to cAuthUrl
   2) Callback receives ?code=
   3) POST cTokenUrl with grant_type=authorization_code&code=…&redirect_uri=…
   4) Store access_token (+ refresh_token); call API with Authorization: Bearer

   PASOE WebHandler can implement the callback endpoint and validate JWT/opaque tokens
   via auth-filter.cls patterns.
*/
MESSAGE "Open authorize URL" cAuthUrl.
MESSAGE "Token endpoint" cTokenUrl.
