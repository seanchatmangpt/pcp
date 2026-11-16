export interface MembraneReceipt {
  id: string;
  timestamp: number;
  path: string;
  state: Record<string, any>;
  patch?: Record<string, any>;
}

export interface TemporalRoute {
  path: string;
  state: Record<string, any>;
  timestamp: number;
}
