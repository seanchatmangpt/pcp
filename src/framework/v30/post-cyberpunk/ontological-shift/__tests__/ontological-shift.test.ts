import { renderHook, act } from '@testing-library/react-native';
import { useOntologicalDrift, FieldMapping, RdfDefinition } from '../useOntologicalDrift';

describe('Ontological Shift Engine - useOntologicalDrift', () => {
  it('initializes with the given schema without mappings', () => {
    const initialSchema: RdfDefinition = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Neo',
    };
    const { result } = renderHook(() => useOntologicalDrift(initialSchema));

    expect(result.current.schema).toEqual(initialSchema);
  });

  it('applies initial mappings to the provided schema safely', () => {
    const initialSchema: RdfDefinition = {
      '@type': 'Person',
      legacyHandle: 'Trinity',
      ageStr: '30',
    };
    const mappings: FieldMapping[] = [
      { deprecatedField: 'legacyHandle', newField: 'alternateName' },
      { deprecatedField: 'ageStr', newField: 'age', transform: (val) => Number(val) },
    ];

    const { result } = renderHook(() => useOntologicalDrift(initialSchema, mappings));

    expect(result.current.schema).toEqual({
      '@type': 'Person',
      alternateName: 'Trinity',
      age: 30,
    });
  });

  it('applies P2P mesh consensus and new mappings at runtime', () => {
    const initialSchema: RdfDefinition = { '@type': 'Person', name: 'Morpheus' };
    const { result } = renderHook(() => useOntologicalDrift(initialSchema));

    act(() => {
      result.current.applyConsensus({ legacyJob: 'Captain', status: 'Active' }, [
        { deprecatedField: 'legacyJob', newField: 'jobTitle' },
      ]);
    });

    expect(result.current.schema).toEqual({
      '@type': 'Person',
      name: 'Morpheus',
      jobTitle: 'Captain',
      status: 'Active',
    });
  });

  it('preserves existing mappings when new consensus is applied', () => {
    const initialSchema: RdfDefinition = { oldKey: 'value' };
    const initialMappings: FieldMapping[] = [{ deprecatedField: 'oldKey', newField: 'newKey' }];

    const { result } = renderHook(() => useOntologicalDrift(initialSchema, initialMappings));

    expect(result.current.schema).toEqual({ newKey: 'value' });

    act(() => {
      // apply new consensus that includes the deprecated field again
      result.current.applyConsensus({ oldKey: 'newValue', anotherOld: 'test' }, [
        { deprecatedField: 'anotherOld', newField: 'anotherNew' },
      ]);
    });

    // Both the old mapping and the new mapping should run
    expect(result.current.schema).toEqual({
      newKey: 'newValue',
      anotherNew: 'test',
    });
  });

  it('safely handles missing transform and just maps the value', () => {
    const initialSchema: RdfDefinition = { old: 'val' };
    const mappings: FieldMapping[] = [{ deprecatedField: 'old', newField: 'new' }];

    const { result } = renderHook(() => useOntologicalDrift(initialSchema, mappings));

    expect(result.current.schema).toEqual({ new: 'val' });
  });

  it('allows applying consensus without new mappings', () => {
    const initialSchema: RdfDefinition = { name: 'Cypher' };
    const { result } = renderHook(() => useOntologicalDrift(initialSchema));

    act(() => {
      result.current.applyConsensus({ job: 'Traitor' });
    });

    expect(result.current.schema).toEqual({ name: 'Cypher', job: 'Traitor' });
  });

  it('ignores mapping if deprecatedField is not present in schema', () => {
    const initialSchema: RdfDefinition = { existingKey: 'value' };
    const mappings: FieldMapping[] = [{ deprecatedField: 'missingKey', newField: 'newKey' }];

    const { result } = renderHook(() => useOntologicalDrift(initialSchema, mappings));

    expect(result.current.schema).toEqual({ existingKey: 'value' });
  });
});
