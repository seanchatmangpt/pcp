export interface FutureClaim<T = any> {
  id: string;
  intent: string;
  payload: T;
  timestamp: number;
}

export interface PublicLaw<T = any, R = any> {
  id: string;
  name: string;
  evaluate: (claim: FutureClaim<T>) => TypedArtifact<R>;
}

export interface TypedArtifact<R = any> {
  id: string;
  claimId: string;
  lawId: string;
  approvedPayload: R;
}

export interface Receipt<R = any> {
  id: string;
  artifactId: string;
  executionTime: number;
  status: 'SUCCESS' | 'FAILURE';
  result?: R;
  error?: string;
}

export interface Replay {
  id: string;
  receiptId: string;
  snapshot: any;
}

export interface BoardProjection {
  state: Record<string, any>;
  replays: Replay[];
}

export interface ActuationBoundary {
  execute(artifact: TypedArtifact): Promise<Receipt>;
}

export interface LawEngineConfig {
  laws: PublicLaw[];
  boundary: ActuationBoundary;
}

export interface LawEngine {
  submitClaim: (claim: FutureClaim) => Promise<Receipt>;
  getProjection: () => BoardProjection;
  replayReceipt: (receiptId: string) => Promise<Replay>;
}
