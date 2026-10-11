/**
 * OpenEdge ABL language reference entries for hover + Documentation pane.
 *
 * External links use Progress ABL Reference page slugs from
 * reference-pages.json (HTTP-verified under docs.progress.com). Progress
 * Zoomin slugs replace spaces with hyphens and drop parentheses/commas —
 * e.g. "NEW function (classes)" → NEW-function-classes.html.
 *
 * Keywords without a dedicated page map to the best existing topic page
 * (e.g. INHERITS → CLASS-statement.html, CHARACTER → Data-types.html).
 */

import { ABL_BUILTIN_FUNCTIONS, ABL_KEYWORDS } from "./keywords";
import verifiedPages from "./reference-pages.json";

export type AblDocCategory =
  | "statement"
  | "function"
  | "operator"
  | "phrase"
  | "reference"
  | "attribute"
  | "preprocessor"
  | "definition"
  | "keyword";

export type AblDocEntry = {
  name: string;
  category: AblDocCategory;
  summary: string;
  /** Formal syntax (Progress-style) */
  syntax: string;
  example?: string;
  /** HTML page under the abl-reference bundle (verified only) */
  docsPage?: string;
};

export const ABL_REFERENCE_BASE =
  "https://docs.progress.com/bundle/abl-reference/page";

/** Browseable index when a keyword has no dedicated verified page. */
export const ABL_REFERENCE_INDEX_PAGE = "ABL-Syntax-Reference.html";

const VERIFIED_PAGES: Record<string, string> = verifiedPages;

/** Resolve a Progress docs page slug for a keyword, or undefined if unknown. */
export function resolveDocsPage(name: string): string | undefined {
  return VERIFIED_PAGES[name.toUpperCase()];
}

