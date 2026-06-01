import { renderHook, act } from '@testing-library/react-native';
import { CRDTLedger, useMeshGovernance, Proposal, Vote } from '../index';

describe('CRDTLedger', () => {
  it('initializes with peers', () => {
    const ledger = new CRDTLedger(['peer1', 'peer2']);
    expect(ledger.getState().peers.has('peer1')).toBe(true);
    expect(ledger.getState().peers.has('peer2')).toBe(true);
  });

  it('propose and getProposal works', () => {
    const ledger = new CRDTLedger(['peer1']);
    const proposal: Proposal = {
      id: 'prop1',
      creator: 'peer1',
      description: 'Test',
      payload: {},
      timestamp: 100,
    };
    ledger.propose(proposal);
    expect(ledger.getProposal('prop1')).toEqual(proposal);
  });

  it('vote works and overrides older votes', () => {
    const ledger = new CRDTLedger(['peer1']);
    ledger.vote({ peerId: 'peer1', proposalId: 'prop1', support: false, timestamp: 100 });

    let votes = ledger.getState().votes.get('prop1');
    expect(votes?.get('peer1')?.support).toBe(false);

    // Newer vote overrides
    ledger.vote({ peerId: 'peer1', proposalId: 'prop1', support: true, timestamp: 200 });
    votes = ledger.getState().votes.get('prop1');
    expect(votes?.get('peer1')?.support).toBe(true);

    // Older vote is ignored
    ledger.vote({ peerId: 'peer1', proposalId: 'prop1', support: false, timestamp: 150 });
    votes = ledger.getState().votes.get('prop1');
    expect(votes?.get('peer1')?.support).toBe(true);
  });

  it('getConsensus correctly calculates majority', () => {
    const ledger = new CRDTLedger(['peer1', 'peer2', 'peer3']);

    // Unknown proposal
    expect(ledger.getConsensus('prop1')).toBe(false);

    const proposal: Proposal = {
      id: 'prop1',
      creator: 'peer1',
      description: 'Test',
      payload: {},
      timestamp: 100,
    };
    ledger.propose(proposal);

    // No votes
    expect(ledger.getConsensus('prop1')).toBe(false);

    ledger.vote({ peerId: 'peer1', proposalId: 'prop1', support: true, timestamp: 100 });
    // 1 / 3 = no consensus
    expect(ledger.getConsensus('prop1')).toBe(false);

    ledger.vote({ peerId: 'peer2', proposalId: 'prop1', support: true, timestamp: 100 });
    // 2 / 3 = consensus!
    expect(ledger.getConsensus('prop1')).toBe(true);

    // Changing vote to false drops consensus
    ledger.vote({ peerId: 'peer2', proposalId: 'prop1', support: false, timestamp: 200 });
    expect(ledger.getConsensus('prop1')).toBe(false);
  });

  it('getConsensus handles 0 peers', () => {
    const ledger = new CRDTLedger([]);
    const proposal: Proposal = {
      id: 'prop1',
      creator: 'peer1',
      description: 'Test',
      payload: {},
      timestamp: 100,
    };
    ledger.propose(proposal);
    ledger.vote({ peerId: 'peer1', proposalId: 'prop1', support: true, timestamp: 100 });
    expect(ledger.getConsensus('prop1')).toBe(false);
  });

  it('clone creates an independent copy', () => {
    const ledger1 = new CRDTLedger(['peer1']);
    ledger1.propose({ id: 'prop1', creator: 'peer1', description: 'T', payload: {}, timestamp: 1 });
    const ledger2 = ledger1.clone();

    expect(ledger2.getState().peers.has('peer1')).toBe(true);
    expect(ledger2.getProposal('prop1')).toBeDefined();

    // Modifying clone doesn't affect original
    ledger2.propose({ id: 'prop2', creator: 'peer1', description: 'T', payload: {}, timestamp: 2 });
    expect(ledger1.getProposal('prop2')).toBeUndefined();
  });

  it('merge correctly merges peers, proposals, and votes based on timestamps', () => {
    const l1 = new CRDTLedger(['peer1']);
    const l2 = new CRDTLedger(['peer2']);

    l1.propose({ id: 'p1', creator: 'peer1', description: 'A', payload: {}, timestamp: 100 });
    l2.propose({ id: 'p1', creator: 'peer1', description: 'B', payload: {}, timestamp: 200 }); // newer
    l2.propose({ id: 'p2', creator: 'peer2', description: 'C', payload: {}, timestamp: 150 });

    l1.vote({ peerId: 'peer1', proposalId: 'p1', support: true, timestamp: 100 });
    l2.vote({ peerId: 'peer1', proposalId: 'p1', support: false, timestamp: 50 }); // older, should be ignored
    l2.vote({ peerId: 'peer2', proposalId: 'p1', support: true, timestamp: 200 }); // new vote for new peer

    l1.merge(l2);

    const state = l1.getState();
    expect(state.peers.has('peer1')).toBe(true);
    expect(state.peers.has('peer2')).toBe(true);

    expect(l1.getProposal('p1')?.description).toBe('B'); // took newer
    expect(l1.getProposal('p2')?.description).toBe('C'); // added missing

    const p1Votes = state.votes.get('p1');
    expect(p1Votes?.get('peer1')?.support).toBe(true); // kept newer (timestamp 100 > 50)
    expect(p1Votes?.get('peer2')?.support).toBe(true); // added new
  });

  it('merge ignores older proposals', () => {
    const l1 = new CRDTLedger(['peer1']);
    const l2 = new CRDTLedger(['peer2']);

    l1.propose({ id: 'p1', creator: 'peer1', description: 'Newer', payload: {}, timestamp: 200 });
    l2.propose({ id: 'p1', creator: 'peer1', description: 'Older', payload: {}, timestamp: 100 });

    l1.merge(l2);
    expect(l1.getProposal('p1')?.description).toBe('Newer');
  });

  it('merge creates votes map if missing', () => {
    const l1 = new CRDTLedger(['peer1']);
    const l2 = new CRDTLedger(['peer2']);

    l2.vote({ peerId: 'peer2', proposalId: 'p1', support: true, timestamp: 100 });
    l1.merge(l2);

    expect(l1.getState().votes.get('p1')?.get('peer2')?.support).toBe(true);
  });
});

