/* Progress.Collections sample */
USING Progress.Collections.*.
USING Progress.Lang.*.

CLASS samples.ProgressCollectionsDemo:

  METHOD PUBLIC VOID RunDemo():
    DEFINE VARIABLE oList AS Progress.Collections.List NO-UNDO.
    DEFINE VARIABLE oMap  AS Progress.Collections.HashMap NO-UNDO.
    DEFINE VARIABLE oObj  AS Progress.Lang.Object NO-UNDO.

    oList = NEW Progress.Collections.List().
    oMap = NEW Progress.Collections.HashMap().

    oObj = NEW Progress.Lang.Object().
    oList:Add(oObj).
    MESSAGE oList:Count.
  END METHOD.

END CLASS.
