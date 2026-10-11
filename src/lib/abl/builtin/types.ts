/** Schema for Progress.* / OpenEdge.* built-in type catalog JSON. */

export type BuiltinMemberKind =
  | "method"
  | "property"
  | "constructor"
  | "destructor"
  | "event"
  | "enum";

export type BuiltinTypeKind = "class" | "interface" | "enum" | "type";

export type BuiltinMember = {
  name: string;
  kind: BuiltinMemberKind;
  access?: string;
  detail: string;
  signature: string;
  summary?: string;
  /** Optional member-level Progress docs page slug or absolute URL */
  docsUrl?: string;
};

export type BuiltinType = {
  name: string;
  kind: BuiltinTypeKind;
  summary: string;
  signature: string;
  /** Absolute external documentation URL (verified) */
  docsUrl: string;
  example?: string;
  inherits?: string;
  implements?: string[];
  members: BuiltinMember[];
};

export type BuiltinCatalogFile = {
  source: string;
  types: BuiltinType[];
};
