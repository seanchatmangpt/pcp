export interface Mutation {
  id: string;
  type: string;
  payload: Record<string, any>;
  tensionLevel: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}

export interface Verdict {
  agent: string;
  approved: boolean;
  reason: string;
}

export interface CourtDecision {
  mutationId: string;
  approved: boolean;
  verdicts: Verdict[];
}

export type Agent = (mutation: Mutation) => Verdict;

export const skepticAgent: Agent = (mutation) => {
  if (!mutation.metadata || Object.keys(mutation.metadata).length === 0) {
    return {
      agent: 'The Skeptic',
      approved: false,
      reason: 'Lacks sufficient metadata context.',
    };
  }
  return {
    agent: 'The Skeptic',
    approved: true,
    reason: 'Sufficient context provided.',
  };
};

export const auditorAgent: Agent = (mutation) => {
  if (mutation.payload && mutation.payload.__unsafe_bypass === true) {
    return {
      agent: 'The Auditor',
      approved: false,
      reason: 'Detected unsafe bypass flag.',
    };
  }
  return {
    agent: 'The Auditor',
    approved: true,
    reason: 'Structural integrity verified.',
  };
};

export const advocateAgent: Agent = (mutation) => {
  if (mutation.tensionLevel === 'high' && (!mutation.type || mutation.type === 'UNKNOWN')) {
    return {
      agent: 'The Advocate',
      approved: false,
      reason: 'Cannot advocate for unknown mutation type.',
    };
  }
  return {
    agent: 'The Advocate',
    approved: true,
    reason: 'Aligns with user intent.',
  };
};

export const defaultAgents: Agent[] = [skepticAgent, auditorAgent, advocateAgent];

export const evaluateInCourt = (
  mutation: Mutation,
  agents: Agent[] = defaultAgents
): CourtDecision => {
  if (mutation.tensionLevel !== 'high') {
    return { mutationId: mutation.id, approved: true, verdicts: [] };
  }
  const verdicts = agents.map((agent) => agent(mutation));
  const approved = verdicts.every((v) => v.approved);
  return { mutationId: mutation.id, approved, verdicts };
};
