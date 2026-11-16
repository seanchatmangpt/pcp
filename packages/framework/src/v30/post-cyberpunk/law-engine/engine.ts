import {
  LawEngine,
  LawEngineConfig,
  FutureClaim,
  TypedArtifact,
  Receipt,
  BoardProjection,
  Replay,
  PublicLaw,
} from './interfaces';

export class BlueRiverDam implements LawEngine {
  private laws: Map<string, PublicLaw> = new Map();
  private boundary: LawEngineConfig['boundary'];
  private receipts: Map<string, Receipt> = new Map();
  private replays: Map<string, Replay> = new Map();
  private projectionState: Record<string, any> = {};

  constructor(config: LawEngineConfig) {
    config.laws.forEach((law) => this.laws.set(law.id, law));
    this.boundary = config.boundary;
  }

  async submitClaim(claim: FutureClaim): Promise<Receipt> {
    const applicableLaw = Array.from(this.laws.values()).find((law) => law.name === claim.intent);

    if (!applicableLaw) {
      throw new Error(`No public law found for intent: ${claim.intent}`);
    }

    const artifact = applicableLaw.evaluate(claim);

    try {
      const receipt = await this.boundary.execute(artifact);
      this.receipts.set(receipt.id, receipt);

      if (receipt.status === 'SUCCESS') {
        this.projectionState[claim.intent] = receipt.result;
      }
      return receipt;
    } catch (error: any) {
      const failedReceipt: Receipt = {
        id: `fail-${Date.now()}-${Math.random()}`,
        artifactId: artifact.id,
        executionTime: Date.now(),
        status: 'FAILURE',
        error: error instanceof Error ? error.message : String(error),
      };
      this.receipts.set(failedReceipt.id, failedReceipt);
      return failedReceipt;
    }
  }

  getProjection(): BoardProjection {
    return {
      state: { ...this.projectionState },
      replays: Array.from(this.replays.values()),
    };
  }

  async replayReceipt(receiptId: string): Promise<Replay> {
    const receipt = this.receipts.get(receiptId);
    if (!receipt) {
      throw new Error(`Receipt not found: ${receiptId}`);
    }

    const replay: Replay = {
      id: `replay-${Date.now()}-${Math.random()}`,
      receiptId: receipt.id,
      snapshot: { status: receipt.status, result: receipt.result, error: receipt.error },
    };

    this.replays.set(replay.id, replay);
    return replay;
  }
}
