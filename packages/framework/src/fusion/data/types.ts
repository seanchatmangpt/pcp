import { NeuroSymbolicQuery, NeuroSymbolicResult } from '../../data/neuro-symbolic/types';
import { CrudViewMode } from '../../compositions/semantic-crud/types';

/**
 * Enhanced query structure for FusionDataManager.
 */
export interface FusionQuery extends NeuroSymbolicQuery {
  /**
   * Whether to enable predictive prefetching for this query.
   */
  prefetchEnabled?: boolean;
}

/**
 * Configuration for the FusionDataManager.
 */
export interface FusionDataManagerProps {
  /**
   * The RDF type of entities to manage (e.g., https://schema.org/Person).
   */
  targetType: string;

  /**
   * Initial query to populate the list.
   */
  initialQuery?: FusionQuery;

  /**
   * Optional callbacks for CRUD operations.
   */
  onEntitySelect?: (entityId: string) => void;
  onEntityCreate?: (data: Record<string, any>) => void;
  onEntityUpdate?: (entityId: string, data: Record<string, any>) => void;
  onEntityDelete?: (entityId: string) => void;

  /**
   * Optional Generative UI hint.
   */
  uiHint?: string;
}

/**
 * State for the FusionDataManager.
 */
export interface FusionDataState {
  mode: CrudViewMode;
  selectedEntityId: string | null;
  currentQuery: FusionQuery;
  results: NeuroSymbolicResult[];
  loading: boolean;
  error: Error | null;
}
