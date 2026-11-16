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
});
