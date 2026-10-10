import { languageIdForPath } from "./register";

export type AblTemplateId = "blank" | "procedure" | "class" | "include";

export type AblTemplate = {
  id: AblTemplateId;
  label: string;
  description: string;
  defaultFilename: string;
  content: string;
};

export const ABL_TEMPLATES: AblTemplate[] = [
  {
    id: "blank",
    label: "Blank",
    description: "Empty file — start from scratch",
    defaultFilename: "untitled.p",
    content: "",
  },
  {
    id: "procedure",
    label: "Procedure (.p)",
    description: "ABL procedure with a main block and an internal procedure",
    defaultFilename: "procedure.p",
    content: `/* ABL procedure */
DEFINE VARIABLE cMessage AS CHARACTER NO-UNDO INITIAL "Hello".

MESSAGE cMessage
  VIEW-AS ALERT-BOX INFO BUTTONS OK.

PROCEDURE DoWork:
  DEFINE INPUT PARAMETER pcValue AS CHARACTER NO-UNDO.
  MESSAGE pcValue VIEW-AS ALERT-BOX INFO.
END PROCEDURE.

RUN DoWork(cMessage).
`,
  },
  {
    id: "class",
    label: "Class (.cls)",
    description: "ABL class with constructor and a sample method",
    defaultFilename: "MyClass.cls",
    content: `/* ABL class */
USING Progress.Lang.*.

CLASS MyClass:

  DEFINE PUBLIC PROPERTY Name AS CHARACTER NO-UNDO
    GET.
    SET.

  CONSTRUCTOR PUBLIC MyClass(INPUT pcName AS CHARACTER):
    THIS-OBJECT:Name = pcName.
  END CONSTRUCTOR.

  METHOD PUBLIC CHARACTER ToString():
    RETURN THIS-OBJECT:Name.
  END METHOD.

END CLASS.
`,
  },
  {
    id: "include",
    label: "Include (.i)",
    description: "Shared include with a utility function stub",
    defaultFilename: "utils.i",
    content: `/* Shared include */

&GLOBAL-DEFINE APP-VERSION 1.0

FUNCTION IsBlank RETURNS LOGICAL
  (INPUT pcValue AS CHARACTER):
  RETURN pcValue = ? OR TRIM(pcValue) = "".
END FUNCTION.
`,
  },
];

export function getTemplate(id: AblTemplateId): AblTemplate {
  return ABL_TEMPLATES.find((t) => t.id === id) ?? ABL_TEMPLATES[0];
}

export function languageForFilename(filename: string): string {
  return languageIdForPath(filename);
}
