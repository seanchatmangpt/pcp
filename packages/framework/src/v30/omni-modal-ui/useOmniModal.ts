import { useState, useMemo, useCallback } from 'react';
import { OmniCompiler, GenerativeView, CompiledOutput } from './OmniCompiler';

export function useOmniModal(initialSchema: GenerativeView) {
  const [schema, setSchema] = useState<GenerativeView>(initialSchema);

  const compiledOutput: CompiledOutput = useMemo(() => {
    return OmniCompiler.compile(schema);
  }, [schema]);

  const updateSchema = useCallback(
    (newSchema: GenerativeView | ((prev: GenerativeView) => GenerativeView)) => {
      setSchema(newSchema);
    },
    []
  );

  const resetSchema = useCallback(() => {
    setSchema(initialSchema);
  }, [initialSchema]);

  return {
    schema,
    compiledOutput,
    updateSchema,
    resetSchema,
  };
}
