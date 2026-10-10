import type { languages } from "monaco-editor";
import { ABL_KEYWORDS } from "./keywords";

const uniqueKeywords = Array.from(new Set(ABL_KEYWORDS.map((k) => k.toLowerCase())));

export const ablLanguageConfig: languages.LanguageConfiguration = {
  comments: {
    lineComment: "//",
    blockComment: ["/*", "*/"],
  },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  wordPattern:
    /(-?\d*\.\d\w*)|([^`~!@#%^&*()\-=+[{\]}\\|;:'",.<>/?\s]+)/g,
};

export const ablMonarchTokens: languages.IMonarchLanguage = {
  defaultToken: "",
  ignoreCase: true,
  tokenPostfix: ".abl",

  keywords: uniqueKeywords,

  operators: [
    "=",
    "<>",
    ">",
    "<",
    ">=",
    "<=",
    "+",
    "-",
    "*",
    "/",
    ":",
    ".",
    ",",
    "EQ",
    "NE",
    "GT",
    "LT",
    "GE",
    "LE",
  ],

  symbols: /[=><!~?:&|+\-*/^%]+/,

  tokenizer: {
    root: [
      // Preprocessor {&name} and {include.i}
      [/\{&[A-Za-z0-9_\-]+\}/, "preprocessor"],
      [/\{[^}]+\}/, "preprocessor"],

      // Whitespace
      [/[ \t\r\n]+/, "white"],

      // Comments
      [/\/\*/, "comment", "@comment"],
      [/\/\/.*$/, "comment"],

      // Strings
      [/"([^"\\]|\\.)*$/, "string.invalid"],
      [/'([^'\\]|\\.)*$/, "string.invalid"],
      [/"/, "string", "@string_double"],
      [/'/, "string", "@string_single"],

      // Numbers
      [/\d*\.\d+([eE][-+]?\d+)?/, "number.float"],
      [/\d+/, "number"],

      // Identifiers / keywords
      [
        /[a-zA-Z_][\w\-]*/,
        {
          cases: {
            "@keywords": "keyword",
            "@default": "identifier",
          },
        },
      ],

      // Delimiters and operators
      [/[{}()[\]]/, "@brackets"],
      [/@symbols/, "operator"],
      [/[,;.]/, "delimiter"],
    ],

    comment: [
      [/[^/*]+/, "comment"],
      [/\*\//, "comment", "@pop"],
      [/./, "comment"],
    ],

    string_double: [
      [/[^\\"]+/, "string"],
      [/\\./, "string.escape"],
      [/"/, "string", "@pop"],
    ],

    string_single: [
      [/[^\\']+/, "string"],
      [/\\./, "string.escape"],
      [/'/, "string", "@pop"],
    ],
  },
};
