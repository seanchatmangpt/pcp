import { CompositionalBlueprint, BlueprintFile } from '../types';
import { compositionalCRUDTemplate } from '../templates/crud-ai-sync';

export const CRUDWithAISearchAndSync: CompositionalBlueprint = {
  name: 'crud-ai-sync',
  description: 'Scaffold a full CRUD screen with AI search capability and sync engine integration.',
  generate: (name: string): BlueprintFile[] => {
    const templates = compositionalCRUDTemplate(name);
    const slug = name.toLowerCase();

    return [
      {
        path: `src/types/semantic/${name}.ts`,
        content: templates.semanticType,
      },
      {
        path: `src/hooks/use${name}.ts`,
        content: templates.hook,
      },
      {
        path: `src/components/${name}Card.tsx`,
        content: templates.ui,
      },
      {
        path: `src/sync/${name}SyncHandler.ts`,
        content: templates.sync,
      },
      {
        path: `src/capabilities/${slug}-search.ts`,
        content: templates.aiSearch,
      },
      {
        path: `src/screens/${name}CompositionScreen.tsx`,
        content: templates.screen,
      },
    ];
  },
};
