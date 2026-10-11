/* OpenEdge.Logging sample */
USING OpenEdge.Logging.*.
USING Progress.Lang.*.

CLASS samples.OpenEdgeLoggingDemo:

  DEFINE PRIVATE VARIABLE logWriter AS ILogWriter NO-UNDO.

  CONSTRUCTOR PUBLIC OpenEdgeLoggingDemo():
    THIS-OBJECT:logWriter = LoggerBuilder:Build("samples.OpenEdgeLoggingDemo"):Logger.
  END CONSTRUCTOR.

  METHOD PUBLIC VOID RunDemo():
    IF VALID-OBJECT(THIS-OBJECT:logWriter) THEN
      THIS-OBJECT:logWriter:Info("Hello from OpenEdge.Logging").
  END METHOD.

END CLASS.
