# REST authentication samples

Sketches for protecting PASOE WEB APIs:

| File | Flow |
|------|------|
| basic-auth.p / basic-auth-handler.cls | HTTP Basic (username + password) |
| bearer-token.p | Opaque / Bearer access token |
| oauth2-client-credentials.p | OAuth 2.0 client_credentials |
| oauth2-authorization-code.p | OAuth 2.0 authorization_code (sketch) |
| auth-filter.cls | Shared 401/403 gate for WebHandlers |

Configure PASOE / IdP separately; these samples show ABL-side validation patterns only.
