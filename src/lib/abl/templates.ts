import { languageIdForPath } from "./register";

export type AblTemplateId =
  | "blank"
  | "procedure"
  | "class"
  | "interface"
  | "enum"
  | "abstract-class"
  | "include"
  | "webhandler";

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
    id: "interface",
    label: "Interface (.cls)",
    description: "ABL interface with a sample method signature",
    defaultFilename: "IMyInterface.cls",
    content: `/* ABL interface */
USING Progress.Lang.*.

INTERFACE IMyInterface:

  METHOD PUBLIC CHARACTER GetName().

  METHOD PUBLIC VOID SetName(INPUT pcName AS CHARACTER).

END INTERFACE.
`,
  },
  {
    id: "enum",
    label: "Enum (.cls)",
    description: "ABL enumerated type",
    defaultFilename: "MyEnum.cls",
    content: `/* ABL enum */
ENUM MyEnum:
  DEFINE ENUM None
              Active
              Inactive.
END ENUM.
`,
  },
  {
    id: "abstract-class",
    label: "Abstract class (.cls)",
    description: "Abstract ABL class with an abstract method stub",
    defaultFilename: "MyAbstract.cls",
    content: `/* Abstract ABL class */
USING Progress.Lang.*.

ABSTRACT CLASS MyAbstract:

  DEFINE PUBLIC PROPERTY Id AS INTEGER NO-UNDO
    GET.
    SET.

  CONSTRUCTOR PUBLIC MyAbstract(INPUT piId AS INTEGER):
    THIS-OBJECT:Id = piId.
  END CONSTRUCTOR.

  METHOD ABSTRACT PUBLIC CHARACTER Describe().

  METHOD PUBLIC CHARACTER ToString():
    RETURN STRING(THIS-OBJECT:Id).
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
  {
    id: "webhandler",
    label: "WebHandler (.cls)",
    description:
      "PASOE WEB transport handler (OpenEdge.Web.WebHandler) with HandleGet stub",
    defaultFilename: "MyHandler.cls",
    content: `/* PASOE WebHandler — deploy on WEB transport (not batch _progres). */
USING Progress.Lang.*.
USING OpenEdge.Web.*.
USING OpenEdge.Net.HTTP.*.

CLASS MyHandler INHERITS WebHandler:

  METHOD OVERRIDE PROTECTED INTEGER HandleGet(INPUT poRequest AS IWebRequest):
    /* Read poRequest:PathInfo / query string; write JSON entity. */
    RETURN INTEGER(StatusCodeEnum:OK).
  END METHOD.

  METHOD OVERRIDE PROTECTED INTEGER HandlePost(INPUT poRequest AS IWebRequest):
    RETURN INTEGER(StatusCodeEnum:Created).
  END METHOD.

END CLASS.
`,
  },
];

export function getTemplate(id: AblTemplateId): AblTemplate {
  return ABL_TEMPLATES.find((t) => t.id === id) ?? ABL_TEMPLATES[0];
}

export function languageForFilename(filename: string): string {
  return languageIdForPath(filename);
}

/** Extension from a template default filename (e.g. ".p", ".cls"). */
export function templateExtension(template: AblTemplate): string {
  const name = template.defaultFilename;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot) : "";
}

/**
 * If the filename has no extension, append the selected template's extension.
 * Leaves names that already include a "." suffix unchanged.
 */
export function ensureTemplateExtension(
  filename: string,
  template: AblTemplate
): string {
  const trimmed = filename.trim();
  if (!trimmed) return template.defaultFilename;
  const base = trimmed.includes("/")
    ? trimmed.split("/").pop() || trimmed
    : trimmed;
  if (base.includes(".")) return trimmed;
  const ext = templateExtension(template);
  return ext ? `${trimmed}${ext}` : trimmed;
}
