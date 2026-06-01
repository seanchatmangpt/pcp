export interface DocParam {
  name: string;
  type: string;
  description: string;
  optional?: boolean;
}

export interface DocExample {
  title?: string;
  code: string;
}

export interface DocMetadata {
  id: string;
  name: string;
  description: string;
  type: 'hook' | 'component' | 'utility';
  params?: DocParam[];
  returns?: {
    type: string;
    description: string;
  };
  examples?: DocExample[];
  usage?: string;
  sourcePath?: string;
}

export interface DocRegistryState {
  docs: Record<string, DocMetadata>;
}
