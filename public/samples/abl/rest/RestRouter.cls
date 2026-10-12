/* Simple METHOD + path router for REST samples. */
USING Progress.Lang.*.

CLASS samples.rest.RestRouter:

  METHOD PUBLIC CHARACTER NormalizePath(INPUT pcPath AS CHARACTER):
    DEFINE VARIABLE c AS CHARACTER NO-UNDO.
    c = TRIM(pcPath).
    IF c BEGINS "/" THEN c = SUBSTRING(c, 2).
    RETURN c.
  END METHOD.

  /* Returns route key: METHOD + " " + first segment (and id flag). */
  METHOD PUBLIC CHARACTER RouteKey
    (INPUT pcMethod AS CHARACTER, INPUT pcPath AS CHARACTER):
    DEFINE VARIABLE cPath AS CHARACTER NO-UNDO.
    DEFINE VARIABLE cSeg  AS CHARACTER NO-UNDO.
    cPath = THIS-OBJECT:NormalizePath(pcPath).
    cSeg = ENTRY(1, cPath, "/") NO-ERROR.
    IF cSeg = ? OR cSeg = "" THEN
      RETURN CAPS(pcMethod) + " /".
    IF NUM-ENTRIES(cPath, "/") >= 2 THEN
      RETURN CAPS(pcMethod) + " /" + cSeg + "/{id}".
    RETURN CAPS(pcMethod) + " /" + cSeg.
  END METHOD.

END CLASS.
