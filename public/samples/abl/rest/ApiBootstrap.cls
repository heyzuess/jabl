/* Initialize / register a PASOE WEB REST API (sketch).
   Requires PAS for OpenEdge — not runnable via jabl batch Run. */
USING Progress.Lang.*.
USING OpenEdge.Web.*.

CLASS samples.rest.ApiBootstrap:

  DEFINE PUBLIC STATIC PROPERTY ApiBasePath AS CHARACTER NO-UNDO
    INITIAL "/web/api"
    GET.
    PRIVATE SET.

  /* Call from application startup / session activate as appropriate. */
  METHOD PUBLIC STATIC VOID InitializeApi():
    /* Set session / logging / CORS defaults for your site here. */
    MESSAGE SUBSTITUTE("REST API base: &1", ApiBasePath).
    /* Handlers are registered in openedge.properties — see pasoe-handler-registration.md */
  END METHOD.

END CLASS.