export function ablReferenceUrl(page: string): string {
  const clean = page.replace(/^\//, "");
  return `${ABL_REFERENCE_BASE}/${clean}`;
}

export function ablReferenceUrlForKeyword(name: string): string | null {
  const page = resolveDocsPage(name);
  return page ? ablReferenceUrl(page) : null;
}

const CURATED: AblDocEntry[] = [
  {
    name: "FOR",
    category: "statement",
    summary:
      "Starts an iterating block that reads a record from one or more tables at the start of each block iteration. End the block with END.",
    syntax: `[label:]
FOR [ EACH | FIRST | LAST ] record-phrase
    [ , [ EACH | FIRST | LAST ] record-phrase ]...
    [ BREAK ]
    [ BY expression [ DESCENDING ] ]...
    [ WHILE expression ]
    [ TRANSACTION ]
    [ NO-LOCK | SHARE-LOCK | EXCLUSIVE-LOCK ]
    :
  /* statements */
END.`,
    example: `FOR EACH Customer NO-LOCK WHERE Customer.Balance < 1000:
  DISPLAY Customer.Name.
END.`,
    docsPage: "FOR-statement.html",
  },
  {
    name: "DEFINE",
    category: "statement",
    summary:
      "Introduces a definition (VARIABLE, TEMP-TABLE, BUFFER, PARAMETER, PROPERTY, QUERY, …).",
    syntax: `DEFINE
  [ PUBLIC | PROTECTED | PRIVATE | PACKAGE-PRIVATE ]
  [ STATIC | ABSTRACT | OVERRIDE | FINAL ]
  { VARIABLE name AS data-type
  | PROPERTY name AS data-type
  | TEMP-TABLE name ...
  | BUFFER name FOR table
  | PARAMETER ...
  | ... }
  [ NO-UNDO ] [ INITIAL value ].`,
    example: `DEFINE VARIABLE cName AS CHARACTER NO-UNDO INITIAL "".
DEFINE PUBLIC PROPERTY Id AS INTEGER NO-UNDO
  GET.
  SET.`,
    docsPage: "DEFINE-VARIABLE-statement.html",
  },
  {
    name: "VARIABLE",
    category: "definition",
    summary: "Used with DEFINE to declare a typed variable.",
    syntax: `DEFINE [ access ] VARIABLE name AS data-type
  [ NO-UNDO ] [ INITIAL expression ] [ EXTENT n ].`,
    example: `DEFINE VARIABLE iCount AS INTEGER NO-UNDO INITIAL 0.`,
    docsPage: "DEFINE-VARIABLE-statement.html",
  },
  {
    name: "TEMP-TABLE",
    category: "definition",
    summary: "Defines an in-memory table for working sets and parameters.",
    syntax: `DEFINE TEMP-TABLE name [ NO-UNDO ]
  FIELD field-name AS data-type ...
  [ INDEX index-name field-name ... ].`,
    example: `DEFINE TEMP-TABLE ttCust NO-UNDO
  FIELD CustNum AS INTEGER
  FIELD Name AS CHARACTER
  INDEX idxCust CustNum.`,
    docsPage: "DEFINE-TEMP-TABLE-statement.html",
  },
  {
    name: "IF",
    category: "statement",
    summary: "Conditional execution (statement form) or conditional expression (function form).",
    syntax: `/* Statement */
IF expression THEN
  { statement | block }
[ ELSE
  { statement | block } ]

/* Function */
IF expression THEN true-expression ELSE false-expression`,
    example: `IF AVAILABLE Customer THEN
  DISPLAY Customer.Name.
ELSE
  MESSAGE "Not found".`,
    docsPage: "IF...THEN...ELSE-statement.html",
  },
  {
    name: "THEN",
    category: "keyword",
    summary: "Introduces the true branch of an IF statement or function.",
    syntax: `IF expression THEN { statement | expression }`,
    docsPage: "IF...THEN...ELSE-statement.html",
  },
  {
    name: "ELSE",
    category: "keyword",
    summary: "Introduces the false branch of an IF statement or function.",
    syntax: `IF expression THEN ... ELSE ...`,
    docsPage: "IF...THEN...ELSE-statement.html",
  },
  {
    name: "DO",
    category: "statement",
    summary: "Begins a DO block (optionally with WHILE, TRANSACTION, or other block header options).",
    syntax: `[label:]
DO [ WHILE expression ]
   [ TRANSACTION ]
   [ ON ERROR UNDO, THROW ] :
  /* statements */
END.`,
    example: `DO i = 1 TO 10:
  DISPLAY i.
END.`,
    docsPage: "DO-statement.html",
  },
  {
    name: "REPEAT",
    category: "statement",
    summary: "Begins a REPEAT block that iterates until LEAVE or a terminating condition.",
    syntax: `[label:]
REPEAT [ WHILE expression ]
       [ TRANSACTION ] :
  /* statements */
END.`,
    example: `REPEAT:
  FIND NEXT Customer NO-LOCK NO-ERROR.
  IF NOT AVAILABLE Customer THEN LEAVE.
  DISPLAY Customer.Name.
END.`,
    docsPage: "REPEAT-statement.html",
  },
  {
    name: "CASE",
    category: "statement",
    summary: "Multi-way branch on an expression.",
    syntax: `CASE expression:
  WHEN value THEN
    { statement | block }
  ...
  [ OTHERWISE
    { statement | block } ]
END CASE.`,
    example: `CASE cStatus:
  WHEN "A" THEN MESSAGE "Active".
  WHEN "I" THEN MESSAGE "Inactive".
  OTHERWISE MESSAGE "Unknown".
END CASE.`,
    docsPage: "CASE-statement.html",
  },
  {
    name: "PROCEDURE",
    category: "statement",
    summary: "Defines an internal or external procedure.",
    syntax: `PROCEDURE name [ PRIVATE ] :
  [ DEFINE PARAMETER ... . ]
  /* statements */
END PROCEDURE.`,
    example: `PROCEDURE SayHello:
  DEFINE INPUT PARAMETER pcName AS CHARACTER NO-UNDO.
  MESSAGE "Hello" pcName.
END PROCEDURE.`,
    docsPage: "PROCEDURE-statement.html",
  },
  {
    name: "FUNCTION",
    category: "statement",
    summary: "Defines a user-defined function.",
    syntax: `FUNCTION name RETURNS data-type
  [ ( parameter-definitions ) ]
  [ FORWARD | IN SUPER | ... ] :
  /* statements */
  RETURN expression.
END FUNCTION.`,
    example: `FUNCTION IsBlank RETURNS LOGICAL
  (INPUT pcValue AS CHARACTER):
  RETURN pcValue = ? OR TRIM(pcValue) = "".
END FUNCTION.`,
    docsPage: "FUNCTION-statement.html",
  },
  {
    name: "CLASS",
    category: "statement",
    summary: "Defines an ABL class type.",
    syntax: `[ ABSTRACT | FINAL | SERIALIZABLE ]
CLASS class-name
  [ INHERITS super-class ]
  [ IMPLEMENTS interface-name [, interface-name ]... ]
  [ USE-WIDGET-POOL ] :
  /* members */
END CLASS.`,
    example: `CLASS samples.Customer:
  DEFINE PUBLIC PROPERTY Name AS CHARACTER NO-UNDO GET. SET.
  CONSTRUCTOR PUBLIC Customer():
  END CONSTRUCTOR.
END CLASS.`,
    docsPage: "CLASS-statement.html",
  },
  {
    name: "INTERFACE",
    category: "statement",
    summary: "Defines an ABL interface type.",
    syntax: `INTERFACE interface-name
  [ INHERITS interface-name [, interface-name ]... ] :
  /* method / property signatures */
END INTERFACE.`,
    example: `INTERFACE INamed:
  METHOD PUBLIC CHARACTER GetName().
END INTERFACE.`,
    docsPage: "INTERFACE-statement.html",
  },
  {
    name: "ENUM",
    category: "statement",
    summary: "Defines an ABL enumerated type.",
    syntax: `ENUM enum-name [ FLAGS ] :
  DEFINE ENUM member [ = expression ] ... .
END ENUM.`,
    example: `ENUM StatusEnum:
  DEFINE ENUM None
              Active
              Inactive.
END ENUM.`,
    docsPage: "ENUM-statement.html",
  },
  {
    name: "METHOD",
    category: "statement",
    summary: "Defines a class or interface method.",
    syntax: `METHOD
  [ PUBLIC | PROTECTED | PRIVATE | PACKAGE-PRIVATE ]
  [ STATIC | ABSTRACT | OVERRIDE | FINAL ]
  return-type method-name ( [ parameters ] )
  [ : /* body */ END METHOD. | . ]`,
    example: `METHOD PUBLIC VOID AddCharge(INPUT pdAmount AS DECIMAL):
  THIS-OBJECT:Balance = THIS-OBJECT:Balance + pdAmount.
END METHOD.`,
    docsPage: "METHOD-statement.html",
  },
  {
    name: "CONSTRUCTOR",
    category: "statement",
    summary: "Defines a class constructor.",
    syntax: `CONSTRUCTOR [ PUBLIC | PROTECTED | PRIVATE ] class-name
  ( [ parameters ] ) :
  /* statements */
END CONSTRUCTOR.`,
    example: `CONSTRUCTOR PUBLIC Customer(INPUT pcName AS CHARACTER):
  THIS-OBJECT:Name = pcName.
END CONSTRUCTOR.`,
    docsPage: "CONSTRUCTOR-statement.html",
  },
  {
    name: "DESTRUCTOR",
    category: "statement",
    summary: "Defines a class destructor.",
    syntax: `DESTRUCTOR [ PUBLIC ] class-name ( ) :
  /* statements */
END DESTRUCTOR.`,
    example: `DESTRUCTOR PUBLIC Customer():
  /* cleanup */
END DESTRUCTOR.`,
    docsPage: "DESTRUCTOR-statement.html",
  },
  {
    name: "PROPERTY",
    category: "definition",
    summary: "Defines a class property with GET / SET accessors.",
    syntax: `DEFINE
  [ PUBLIC | PROTECTED | PRIVATE | PACKAGE-PRIVATE ]
  [ STATIC | ABSTRACT | OVERRIDE | FINAL ]
  PROPERTY name AS data-type [ NO-UNDO ]
  [ GET [ : /* */ END GET. | . ] ]
  [ SET [ : /* */ END SET. | . ] ].`,
    example: `DEFINE PUBLIC PROPERTY Name AS CHARACTER NO-UNDO
  GET.
  SET.`,
    docsPage: "DEFINE-PROPERTY-statement.html",
  },
  {
    name: "USING",
    category: "statement",
    summary: "Imports a type or package into the compilation unit.",
    syntax: `USING { type-name | package-name.* }
  [ FROM { PROPATH | ASSEMBLY assembly-name } ].`,
    example: `USING Progress.Lang.*.
USING samples.Customer.`,
    docsPage: "USING-statement.html",
  },
  {
    name: "INHERITS",
    category: "keyword",
    summary: "Specifies the superclass for a CLASS (or parent interfaces for an INTERFACE).",
    syntax: `CLASS class-name INHERITS super-class-name :`,
    docsPage: "CLASS-statement.html",
  },
  {
    name: "IMPLEMENTS",
    category: "keyword",
    summary: "Lists interfaces implemented by a class.",
    syntax: `CLASS class-name IMPLEMENTS interface-name [, interface-name ]... :`,
    docsPage: "CLASS-statement.html",
  },
  {
    name: "THIS-OBJECT",
    category: "reference",
    summary: "Refers to the current class instance (like “this” / “Me”).",
    syntax: `THIS-OBJECT
THIS-OBJECT : member-name
THIS-OBJECT : method-name ( arguments )`,
    example: `THIS-OBJECT:Name = pcName.
RETURN THIS-OBJECT:ToString().`,
    docsPage: "THIS-OBJECT-system-reference.html",
  },
  {
    name: "SUPER",
    category: "reference",
    summary:
      "Refers to the superclass (run SUPER, SUPER:member, or SUPER() constructor call).",
    syntax: `SUPER ( [ arguments ] ).
SUPER : method-name ( [ arguments ] ).
RUN SUPER ( [ arguments ] ).`,
    example: `CONSTRUCTOR PUBLIC Child():
  SUPER().
END CONSTRUCTOR.`,
    docsPage: "SUPER-system-reference.html",
  },
  {
    name: "NEW",
    category: "statement",
    summary:
      "Constructs a class instance (object-oriented) or marks a newly created database record.",
    syntax: `/* OOP */
NEW class-name ( [ arguments ] )

/* Record */
FIND ... WHERE ... /* NEW function on buffer */`,
    example: `DEFINE VARIABLE oCust AS CLASS samples.Customer NO-UNDO.
oCust = NEW samples.Customer(1, "Acme").`,
    docsPage: "NEW-numeric-function.html",
  },
  {
    name: "CAST",
    category: "function",
    summary: "Casts an object reference to another type known at compile time.",
    syntax: `CAST ( object-reference , type-name )`,
    example: `DEFINE VARIABLE oObj AS Progress.Lang.Object NO-UNDO.
DEFINE VARIABLE oCust AS CLASS samples.Customer NO-UNDO.
oCust = CAST(oObj, samples.Customer).`,
    docsPage: "CAST-function.html",
  },
  {
    name: "ASSIGN",
    category: "statement",
    summary: "Assigns one or more values in a single statement.",
    syntax: `ASSIGN
  { variable | field } = expression
  [ { variable | field } = expression ]...
  [ NO-ERROR ].`,
    example: `ASSIGN
  cName   = Customer.Name
  iCustNum = Customer.CustNum.`,
    docsPage: "ASSIGN-statement.html",
  },
  {
    name: "FIND",
    category: "statement",
    summary: "Locates a single matching record in a buffer.",
    syntax: `FIND [ FIRST | LAST | NEXT | PREV | CURRENT ]
  record-phrase
  [ NO-LOCK | SHARE-LOCK | EXCLUSIVE-LOCK ]
  [ NO-WAIT ] [ NO-ERROR ].`,
    example: `FIND FIRST Customer NO-LOCK
  WHERE Customer.CustNum = 1 NO-ERROR.
IF AVAILABLE Customer THEN DISPLAY Customer.Name.`,
    docsPage: "FIND-statement.html",
  },
  {
    name: "MESSAGE",
    category: "statement",
    summary: "Displays a message to the user (optionally as an alert box).",
    syntax: `MESSAGE expression ...
  [ VIEW-AS ALERT-BOX [ alert-type ]
      [ BUTTONS button-set ] ].`,
    example: `MESSAGE "Hello" VIEW-AS ALERT-BOX INFO BUTTONS OK.`,
    docsPage: "MESSAGE-statement.html",
  },
  {
    name: "RUN",
    category: "statement",
    summary: "Invokes an external or internal procedure.",
    syntax: `RUN procedure-name
  [ ( input-parameters ) ]
  [ IN handle ]
  [ PERSISTENT [ SET handle ] ]
  [ NO-ERROR ].`,
    example: `RUN SayHello("World").`,
    docsPage: "RUN-statement.html",
  },
  {
    name: "RETURN",
    category: "statement",
    summary: "Returns from a procedure, function, or method.",
    syntax: `RETURN [ expression | ERROR | NO-APPLY ].`,
    example: `RETURN SUBSTITUTE("Hi &1", pcName).`,
    docsPage: "RETURN-statement.html",
  },
  {
    name: "CATCH",
    category: "statement",
    summary: "Handles a thrown error object in a structured block.",
    syntax: `CATCH error-variable AS [ CLASS ] error-class-name :
  /* statements */
END CATCH.`,
    example: `CATCH e AS Progress.Lang.Error:
  MESSAGE e:GetMessage(1) VIEW-AS ALERT-BOX ERROR.
END CATCH.`,
    docsPage: "CATCH-statement.html",
  },
  {
    name: "FINALLY",
    category: "statement",
    summary: "Runs cleanup after a block whether or not an error occurred.",
    syntax: `FINALLY:
  /* statements */
END FINALLY.`,
    docsPage: "FINALLY-statement.html",
  },
  {
    name: "THROW",
    category: "statement",
    summary: "Throws an error object to be handled by CATCH or the caller.",
    syntax: `UNDO, THROW error-object.
THROW error-object.`,
    docsPage: "THROW-statement.html",
  },
  {
    name: "AVAILABLE",
    category: "function",
    summary: "Returns TRUE if the specified buffer has a current record.",
    syntax: `AVAILABLE ( buffer-name )
AVAILABLE buffer-name`,
    example: `IF AVAILABLE Customer THEN DISPLAY Customer.Name.`,
    docsPage: "AVAILABLE-function.html",
  },
  {
    name: "SUBSTITUTE",
    category: "function",
    summary: "Formats a string by replacing &1, &2, … with argument values.",
    syntax: `SUBSTITUTE ( format-string [ , expression ]... )`,
    example: `SUBSTITUTE("Hello &1, balance=&2", cName, dBal)`,
    docsPage: "SUBSTITUTE-function.html",
  },
  {
    name: "STRING",
    category: "function",
    summary: "Converts an expression to CHARACTER.",
    syntax: `STRING ( expression [ , format ] )`,
    example: `STRING(1234.5, "->>,>>9.99")`,
    docsPage: "STRING-function.html",
  },
  {
    name: "TRIM",
    category: "function",
    summary: "Removes leading and trailing whitespace (or specified characters).",
    syntax: `TRIM ( string [ , character-expression ] )`,
    example: `TRIM("  abc  ") /* "abc" */`,
    docsPage: "TRIM-function.html",
  },
  {
    name: "LENGTH",
    category: "function",
    summary: "Returns the length of a character, longchar, raw, or memptr value.",
    syntax: `LENGTH ( expression [ , type ] )`,
    example: `LENGTH("ABC") /* 3 */`,
    docsPage: "LENGTH-function.html",
  },
  {
    name: "SUBSTRING",
    category: "function",
    summary: "Extracts or (in some forms) replaces a substring.",
    syntax: `SUBSTRING ( expression , position [ , length [ , type ] ] )`,
    example: `SUBSTRING("ABCDEF", 2, 3) /* "BCD" */`,
    docsPage: "SUBSTRING-function.html",
  },
  {
    name: "ENTRY",
    category: "function",
    summary: "Returns an entry from a delimited list.",
    syntax: `ENTRY ( entry-number , list [ , character ] )`,
    example: `ENTRY(2, "a,b,c") /* "b" */`,
    docsPage: "ENTRY-function.html",
  },
  {
    name: "LOOKUP",
    category: "function",
    summary: "Returns the 1-based index of an item in a delimited list (0 if not found).",
    syntax: `LOOKUP ( expression , list [ , character ] )`,
    example: `LOOKUP("b", "a,b,c") /* 2 */`,
    docsPage: "LOOKUP-function.html",
  },
  {
    name: "NUM-ENTRIES",
    category: "function",
    summary: "Returns the number of entries in a delimited list.",
    syntax: `NUM-ENTRIES ( list [ , character ] )`,
    example: `NUM-ENTRIES("a,b,c") /* 3 */`,
    docsPage: "NUM-ENTRIES-function.html",
  },
  {
    name: "INTEGER",
    category: "function",
    summary: "Converts an expression to INTEGER.",
    syntax: `INTEGER ( expression )`,
    docsPage: "INTEGER-function.html",
  },
  {
    name: "DECIMAL",
    category: "function",
    summary: "Converts an expression to DECIMAL.",
    syntax: `DECIMAL ( expression )`,
    docsPage: "DECIMAL-function.html",
  },
  {
    name: "LOGICAL",
    category: "function",
    summary: "Converts an expression to LOGICAL.",
    syntax: `LOGICAL ( expression [ , format ] )`,
    docsPage: "LOGICAL-function.html",
  },
  {
    name: "DYNAMIC-CAST",
    category: "function",
    summary: "Casts an object to a type known at runtime.",
    syntax: `DYNAMIC-CAST ( object-reference , type-name-expression )`,
    docsPage: "DYNAMIC-CAST-function.html",
  },
  {
    name: "DYNAMIC-NEW",
    category: "function",
    summary: "Constructs a class instance by type name at runtime.",
    syntax: `DYNAMIC-NEW type-name-expression ( [ arguments ] )`,
    docsPage: "DYNAMIC-NEW-function.html",
  },
  {
    name: "DYNAMIC-INVOKE",
    category: "function",
    summary: "Invokes a method by name at runtime.",
    syntax: `DYNAMIC-INVOKE ( object-reference , method-name [ , args ]... )`,
    docsPage: "DYNAMIC-INVOKE-function.html",
  },
  {
    name: "TYPE-OF",
    category: "function",
    summary: "Returns TRUE if an object is of (or inherits) the given type.",
    syntax: `TYPE-OF ( object-reference , type-name )`,
    docsPage: "TYPE-OF-function.html",
  },
  {
    name: "VALID-OBJECT",
    category: "function",
    summary: "Returns TRUE if an object reference is valid (not ?).",
    syntax: `VALID-OBJECT ( object-reference )`,
    docsPage: "VALID-OBJECT-function.html",
  },
  {
    name: "VALID-HANDLE",
    category: "function",
    summary: "Returns TRUE if a handle is valid.",
    syntax: `VALID-HANDLE ( handle-expression )`,
    docsPage: "VALID-HANDLE-function.html",
  },
  {
    name: "CAN-FIND",
    category: "function",
    summary: "Returns TRUE if a matching record exists, without creating a buffer context.",
    syntax: `CAN-FIND ( record-phrase )`,
    example: `IF CAN-FIND(FIRST Customer WHERE Customer.CustNum = 1) THEN ...`,
    docsPage: "CAN-FIND-function.html",
  },
  {
    name: "NO-LOCK",
    category: "phrase",
    summary: "Reads records without taking a record lock.",
    syntax: `{ FIND | FOR EACH | ... } record-phrase NO-LOCK`,
    docsPage: "Record-phrase.html",
  },
  {
    name: "SHARE-LOCK",
    category: "phrase",
    summary: "Takes a share lock on a retrieved record.",
    syntax: `{ FIND | FOR EACH | ... } record-phrase SHARE-LOCK`,
    docsPage: "Record-phrase.html",
  },
  {
    name: "EXCLUSIVE-LOCK",
    category: "phrase",
    summary: "Takes an exclusive lock on a retrieved record.",
    syntax: `{ FIND | FOR EACH | ... } record-phrase EXCLUSIVE-LOCK`,
    docsPage: "Record-phrase.html",
  },
  {
    name: "NO-UNDO",
    category: "phrase",
    summary: "Disables undo recording for a variable or temp-table.",
    syntax: `DEFINE VARIABLE name AS data-type NO-UNDO.`,
    docsPage: "DEFINE-VARIABLE-statement.html",
  },
  {
    name: "VIEW-AS",
    category: "phrase",
    summary: "Specifies the UI representation of a widget or MESSAGE alert.",
    syntax: `VIEW-AS { ALERT-BOX | EDITOR | FILL-IN | ... }`,
    docsPage: "VIEW-AS-phrase.html",
  },
  {
    name: "PUBLIC",
    category: "keyword",
    summary: "Member accessible outside the defining class.",
    syntax: `METHOD PUBLIC return-type Name (...):
DEFINE PUBLIC PROPERTY Name AS data-type ...`,
    docsPage: "CLASS-statement.html",
  },
  {
    name: "PROTECTED",
    category: "keyword",
    summary: "Member accessible in the defining class and its subclasses.",
    syntax: `METHOD PROTECTED return-type Name (...):`,
    docsPage: "CLASS-statement.html",
  },
  {
    name: "PRIVATE",
    category: "keyword",
    summary: "Member accessible only inside the defining class.",
    syntax: `METHOD PRIVATE return-type Name (...):`,
    docsPage: "CLASS-statement.html",
  },
  {
    name: "PACKAGE-PRIVATE",
    category: "keyword",
    summary: "Member accessible within the same package.",
    syntax: `METHOD PACKAGE-PRIVATE return-type Name (...):`,
    docsPage: "CLASS-statement.html",
  },
  {
    name: "STATIC",
    category: "keyword",
    summary: "Member belongs to the type rather than an instance.",
    syntax: `METHOD PUBLIC STATIC VOID Log(...):
DEFINE PUBLIC STATIC PROPERTY Count AS INTEGER ...`,
    docsPage: "CLASS-statement.html",
  },
  {
    name: "ABSTRACT",
    category: "keyword",
    summary: "Class or member that must be implemented by a concrete subclass.",
    syntax: `ABSTRACT CLASS Base:
  METHOD PUBLIC ABSTRACT VOID Run().
END CLASS.`,
    docsPage: "CLASS-statement.html",
  },
  {
    name: "OVERRIDE",
    category: "keyword",
    summary: "Overrides an inherited method or property.",
    syntax: `METHOD PUBLIC OVERRIDE CHARACTER ToString():`,
    docsPage: "METHOD-statement.html",
  },
  {
    name: "FINAL",
    category: "keyword",
    summary: "Prevents further overriding (member) or subclassing (class).",
    syntax: `FINAL CLASS SealedClass:
METHOD PUBLIC FINAL VOID Freeze():`,
    docsPage: "CLASS-statement.html",
  },
  {
    name: "VOID",
    category: "keyword",
    summary: "Method return type indicating no return value.",
    syntax: `METHOD PUBLIC VOID DoWork():
  /* no RETURN value */
END METHOD.`,
    docsPage: "METHOD-statement.html",
  },
  {
    name: "EVENT",
    category: "definition",
    summary: "Defines a class event.",
    syntax: `DEFINE [ access ] [ STATIC ] EVENT event-name
  SIGNATURE VOID ( parameters ).`,
    docsPage: "DEFINE-EVENT-statement.html",
  },
  {
    name: "SERIALIZABLE",
    category: "keyword",
    summary: "Marks a class as serializable for object serialization.",
    syntax: `SERIALIZABLE CLASS MyData:`,
    docsPage: "CLASS-statement.html",
  },
  {
    name: "ROUTINE-LEVEL",
    category: "statement",
    summary: "Sets routine-level default error handling.",
    syntax: `ROUTINE-LEVEL ON ERROR UNDO, THROW.`,
    docsPage: "ROUTINE-LEVEL-ON-ERROR-UNDO-THROW-statement.html",
  },
  {
    name: "BLOCK-LEVEL",
    category: "statement",
    summary: "Sets block-level default error handling.",
    syntax: `BLOCK-LEVEL ON ERROR UNDO, THROW.`,
    docsPage: "BLOCK-LEVEL-ON-ERROR-UNDO-THROW-statement.html",
  },
  {
    name: "END",
    category: "statement",
    summary: "Closes a block such as DO, FOR, CLASS, METHOD, or CASE.",
    syntax: `END [ block-type ] [ . ]`,
    example: `END.
END METHOD.
END CLASS.`,
    docsPage: "END-statement.html",
  },
  {
    name: "WHERE",
    category: "phrase",
    summary: "Restricts a query or FOR/FIND record set with a condition.",
    syntax: `{ FOR EACH | FIND | OPEN QUERY } ... WHERE expression`,
    docsPage: "Record-phrase.html",
  },
  {
    name: "EACH",
    category: "keyword",
    summary: "Iterates every matching record in a FOR block.",
    syntax: `FOR EACH record-phrase :`,
    docsPage: "FOR-statement.html",
  },
  {
    name: "CREATE",
    category: "statement",
    summary: "Creates a database record, object, or other entity.",
    syntax: `CREATE record [ NO-ERROR ].
CREATE object-type-name expression [ NO-ERROR ].`,
    docsPage: "CREATE-statement.html",
  },
  {
    name: "DELETE",
    category: "statement",
    summary: "Deletes a record or object.",
    syntax: `DELETE record [ VALIDATE ( ... ) ] [ NO-ERROR ].
DELETE OBJECT object-reference [ NO-ERROR ].`,
    docsPage: "DELETE-statement.html",
  },
];

const STATEMENT_HINTS = new Set([
  "DEFINE",
  "ASSIGN",
  "CREATE",
  "DELETE",
  "FIND",
  "FOR",
  "IF",
  "DO",
  "REPEAT",
  "CASE",
  "PROCEDURE",
  "FUNCTION",
  "CLASS",
  "INTERFACE",
  "ENUM",
  "METHOD",
  "CONSTRUCTOR",
  "DESTRUCTOR",
  "USING",
  "RUN",
  "RETURN",
  "MESSAGE",
  "CATCH",
  "FINALLY",
  "THROW",
  "UNDO",
  "LEAVE",
  "NEXT",
  "PAUSE",
  "QUIT",
  "STOP",
  "PUBLISH",
  "SUBSCRIBE",
  "IMPORT",
  "EXPORT",
  "UPDATE",
  "DISPLAY",
  "ENABLE",
  "DISABLE",
  "APPLY",
  "OPEN",
  "CLOSE",
  "RELEASE",
  "VALIDATE",
]);

function inferCategory(name: string, isBuiltin: boolean): AblDocCategory {
  const key = name.toUpperCase();
  if (isBuiltin) return "function";
  if (STATEMENT_HINTS.has(key)) return "statement";
  if (key.endsWith("-LOCK") || key === "NO-UNDO" || key === "NO-ERROR") {
    return "phrase";
  }
  if (key === "THIS-OBJECT" || key === "THIS-PROCEDURE" || key === "SUPER") {
    return "reference";
  }
  if (key.startsWith("&")) return "preprocessor";
  return "keyword";
}

function defaultSyntax(name: string, category: AblDocCategory): string {
  switch (category) {
    case "function":
      return `${name} ( expression [ , expression ]... )`;
    case "statement":
      return `${name} ... .`;
    case "phrase":
      return `... ${name} ...`;
    case "reference":
      return `${name}\n${name} : member`;
    default:
      return name;
  }
}

const byName = new Map<string, AblDocEntry>();

for (const entry of CURATED) {
  const key = entry.name.toUpperCase();
  // Prefer verified TOC slug; drop curated pages that 404
  byName.set(key, {
    ...entry,
    docsPage: resolveDocsPage(key) ?? undefined,
  });
}

for (const fn of ABL_BUILTIN_FUNCTIONS) {
  const key = fn.toUpperCase();
  if (byName.has(key)) continue;
  byName.set(key, {
    name: key,
    category: "function",
    summary: `Built-in ABL function ${key}.`,
    syntax: defaultSyntax(key, "function"),
    docsPage: resolveDocsPage(key),
  });
}

for (const kw of ABL_KEYWORDS) {
  const key = kw.toUpperCase();
  if (byName.has(key)) continue;
  const category = inferCategory(key, false);
  byName.set(key, {
    name: key,
    category,
    summary: `OpenEdge ABL ${category} \`${key}\`.`,
    syntax: defaultSyntax(key, category),
    docsPage: resolveDocsPage(key),
  });
}

export function getAblDocEntry(name: string): AblDocEntry | null {
  return byName.get(name.toUpperCase()) ?? null;
}

export function listAblDocEntries(): AblDocEntry[] {
  return Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export function searchAblDocs(query: string): AblDocEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return listAblDocEntries();
  return listAblDocEntries().filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      e.category.includes(q)
  );
}

export function categoryLabel(category: AblDocCategory): string {
  switch (category) {
    case "statement":
      return "Statement";
    case "function":
      return "Function";
    case "operator":
      return "Operator";
    case "phrase":
      return "Phrase";
    case "reference":
      return "System reference";
    case "attribute":
      return "Attribute";
    case "preprocessor":
      return "Preprocessor";
    case "definition":
      return "Definition";
    default:
      return "Keyword";
  }
}
