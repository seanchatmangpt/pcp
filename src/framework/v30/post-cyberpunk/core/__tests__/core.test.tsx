import React from 'react';
import { View, Text } from 'react-native';
import { render, screen, act, waitFor } from '@testing-library/react-native';
import {
  OntologicalShifter,
  CoreLawEngine,
  PostCyberpunkProvider,
  usePostCyberpunk,
} from '../PostCyberpunkProvider';
import {
  PublicLaw,
  FutureClaim,
  ActuationBoundary,
  TypedArtifact,
} from '../../law-engine/interfaces';

describe('OntologicalShifter', () => {
  it('initializes with baseline dimension', () => {
    const shifter = new OntologicalShifter();
    expect(shifter.getCurrentDimension()).toBe('baseline');
  });

  it('shifts dimension when artifact permits', () => {
    const shifter = new OntologicalShifter();
    const artifact = {
      id: '1',
      claimId: 'c1',
      lawId: 'l1',
      approvedPayload: { permitShift: true },
    };
    const success = shifter.shift(artifact, { dimension: 'base', targetState: 'cyber-future' });
    expect(success).toBe(true);
    expect(shifter.getCurrentDimension()).toBe('cyber-future');
  });

  it('does not shift when artifact denies', () => {
    const shifter = new OntologicalShifter();
    const artifact = {
      id: '1',
      claimId: 'c1',
      lawId: 'l1',
      approvedPayload: { permitShift: false },
    };
    const success = shifter.shift(artifact, { dimension: 'base', targetState: 'cyber-future' });
    expect(success).toBe(false);
    expect(shifter.getCurrentDimension()).toBe('baseline');
  });

  it('does not shift when payload is missing', () => {
    const shifter = new OntologicalShifter();
    const artifact = { id: '1', claimId: 'c1', lawId: 'l1', approvedPayload: null };
    const success = shifter.shift(artifact, { dimension: 'base', targetState: 'cyber-future' });
    expect(success).toBe(false);
    expect(shifter.getCurrentDimension()).toBe('baseline');
  });
});

describe('CoreLawEngine', () => {
  const dummyBoundary: ActuationBoundary = {
    execute: async (artifact) => ({
      id: 'r1',
      artifactId: artifact.id,
      executionTime: 123,
      status: 'SUCCESS',
    }),
  };

  const dummyLaw: PublicLaw = {
    id: 'l1',
    name: 'test-intent',
    evaluate: (claim) => ({
      id: 'a1',
      claimId: claim.id,
      lawId: 'l1',
      approvedPayload: { data: claim.payload },
    }),
  };

  it('returns FAILURE if no law matches intent', async () => {
    const engine = new CoreLawEngine(dummyBoundary, [dummyLaw]);
    const result = await engine.submitClaim({
      id: 'c1',
      intent: 'unknown',
      payload: {},
      timestamp: 123,
    });
    expect(result.status).toBe('FAILURE');
    expect(result.error).toBe('No applicable law found');
  });

  it('evaluates and executes when law matches', async () => {
    const engine = new CoreLawEngine(dummyBoundary, [dummyLaw]);
    const result = await engine.submitClaim({
      id: 'c1',
      intent: 'test-intent',
      payload: {},
      timestamp: 123,
    });
    expect(result.status).toBe('SUCCESS');

    // Test projection
    const proj = engine.getProjection();
    expect(proj.replays.length).toBe(1);
    expect(proj.replays[0].receiptId).toBe('r1');
  });

  it('replayReceipt returns correct replay or throws', async () => {
    const engine = new CoreLawEngine(dummyBoundary, [dummyLaw]);
    await engine.submitClaim({ id: 'c1', intent: 'test-intent', payload: {}, timestamp: 123 });

    const replay = await engine.replayReceipt('r1');
    expect(replay.receiptId).toBe('r1');

    await expect(engine.replayReceipt('invalid')).rejects.toThrow('Replay not found');
  });
});

