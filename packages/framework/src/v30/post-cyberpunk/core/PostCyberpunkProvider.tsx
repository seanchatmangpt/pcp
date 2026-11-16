import React, { createContext, useContext, ReactNode, useMemo, useState, useCallback } from 'react';
import { RealityReceiptGenerator, RealityReceiptData, RealityReceipt } from '../reality-receipts';
import { AgiCourtProvider, useAgiCourt } from '../agi-court';
import {
  FutureClaim,
  PublicLaw,
  TypedArtifact,
  Receipt,
  ActuationBoundary,
  LawEngine,
  Replay,
  BoardProjection,
} from '../law-engine/interfaces';

export interface ShiftEvent {
  dimension: string;
  targetState: string;
}

export class OntologicalShifter {
  private currentDimension: string = 'baseline';

  shift(artifact: TypedArtifact, event: ShiftEvent): boolean {
    if (artifact.approvedPayload && artifact.approvedPayload.permitShift === true) {
      this.currentDimension = event.targetState;
      return true;
    }
    return false;
  }

  getCurrentDimension() {
    return this.currentDimension;
  }
}

export class CoreLawEngine implements LawEngine {
  private laws: Map<string, PublicLaw> = new Map();
  private replays: Replay[] = [];
  private state: Record<string, any> = {};

  constructor(
    private boundary: ActuationBoundary,
    laws: PublicLaw[]
  ) {
    laws.forEach((l) => this.laws.set(l.id, l));
  }

  async submitClaim(claim: FutureClaim): Promise<Receipt> {
    const law = Array.from(this.laws.values()).find((l) => l.name === claim.intent);
    if (!law) {
      return {
        id: `rcpt_${Date.now()}`,
        artifactId: '',
        executionTime: Date.now(),
        status: 'FAILURE',
        error: 'No applicable law found',
      };
    }
    const artifact = law.evaluate(claim);
    const receipt = await this.boundary.execute(artifact);
    if (receipt.status === 'SUCCESS') {
      this.replays.push({
        id: `rpl_${Date.now()}`,
        receiptId: receipt.id,
        snapshot: { ...this.state },
      });
    }
    return receipt;
  }
  getProjection(): BoardProjection {
    return { state: this.state, replays: this.replays };
  }
  async replayReceipt(receiptId: string): Promise<Replay> {
    const replay = this.replays.find((r) => r.receiptId === receiptId);
    if (!replay) throw new Error('Replay not found');
    return replay;
  }
}

export interface PostCyberpunkContextValue {
  lawEngine: CoreLawEngine;
  realityGenerator: RealityReceiptGenerator;
  shifter: OntologicalShifter;
  manufactureReality: (
    claim: FutureClaim,
    receiptData: RealityReceiptData
  ) => Promise<{
    receipt: Receipt;
    realityReceipt: RealityReceipt | null;
    shiftSuccess: boolean;
  }>;
}

const PostCyberpunkContext = createContext<PostCyberpunkContextValue | undefined>(undefined);

export interface PostCyberpunkProviderProps {
  children: ReactNode;
  systemSecret: string;
  laws: PublicLaw[];
}

const PostCyberpunkInnerProvider = ({
  children,
  systemSecret,
  laws,
}: PostCyberpunkProviderProps) => {
  const agiCourt = useAgiCourt();

  const [shifter] = useState(() => new OntologicalShifter());
  const [realityGenerator] = useState(() => new RealityReceiptGenerator(systemSecret));

  const boundary: ActuationBoundary = useMemo(() => {
    return {
      execute: async (artifact: TypedArtifact): Promise<Receipt> => {
        const decision = await agiCourt.proposeMutation({
          id: artifact.id,
          type: 'artifact-actuation',
          payload: artifact.approvedPayload || {},
          tensionLevel: 'high',
          metadata: {
            description: `Executing law ${artifact.lawId}`,
            impactScore: 50,
          },
        });

        const approved = decision.approved !== false && (decision as any).status !== 'REJECTED';
        if (!approved) {
          const rejectReason =
            (decision as any).reasoning ||
            decision.verdicts?.find((v: any) => !v.approved)?.reason ||
            'Rejected by AGI Court';
          return {
            id: `rcpt_${Date.now()}_rejected`,
            artifactId: artifact.id,
            executionTime: Date.now(),
            status: 'FAILURE',
            error: `AGI Court Rejected: ${rejectReason}`,
          };
        }

        return {
          id: `rcpt_${Date.now()}_approved`,
          artifactId: artifact.id,
          executionTime: Date.now(),
          status: 'SUCCESS',
          result: artifact.approvedPayload,
        };
      },
    };
  }, [agiCourt]);

  const [lawEngine] = useState(() => new CoreLawEngine(boundary, laws));

  const manufactureReality = useCallback(
    async (claim: FutureClaim, receiptData: RealityReceiptData) => {
      const receipt = await lawEngine.submitClaim(claim);
      let realityReceipt: RealityReceipt | null = null;
      let shiftSuccess = false;

      if (receipt.status === 'SUCCESS') {
        realityReceipt = realityGenerator.generate(receiptData);
        const artifact = laws.find((l) => l.name === claim.intent)?.evaluate(claim);
        if (artifact) {
          shiftSuccess = shifter.shift(artifact, {
            dimension: 'base',
            targetState: artifact.approvedPayload?.targetState || 'post-cyberpunk',
          });
        }
      }

      return { receipt, realityReceipt, shiftSuccess };
    },
    [lawEngine, realityGenerator, shifter, laws]
  );

  const value = useMemo(
    () => ({ lawEngine, realityGenerator, shifter, manufactureReality }),
    [lawEngine, realityGenerator, shifter, manufactureReality]
  );

  return <PostCyberpunkContext.Provider value={value}>{children}</PostCyberpunkContext.Provider>;
};

export const PostCyberpunkProvider = ({
  children,
  systemSecret,
  laws,
}: PostCyberpunkProviderProps) => {
  return (
    <AgiCourtProvider>
      <PostCyberpunkInnerProvider systemSecret={systemSecret} laws={laws}>
        {children}
      </PostCyberpunkInnerProvider>
    </AgiCourtProvider>
  );
};

export const usePostCyberpunk = () => {
  const context = useContext(PostCyberpunkContext);
  if (!context) throw new Error('usePostCyberpunk must be used within PostCyberpunkProvider');
  return context;
};
