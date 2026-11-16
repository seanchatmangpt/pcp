export interface InputContract {
  properties: Record<string, { type: string; description: string; required?: boolean }>;
}

export interface OutputContract {
  properties: Record<string, { type: string; description: string }>;
}

export interface IntelligenceReceipt {
  id: string;
  capabilityId: string;
  timestamp: string;
  success: boolean;
  deltaHash: string;
  logs: string[];
  error?: string;
}

export interface ReplayArtifact {
  receiptId: string;
  capabilityId: string;
  timestamp: string;
  input: any;
  output: any;
  logs: string[];
}

export interface IntelligenceCapability {
  id: string;
  name: string;
  description: string;
  inputContract: InputContract;
  outputContract: OutputContract;
  run(input: any): Promise<{ success: boolean; result: any; logs: string[]; error?: string }>;
}

export interface AppIntervention {
  id: string; // e.g. "urn:zoe:intervention:<uuid>"
  verb:
    | 'PROMPT'
    | 'REORDER'
    | 'RECOMMEND'
    | 'REMIND'
    | 'SUPPRESS'
    | 'ESCALATE'
    | 'ASSIGN'
    | 'RECEIPT';
  rdfQuads: {
    subject: string;
    predicate: string;
    object: string;
    graph?: string;
  }[];
}
