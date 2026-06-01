export * from './types';
export * from './generators/crud-generator';

import { CRUDWithAISearchAndSync } from './generators/crud-generator';
import { CompositionalBlueprint } from './types';

export const blueprints: Record<string, CompositionalBlueprint> = {
  'crud-ai-sync': CRUDWithAISearchAndSync,
};
