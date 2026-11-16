import { db } from '../../db/db';
import { actorReceipts } from '../../db/schema';
import { IntelligenceRegistry } from './registry';
import { IntelligenceReceipt, ReplayArtifact } from './types';
import { generateReceiptHash } from '../../crypto/receipts';

// Conditional dynamic import for Node fs to prevent React Native packager warnings
let fs: any = null;
let path: any = null;
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
if (isNode) {
  try {
    fs = require('fs');
    path = require('path');
  } catch (e) {}
}

// Memory cache for web/mobile replay artifacts
const mobileReplayStore = new Map<string, ReplayArtifact>();

export class IntelligenceRunner {
  /**
   * Run a registered process capability
   */
  static async run(capabilityId: string, input: any): Promise<IntelligenceReceipt> {
    const capability = IntelligenceRegistry.get(capabilityId);
    if (!capability) {
      throw new Error(`Process capability '${capabilityId}' is not registered.`);
    }

    // Validate Input Contract
    for (const key of Object.keys(capability.inputContract.properties)) {
      const spec = capability.inputContract.properties[key];
      if (spec.required && (input[key] === undefined || input[key] === null)) {
        throw new Error(
          `InputContract Error: Missing required property '${key}' for capability '${capabilityId}'`
        );
      }
    }

    // Run core algorithm
    const runResult = await capability.run(input);
    const receiptId = `rec_intel_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Compute Cryptographic Delta Hash
    const rawResultStr = JSON.stringify(runResult.result || {});
    let hashVal = 0;
    for (let i = 0; i < rawResultStr.length; i++) {
      hashVal = (hashVal << 5) - hashVal + rawResultStr.charCodeAt(i);
      hashVal |= 0;
    }
    const computedHash = generateReceiptHash('', {
      receiptId,
      resultHash: Math.abs(hashVal).toString(16),
    });

    const receipt: IntelligenceReceipt = {
      id: receiptId,
      capabilityId,
      timestamp,
      success: runResult.success,
      deltaHash: computedHash,
      logs: runResult.logs,
      error: runResult.error,
    };

    const replayArtifact: ReplayArtifact = {
      receiptId,
      capabilityId,
      timestamp,
      input,
      output: runResult.result,
      logs: runResult.logs,
    };

    // Store replay artifact conditionally depending on environment
    if (isNode && fs && path) {
      try {
        const replaysDir = path.resolve(process.cwd(), 'replays');
        if (!fs.existsSync(replaysDir)) {
          fs.mkdirSync(replaysDir, { recursive: true });
        }
        const filePath = path.join(replaysDir, `${receiptId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(replayArtifact, null, 2), 'utf8');
      } catch (err) {
        console.error('Failed to write host replay artifact file:', err);
      }
    } else {
      // Store in MMKV / memory Cache for Admin panel
      mobileReplayStore.set(receiptId, replayArtifact);
    }

    // Save receipt to SQLite database
    try {
      await db.insert(actorReceipts).values({
        id: receiptId,
        commandId: `run_${capabilityId}_${Date.now()}`,
        actorRef: JSON.stringify({ kind: 'IntelligenceCapability', id: capabilityId }),
        status: runResult.success ? 'applied_remote' : 'quarantined',
        deltaHash: computedHash,
        eventIds: JSON.stringify([]),
        error: runResult.error || null,
        createdAt: new Date(),
      });
    } catch (e) {
      console.error('Failed to log intelligence receipt in SQLite database:', e);
    }

    return receipt;
  }

  /**
   * Retrieve a specific replay artifact by ID
   */
  static getReplayArtifact(receiptId: string): ReplayArtifact | null {
    if (mobileReplayStore.has(receiptId)) {
      return mobileReplayStore.get(receiptId) || null;
    }

    if (isNode && fs && path) {
      try {
        const filePath = path.resolve(process.cwd(), 'replays', `${receiptId}.json`);
        if (fs.existsSync(filePath)) {
          return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
      } catch (e) {}
    }

    return null;
  }

  /**
   * List all cached replay artifacts
   */
  static listReplays(): ReplayArtifact[] {
    const list = Array.from(mobileReplayStore.values());
    if (isNode && fs && path) {
      try {
        const replaysDir = path.resolve(process.cwd(), 'replays');
        if (fs.existsSync(replaysDir)) {
          const files = fs.readdirSync(replaysDir);
          for (const file of files) {
            if (file.endsWith('.json')) {
              const data = JSON.parse(fs.readFileSync(path.join(replaysDir, file), 'utf8'));
              if (!list.some((x) => x.receiptId === data.receiptId)) {
                list.push(data);
              }
            }
          }
        }
      } catch (e) {}
    }
    return list;
  }
}
