import { docRegistry } from '../DocRegistry';

describe('DocRegistry', () => {
  beforeEach(() => {
    docRegistry.clear();
  });

  it('should register and retrieve docs', () => {
    const jsDoc = `
      /**
       * @name useAuth
       * @description Auth hook
       */
    `;
    docRegistry.register(jsDoc);
    const docs = docRegistry.getAllDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe('useAuth');
  });

  it('should allow overrides during registration', () => {
    const jsDoc = `
      /**
       * @name useAuth
       */
    `;
    docRegistry.register(jsDoc, { id: 'custom-id', type: 'hook' });
    const doc = docRegistry.getDoc('custom-id');
    expect(doc).toBeDefined();
    expect(doc?.type).toBe('hook');
  });

  it('should register metadata directly', () => {
    docRegistry.registerMetadata({
      id: 'manual',
      name: 'Manual',
      description: 'Manual doc',
      type: 'utility',
    });
    expect(docRegistry.getDoc('manual')).toBeDefined();
  });

  it('should generate random id if none provided', () => {
    docRegistry.register('/** @description No name or id */');
    const docs = docRegistry.getAllDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBeDefined();
    expect(docs[0].name).toBe('Unnamed');
  });
});
