/* Built-in Progress.Lang types */
USING Progress.Lang.*.

CLASS samples.ProgressLangDemo:

  METHOD PUBLIC VOID RunDemo():
    DEFINE VARIABLE oObj AS Progress.Lang.Object NO-UNDO.
    DEFINE VARIABLE oErr AS Progress.Lang.AppError NO-UNDO.

    oObj = NEW Progress.Lang.Object().
    MESSAGE oObj:ToString() oObj:GetClass():TypeName.

    oErr = NEW Progress.Lang.AppError("Demo failure", 100).
    UNDO, THROW oErr.

    CATCH e AS Progress.Lang.Error:
      MESSAGE e:GetMessage(1).
    END CATCH.
  END METHOD.

END CLASS.
