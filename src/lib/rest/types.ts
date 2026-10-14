export type RestParam = {
  name: string;
  type?: string;
  in?: "path" | "query" | "body" | "header";
};

export type RestOperation = {
  name: string;
  method: string;
  uri: string;
  target: string;
  operation: string;
  params?: RestParam[];
};

export type RestServiceMapping = {
  serviceName: string;
  basePath: string;
  version?: string;
  operations: RestOperation[];
};

export type GeneratedCatalogArtifacts = {
  catalogJson: string;
  resourceModelXml: string;
  paarSketchMd: string;
};
