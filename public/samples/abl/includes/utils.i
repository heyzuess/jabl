/* Shared include — utility snippets for sample programs */

&GLOBAL-DEFINE SAMPLE-VERSION 1.0

FUNCTION FormatMoney RETURNS CHARACTER
  (INPUT pdAmount AS DECIMAL):
  RETURN STRING(pdAmount, "->>>,>>9.99").
END FUNCTION.

FUNCTION IsBlank RETURNS LOGICAL
  (INPUT pcValue AS CHARACTER):
  RETURN pcValue = ? OR TRIM(pcValue) = "".
END FUNCTION.
