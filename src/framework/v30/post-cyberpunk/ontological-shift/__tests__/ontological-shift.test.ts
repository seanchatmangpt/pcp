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
});
