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
      const val = state.values[field.predicate];
      if (field.required && (val === undefined || val === null || val === '')) {
        newErrors[field.predicate] = `${field.label} is required`;
        isValid = false;
      } else {
        newErrors[field.predicate] = '';
      }

      if (val !== undefined && val !== null && val !== '') {
        const isInteger =
          field.range === 'integer' ||
          field.range === 'http://www.w3.org/2001/XMLSchema#integer';
        const isDouble =
          field.range === 'double' ||
          field.range === 'http://www.w3.org/2001/XMLSchema#double';
        const stringVal = String(val).trim();
        if (isInteger) {
          const isIntRep = /^[+-]?\d+$/.test(stringVal);
          const intVal = Number(stringVal);
          if (!isIntRep || isNaN(intVal) || !Number.isInteger(intVal)) {
            newErrors[field.predicate] = `${field.label} must be an integer`;
            isValid = false;
          }
        } else if (isDouble) {
          const isDoubleRep = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(stringVal);
          const doubleVal = Number(stringVal);
          if (!isDoubleRep || isNaN(doubleVal)) {
            newErrors[field.predicate] = `${field.label} must be a number`;
            isValid = false;
          }
        }
      }
    });

    setState((prev) => ({ ...prev, errors: newErrors }));
    return isValid;
  }, [state.schema, state.values]);

  const handleSubmit = useCallback(
    async (onSubmit: (data: Record<string, any>) => void) => {
      if (!validate()) return;

      const parsedValues = { ...state.values };
      if (state.schema) {
        state.schema.fields.forEach((field) => {
          const val = parsedValues[field.predicate];
          if (val !== undefined && val !== null && val !== '') {
            const isInteger =
              field.range === 'integer' ||
              field.range === 'http://www.w3.org/2001/XMLSchema#integer';
            const isDouble =
              field.range === 'double' ||
              field.range === 'http://www.w3.org/2001/XMLSchema#double';
            if (isInteger) {
              parsedValues[field.predicate] = parseInt(String(val), 10);
            } else if (isDouble) {
              parsedValues[field.predicate] = parseFloat(String(val));
            }
          }
        });
      }

      setState((prev) => ({ ...prev, isSubmitting: true }));
      try {
        await onSubmit(parsedValues);
      } finally {
        setState((prev) => ({ ...prev, isSubmitting: false }));
      }
    },
    [state.values, validate, state.schema]
  );

  return {
    ...state,
    setFieldValue,
    handleSubmit,
    validate,
  };
};
