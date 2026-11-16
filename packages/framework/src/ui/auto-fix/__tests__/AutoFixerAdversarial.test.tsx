import { analyzeError } from '../analyzer';

// Mock MMKV
jest.mock('react-native-mmkv', () => {
  const mockClearAll = jest.fn();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      clearAll: mockClearAll,
    })),
    createMMKV: jest.fn().mockReturnValue({
      clearAll: mockClearAll,
      clear: jest.fn(),
    }),
  };
});

describe('AutoFixer Diagnostics and Recovery Selections', () => {
  it('correctly selects Scaffold Component for Semantic/RDF failures', () => {
    const error = new Error('Missing semantic component for type user-profile');
    const analysis = analyzeError(error);

    expect(analysis.causes).toContain('Missing semantic component configuration or RDF type mapping.');
    expect(analysis.suggestions.map((s) => s.id)).toEqual(
      expect.arrayContaining(['scaffold-component', 'diagnostics', 'rollback'])
    );
  });

  it('correctly selects Wipe State for state-related failures matching older syntax', () => {
    const error = new Error('cannot read property "name" of undefined');
    const analysis = analyzeError(error);

    expect(analysis.isStateRelated).toBe(true);
    expect(analysis.causes).toContain('Potential corrupted local state or unexpected data structure.');
    expect(analysis.suggestions.map((s) => s.id)).toEqual(
      expect.arrayContaining(['wipe-state', 'diagnostics', 'rollback'])
    );
  });

  it('correctly detects state corruption under modern JS engine null/undefined error messages', () => {
    // Modern environments throw "Cannot read properties" (plural)
    const error = new Error('Cannot read properties of null (reading "toString")');
    const analysis = analyzeError(error);

    expect(analysis.isStateRelated).toBe(true);
    expect(analysis.suggestions.map((s) => s.id)).toContain('wipe-state');
  });

  it('correctly selects Reset Session and Schema Sync for network/auth failures', () => {
    const error = new Error('Supabase network error: failed to fetch');
    const analysis = analyzeError(error);

    expect(analysis.causes).toContain('Network or authentication failure.');
    expect(analysis.suggestions.map((s) => s.id)).toEqual(
      expect.arrayContaining(['re-auth', 'db-drift-sync', 'diagnostics', 'rollback'])
    );
  });

  it('handles standard/unknown errors with generic diagnostics and rollback', () => {
    const error = new Error('Generic logic bug');
    const analysis = analyzeError(error);

    expect(analysis.causes).toHaveLength(0);
    expect(analysis.isStateRelated).toBe(false);
    expect(analysis.suggestions.map((s) => s.id)).toEqual(['diagnostics', 'rollback']);
  });

  describe('Adversarial vulnerability checks', () => {
    it('handles a raw string gracefully instead of crashing', () => {
      // In JS, custom code can throw a string: throw "Something broke"
      const errorString = 'Something broke' as any;
      const analysis = analyzeError(errorString);
      expect(analysis).toBeDefined();
      expect(analysis.suggestions.map((s) => s.id)).toContain('rollback');
    });

    it('handles null gracefully instead of crashing', () => {
      // In JS, custom code can throw null: throw null
      const errorNull = null as any;
      const analysis = analyzeError(errorNull);
      expect(analysis).toBeDefined();
      expect(analysis.suggestions.map((s) => s.id)).toContain('rollback');
    });

    it('handles a plain object without message gracefully instead of crashing', () => {
      // In JS: throw { code: 500 }
      const errorObj = { code: 500 } as any;
      const analysis = analyzeError(errorObj);
      expect(analysis).toBeDefined();
      expect(analysis.suggestions.map((s) => s.id)).toContain('rollback');
    });
  });
});
