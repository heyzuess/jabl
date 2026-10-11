/* OpenEdge.Core.String — avoid USING this class (conflicts with STRING function) */
USING Progress.Lang.*.

CLASS samples.OpenEdgeStringDemo:

  METHOD PUBLIC CHARACTER RunDemo(INPUT pcValue AS CHARACTER):
    DEFINE VARIABLE oStr AS OpenEdge.Core.String NO-UNDO.

    oStr = NEW OpenEdge.Core.String(pcValue).
    oStr:Append(" / OpenEdge").
    oStr:Trim().
    RETURN oStr:ToString().
  END METHOD.

END CLASS.
