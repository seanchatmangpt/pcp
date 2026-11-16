import { useState, useCallback } from 'react';

export type PeerId = string;

export interface Vote {
  peerId: PeerId;
  proposalId: string;
  support: boolean;
  timestamp: number;
}

export interface Proposal {
  id: string;
  creator: PeerId;
  description: string;
  payload: any;
  timestamp: number;
}

export interface MeshState {
  peers: Set<PeerId>;
  proposals: Map<string, Proposal>;
  votes: Map<string, Map<PeerId, Vote>>; // proposalId -> peerId -> Vote
}

export class CRDTLedger {
  private state: MeshState;

  constructor(initialPeers: PeerId[] = []) {
    this.state = {
      peers: new Set(initialPeers),
      proposals: new Map(),
      votes: new Map(),
    };
  }

  public merge(other: CRDTLedger): void {
    const otherState = other.getState();

    otherState.peers.forEach((p) => this.state.peers.add(p));

    otherState.proposals.forEach((proposal, id) => {
      const existing = this.state.proposals.get(id);
      if (!existing || proposal.timestamp > existing.timestamp) {
        this.state.proposals.set(id, proposal);
      }
    });

    otherState.votes.forEach((votesMap, proposalId) => {
      if (!this.state.votes.has(proposalId)) {
        this.state.votes.set(proposalId, new Map());
      }
      const myVotes = this.state.votes.get(proposalId)!;

      votesMap.forEach((vote, peerId) => {
        const existingVote = myVotes.get(peerId);
        if (!existingVote || vote.timestamp > existingVote.timestamp) {
          myVotes.set(peerId, vote);
        }
      });
    });
  }

  public propose(proposal: Proposal): void {
    this.state.proposals.set(proposal.id, proposal);
  }

  public vote(vote: Vote): void {
    if (!this.state.votes.has(vote.proposalId)) {
      this.state.votes.set(vote.proposalId, new Map());
    }
    const myVotes = this.state.votes.get(vote.proposalId)!;
    const existingVote = myVotes.get(vote.peerId);

    if (!existingVote || vote.timestamp > existingVote.timestamp) {
      myVotes.set(vote.peerId, vote);
    }
  }

  public getConsensus(proposalId: string): boolean {
    const proposal = this.state.proposals.get(proposalId);
    if (!proposal) return false;

    const votesMap = this.state.votes.get(proposalId);
    if (!votesMap) return false;

    let supportCount = 0;
    votesMap.forEach((vote) => {
      if (vote.support) supportCount++;
    });

    const totalPeers = this.state.peers.size;
    if (totalPeers === 0) return false;

    return supportCount > totalPeers / 2; // Strict majority quorum
  }

  public getState(): MeshState {
    return this.state;
  }

  public getProposal(proposalId: string): Proposal | undefined {
    return this.state.proposals.get(proposalId);
  }

  public clone(): CRDTLedger {
    const next = new CRDTLedger(Array.from(this.state.peers));
    next.merge(this);
    return next;
  }
}

export function useMeshGovernance(peerId: PeerId, initialPeers: PeerId[]) {
  const [ledger, setLedger] = useState(() => new CRDTLedger(initialPeers));

  const propose = useCallback(
    (description: string, payload: any) => {
      const proposal: Proposal = {
        id: Math.random().toString(36).substring(2, 15),
        creator: peerId,
        description,
        payload,
        timestamp: Date.now(),
      };

      setLedger((prev) => {
        const next = prev.clone();
        next.propose(proposal);
        return next;
      });

      return proposal;
    },
    [peerId]
  );

  const vote = useCallback(
    (proposalId: string, support: boolean) => {
      const newVote: Vote = {
        peerId,
        proposalId,
        support,
        timestamp: Date.now(),
      };

      setLedger((prev) => {
        const next = prev.clone();
        next.vote(newVote);
        return next;
      });
    },
    [peerId]
  );

  const merge = useCallback((otherLedger: CRDTLedger) => {
    setLedger((prev) => {
      const next = prev.clone();
      next.merge(otherLedger);
      return next;
    });
  }, []);

  const checkConsensus = useCallback(
    (proposalId: string) => {
      return ledger.getConsensus(proposalId);
    },
    [ledger]
  );

  return {
    ledger,
    propose,
    vote,
    merge,
    checkConsensus,
  };
}
