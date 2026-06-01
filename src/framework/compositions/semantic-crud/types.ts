import { GenerativeSchema } from '../../ui/generative/types';

export interface SemanticCrudManagerProps {
  targetType: string;
  onEntitySelect?: (entityId: string) => void;
  onEntityCreate?: (data: Record<string, any>) => void;
  onEntityUpdate?: (entityId: string, data: Record<string, any>) => void;
  onEntityDelete?: (entityId: string) => void;
}

export type CrudViewMode = 'list' | 'create' | 'edit' | 'details';

export interface SemanticCrudState {
  mode: CrudViewMode;
  selectedEntityId: string | null;
  searchQuery: string;
}
