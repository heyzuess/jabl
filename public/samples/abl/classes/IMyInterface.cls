/* ABL interface */
USING Progress.Lang.*.

INTERFACE samples.IMyInterface:

  METHOD PUBLIC CHARACTER GetName().

  METHOD PUBLIC VOID SetName(INPUT pcName AS CHARACTER).

END INTERFACE.
