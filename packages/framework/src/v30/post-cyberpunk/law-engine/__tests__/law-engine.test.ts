import { renderHook, act } from '@testing-library/react-native';
import { BlueRiverDam } from '../engine';
import { useLawEngine } from '../hook';
import { FutureClaim, PublicLaw, ActuationBoundary, TypedArtifact, Receipt } from '../interfaces';

describe('Blue River Dam Actuator (Law Engine)', () => {
  let mockLaw: PublicLaw;
  let mockBoundary: ActuationBoundary;

  beforeEach(() => {
    mockLaw = {
      id: 'law-1',
      name: 'build-dam',
      evaluate: (claim: FutureClaim) => {
        if (!claim.payload.materials) throw new Error('Illegal claim: missing materials');
        return {
          id: `art-${claim.id}`,
          claimId: claim.id,
          lawId: 'law-1',
          approvedPayload: claim.payload,
        };
      },
    };

    mockBoundary = {
      execute: async (artifact: TypedArtifact): Promise<Receipt> => {
        if (artifact.approvedPayload.materials === 'sand') {
          throw new Error('Boundary execution failed: dam collapsed');
        }
        return {
          id: `rec-${artifact.id}`,
          artifactId: artifact.id,
          executionTime: Date.now(),
          status: 'SUCCESS',
          result: { damBuilt: true },
        };
      },
    };
  });

  it('enforces future claim -> public law -> typed artifact -> actuation boundary -> receipt -> board projection', async () => {
    const engine = new BlueRiverDam({
      laws: [mockLaw],
      boundary: mockBoundary,
    });

    const claim: FutureClaim = {
      id: 'claim-1',
      intent: 'build-dam',
      payload: { materials: 'concrete' },
      timestamp: Date.now(),
    };

    const receipt = await engine.submitClaim(claim);
    expect(receipt.status).toBe('SUCCESS');
    expect(receipt.result).toEqual({ damBuilt: true });

    const projection = engine.getProjection();
    expect(projection.state['build-dam']).toEqual({ damBuilt: true });
  });

  it('rejects claims that do not match a public law', async () => {
    const engine = new BlueRiverDam({
      laws: [mockLaw],
      boundary: mockBoundary,
    });

    const claim: FutureClaim = {
      id: 'claim-2',
      intent: 'unknown-intent',
      payload: {},
      timestamp: Date.now(),
    };

    await expect(engine.submitClaim(claim)).rejects.toThrow(
      'No public law found for intent: unknown-intent'
    );
  });

  it('fails evaluation when public law logic throws', async () => {
    const engine = new BlueRiverDam({
      laws: [mockLaw],
      boundary: mockBoundary,
    });

    const claim: FutureClaim = {
      id: 'claim-3',
      intent: 'build-dam',
      payload: {}, // Missing materials
      timestamp: Date.now(),
    };

    await expect(engine.submitClaim(claim)).rejects.toThrow('Illegal claim: missing materials');
  });
});
