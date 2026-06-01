import { useMemo } from 'react';
import { GenerativeSchema, LayoutNode, LayoutHint } from '../types';

/**
 * Hook to dynamically calculate the optimal layout for a given semantic schema and data set.
 * It groups fields by position and sorts them by priority.
 */
export const useGenerativeLayout = (schema: GenerativeSchema, data: Record<string, any>) => {
  return useMemo(() => {
    const nodes: LayoutNode[] = schema.fields.map((field) => {
      const hint: LayoutHint = schema.layoutHints?.[field.key] || {
        priority: 100,
        span: 4,
        variant: 'flat',
        position: 'body',
      };

      return {
        key: field.key,
        field,
        value: data[field.key],
        hint,
      };
    });

    // Group by position
    const header = nodes
      .filter((n) => n.hint.position === 'header')
      .sort((a, b) => (a.hint.priority || 0) - (b.hint.priority || 0));

    const body = nodes
      .filter((n) => n.hint.position === 'body' || !n.hint.position)
      .sort((a, b) => (a.hint.priority || 0) - (b.hint.priority || 0));

    const footer = nodes
      .filter((n) => n.hint.position === 'footer')
      .sort((a, b) => (a.hint.priority || 0) - (b.hint.priority || 0));

    return {
      header,
      body,
      footer,
      all: nodes,
    };
  }, [schema, data]);
};