describe('PostCyberpunkProvider and Hook', () => {
  const TestComponent = () => {
    const { manufactureReality, shifter, lawEngine } = usePostCyberpunk();
    const [result, setResult] = React.useState<any>(null);

    React.useEffect(() => {
      const run = async () => {
        const claim: FutureClaim = {
          id: 'c1',
          intent: 'test-intent',
          payload: {},
          timestamp: Date.now(),
        };
        const receiptData = {
          zkpIdentity: { proof: 'p', publicSignals: [] },
          hardwareTelemetry: {
            deviceId: 'd',
            cpuCores: 4,
            memoryCapacity: 8,
            secureEnclavePresent: true,
          },
          behavioralIntent: { action: 'test', timestamp: 123, metadata: {} },
        };
        const res = await manufactureReality(claim, receiptData);
        setResult(res);
      };
      run();
    }, [manufactureReality]);

    if (!result)
      return (
        <View>
          <Text>Loading</Text>
        </View>
      );
    return (
      <View>
        <Text testID="status">{result.receipt.status}</Text>
        <Text testID="shift">{result.shiftSuccess ? 'true' : 'false'}</Text>
        <Text testID="dim">{shifter.getCurrentDimension()}</Text>
      </View>
    );
  };

  const RejectionComponent = () => {
    const { manufactureReality } = usePostCyberpunk();
    const [result, setResult] = React.useState<any>(null);

    React.useEffect(() => {
      const run = async () => {
        const claim: FutureClaim = {
          id: 'c2',
          intent: 'reject-intent',
          payload: {},
          timestamp: Date.now(),
        };
        const receiptData = {
          zkpIdentity: { proof: 'p', publicSignals: [] },
          hardwareTelemetry: {
            deviceId: 'd',
            cpuCores: 4,
            memoryCapacity: 8,
            secureEnclavePresent: true,
          },
          behavioralIntent: { action: 'test', timestamp: 123, metadata: {} },
        };
        const res = await manufactureReality(claim, receiptData);
        setResult(res);
      };
      run();
    }, [manufactureReality]);

    if (!result)
      return (
        <View>
          <Text>Loading</Text>
        </View>
      );
    return (
      <View>
        <Text testID="status-reject">{result.receipt.status}</Text>
      </View>
    );
  };

  it('throws error when hook used outside provider', () => {
    const Component = () => {
      usePostCyberpunk();
      return <View />;
    };

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Component />)).toThrow(
      'usePostCyberpunk must be used within PostCyberpunkProvider'
    );
    consoleError.mockRestore();
  });

  it('manufactureReality executes successfully, generates receipt, and shifts dimension', async () => {
    const dummyLaw: PublicLaw = {
      id: 'l1',
      name: 'test-intent',
      evaluate: (claim) => ({
        id: 'a1',
        claimId: claim.id,
        lawId: 'l1',
        approvedPayload: { permitShift: true, targetState: 'new-world' },
      }),
    };

    jest
      .spyOn(require('../../agi-court/agents'), 'evaluateInCourt')
      .mockReturnValue({ status: 'APPROVED', reasoning: 'ok', resultingImpact: 0 });

    render(
      <PostCyberpunkProvider systemSecret="secret" laws={[dummyLaw]}>
        <TestComponent />
      </PostCyberpunkProvider>
    );

    expect(await screen.findByTestId('status')).toHaveTextContent('SUCCESS');
    expect(await screen.findByTestId('shift')).toHaveTextContent('true');
    expect(await screen.findByTestId('dim')).toHaveTextContent('new-world');
  });

  it('manufactureReality handles AGI Court rejection', async () => {
    const rejectLaw: PublicLaw = {
      id: 'l2',
      name: 'reject-intent',
      evaluate: (claim) => ({
        id: 'a2',
        claimId: claim.id,
        lawId: 'l2',
        approvedPayload: { permitShift: false },
      }),
    };

    jest
      .spyOn(require('../../agi-court/agents'), 'evaluateInCourt')
      .mockReturnValue({ status: 'REJECTED', reasoning: 'bad', resultingImpact: 0 });

    render(
      <PostCyberpunkProvider systemSecret="secret" laws={[rejectLaw]}>
        <RejectionComponent />
      </PostCyberpunkProvider>
    );

    expect(await screen.findByTestId('status-reject')).toHaveTextContent('FAILURE');
  });
});
