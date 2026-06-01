import { useState, useCallback } from 'react';

export type RdfDefinition = Record<string, unknown>;

export interface FieldMapping {
  deprecatedField: string;
  newField: string;
  transform?: (value: unknown) => unknown;
}

export interface OntologicalShiftEngine {
  schema: RdfDefinition;
  applyConsensus: (newConsensus: RdfDefinition, newMappings?: FieldMapping[]) => void;
}

export function useOntologicalDrift(
  initialSchema: RdfDefinition,
  initialMappings: FieldMapping[] = []
): OntologicalShiftEngine {
  const [schema, setSchema] = useState<RdfDefinition>(() => {
    return applyMappings(initialSchema, initialMappings);
  });
  const [mappings, setMappings] = useState<FieldMapping[]>(initialMappings);

  const applyConsensus = useCallback(
    (newConsensus: RdfDefinition, newMappings: FieldMapping[] = []) => {
      setMappings((prevMappings) => {
        const updatedMappings = [...prevMappings, ...newMappings];
        setSchema((prevSchema) => {
          const mergedSchema = { ...prevSchema, ...newConsensus };
          return applyMappings(mergedSchema, updatedMappings);
        });
        return updatedMappings;
      });
    },
    []
  );

  return { schema, applyConsensus };
}

function applyMappings(schema: RdfDefinition, mappings: FieldMapping[]): RdfDefinition {
  const result = { ...schema };
  for (const mapping of mappings) {
    if (mapping.deprecatedField in result) {
      const value = result[mapping.deprecatedField];
      result[mapping.newField] = mapping.transform ? mapping.transform(value) : value;
      delete result[mapping.deprecatedField];
    }
  }
  return result;
}
