/* Progress.Json.ObjectModel sample */
USING Progress.Json.ObjectModel.*.

DEFINE VARIABLE oJson AS JsonObject NO-UNDO.
DEFINE VARIABLE oArr  AS JsonArray  NO-UNDO.

oJson = NEW JsonObject().
oJson:Add("name", "Jesse").
oJson:Add("active", TRUE).

oArr = NEW JsonArray().
oArr:Add("abl").
oArr:Add("openedge").
oJson:Add("tags", oArr).

MESSAGE oJson:GetJsonText().
