import { DocMetadata } from './types';
import { parseJSDoc } from './parser';

class DocRegistry {
  private static instance: DocRegistry;
  private docs: Map<string, DocMetadata> = new Map();

  private constructor() {}

  public static getInstance(): DocRegistry {
    if (!DocRegistry.instance) {
      DocRegistry.instance = new DocRegistry();
    }
    return DocRegistry.instance;
  }

  public register(jsDoc: string, overrides: Partial<DocMetadata> = {}): void {
    const parsed = parseJSDoc(jsDoc);
    const id = overrides.id || parsed.id || parsed.name || Math.random().toString(36).substr(2, 9);

    const metadata: DocMetadata = {
      id,
      name: parsed.name || 'Unnamed',
      description: parsed.description || '',
      type: parsed.type || 'utility',
      params: parsed.params || [],
      returns: parsed.returns,
      examples: parsed.examples || [],
      ...overrides,
    };

    this.docs.set(id, metadata);
  }

  public registerMetadata(metadata: DocMetadata): void {
    this.docs.set(metadata.id, metadata);
  }

  public getDoc(id: string): DocMetadata | undefined {
    return this.docs.get(id);
  }

  public getAllDocs(): DocMetadata[] {
    return Array.from(this.docs.values());
  }

  public clear(): void {
    this.docs.clear();
  }
}

export const docRegistry = DocRegistry.getInstance();
