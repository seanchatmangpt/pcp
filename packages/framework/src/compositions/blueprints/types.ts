export interface BlueprintFile {
  path: string;
  content: string;
}

export interface CompositionalBlueprint {
  name: string;
  description: string;
  generate: (name: string, options?: any) => BlueprintFile[];
}
