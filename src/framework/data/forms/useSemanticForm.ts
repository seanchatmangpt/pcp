import { useState, useEffect, useCallback } from 'react';
import { IVKGClient } from '../../vkg/client';
import { fetchSemanticSchema } from './utils';
import { SemanticFormSchema, SemanticFormState } from './types';

export const useSemanticForm = (
  client: IVKGClient,
  targetType: string,
  initialData?: Record<string, any>
) => {
  const [state, setState] = useState<SemanticFormState>({
    values: initialData || {},
    errors: {},
    isSubmitting: false,
    schema: null,
    isLoadingSchema: true,
  });

  useEffect(() => {
    let isMounted = true;
    const loadSchema = async () => {
      try {
        const schema = await fetchSemanticSchema(client, targetType);
        if (isMounted) {
          setState((prev) => ({ ...prev, schema, isLoadingSchema: false }));
        }
      } catch (error) {
        console.error('Failed to load semantic schema:', error);
        if (isMounted) {
          setState((prev) => ({ ...prev, isLoadingSchema: false }));
        }
      }
    };

    loadSchema();
    return () => {
      isMounted = false;
    };
  }, [client, targetType]);

  const setFieldValue = useCallback((predicate: string, value: any) => {
    setState((prev) => ({
      ...prev,
      values: { ...prev.values, [predicate]: value },
      errors: { ...prev.errors, [predicate]: '' }, // Clear error on change
    }));
  }, []);

  const validate = useCallback(() => {
    if (!state.schema) return true;
    const newErrors: Record<string, string> = {};
    let isValid = true;

    state.schema.fields.forEach((field) => {
      if (field.required && !state.values[field.predicate]) {
        newErrors[field.predicate] = `${field.label} is required`;
        isValid = false;
      } else {
        newErrors[field.predicate] = '';
      }
    });

    setState((prev) => ({ ...prev, errors: newErrors }));
    return isValid;
  }, [state.schema, state.values]);

  const handleSubmit = useCallback(
    async (onSubmit: (data: Record<string, any>) => void) => {
      if (!validate()) return;

      setState((prev) => ({ ...prev, isSubmitting: true }));
      try {
        await onSubmit(state.values);
      } finally {
        setState((prev) => ({ ...prev, isSubmitting: false }));
      }
    },
    [state.values, validate]
  );

  return {
    ...state,
    setFieldValue,
    handleSubmit,
    validate,
  };
};