describe('useMeshGovernance', () => {
  it('provides ledger and exposes propose, vote, merge, checkConsensus', () => {
    const { result } = renderHook(() => useMeshGovernance('peer1', ['peer1', 'peer2', 'peer3']));

    expect(result.current.ledger.getState().peers.has('peer1')).toBe(true);

    let proposalId: string;

    act(() => {
      const prop = result.current.propose('Change Threshold', { value: 0.8 });
      proposalId = prop.id;
    });

    // @ts-ignore (assigned in act)
    expect(result.current.ledger.getProposal(proposalId)).toBeDefined();
    // @ts-ignore
    expect(result.current.checkConsensus(proposalId)).toBe(false);

    act(() => {
      // @ts-ignore
      result.current.vote(proposalId, true);
    });

    // 1/3
    // @ts-ignore
    expect(result.current.checkConsensus(proposalId)).toBe(false);

    // Merge another peer's ledger
    const otherLedger = new CRDTLedger(['peer1', 'peer2', 'peer3']);
    // @ts-ignore
    otherLedger.propose(result.current.ledger.getProposal(proposalId)!);
    // @ts-ignore
    otherLedger.vote({ peerId: 'peer2', proposalId, support: true, timestamp: Date.now() });

    act(() => {
      result.current.merge(otherLedger);
    });

    // 2/3
    // @ts-ignore
    expect(result.current.checkConsensus(proposalId)).toBe(true);
  });
});

describe('CRDTLedger constructor', () => {
  it('initializes with empty peers if no arguments provided', () => {
    const ledger = new CRDTLedger();
    expect(ledger.getState().peers.size).toBe(0);
  });
});
