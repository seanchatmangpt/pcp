import { db } from '../../db/db';
import { actorOutbox, syncQueue } from '../../db/schema';
import { eq, inArray } from 'drizzle-orm';

export interface TensionQueueAuditResult {
  packName: string;
  pendingJobsCount: number;
  jobs: {
    id: string;
    source: 'actor_outbox' | 'sync_queue';
    commandId?: string;
    jobType: string;
    status: string;
    packId?: string;
    hookId?: string;
    payload: any;
  }[];
}

export interface TensionQueueMappingResult {
  success: boolean;
  mappedCount: number;
  details: {
    jobId: string;
    source: 'actor_outbox' | 'sync_queue';
    updatedKeys: string[];
  }[];
}

export class TensionQueueMapper {
  /**
   * Audits the Pre-Admission Tension Queue (actor_outbox & sync_queue) for jobs targeting a specific pack.
   */
  public async auditTensionQueue(packName: string): Promise<TensionQueueAuditResult> {
    const outboxJobs = await db
      .select()
      .from(actorOutbox)
      .where(inArray(actorOutbox.status, ['pending', 'failed', 'processing']));

    const syncJobs = await db
      .select()
      .from(syncQueue)
      .where(inArray(syncQueue.status, ['pending', 'failed', 'processing']));

    const matchedJobs: TensionQueueAuditResult['jobs'] = [];

    // Parse and filter actor_outbox jobs
    for (const job of outboxJobs) {
      try {
        const parsed = JSON.parse(job.payload);
        const actor = parsed.envelope?.actor;
        if (actor && (actor.packId === packName || actor.kind === packName)) {
          matchedJobs.push({
            id: job.id,
            source: 'actor_outbox',
            commandId: job.commandId,
            jobType: job.jobType,
            status: job.status || 'pending',
            packId: actor.packId || actor.kind,
            hookId: actor.hookId,
            payload: parsed,
          });
        }
      } catch (err) {
        console.error(`[TensionQueueMapper] Error parsing actor_outbox job ${job.id}:`, err);
      }
    }

    // Parse and filter sync_queue jobs
    for (const job of syncJobs) {
      try {
        const parsed = JSON.parse(job.payload);
        const actorRef = parsed.actorRef || parsed.actor;
        const matchesPack = 
          (actorRef && (actorRef.packId === packName || actorRef.kind === packName)) ||
          job.entityId === packName ||
          (parsed.packId === packName);

        if (matchesPack) {
          matchedJobs.push({
            id: String(job.id),
            source: 'sync_queue',
            jobType: job.jobType,
            status: job.status || 'pending',
            packId: actorRef?.packId || actorRef?.kind || parsed.packId || packName,
            hookId: actorRef?.hookId || parsed.hookId,
            payload: parsed,
          });
        }
      } catch (err) {
        console.error(`[TensionQueueMapper] Error parsing sync_queue job ${job.id}:`, err);
      }
    }

    return {
      packName,
      pendingJobsCount: matchedJobs.length,
      jobs: matchedJobs,
    };
  }

  /**
   * Transforms state payloads of pending tension queue jobs using ontological mapping rules.
   */
  public async mapTensionQueueState(
    packName: string,
    mappingRules: Record<string, string>
  ): Promise<TensionQueueMappingResult> {
    const audit = await this.auditTensionQueue(packName);
    const details: TensionQueueMappingResult['details'] = [];
    let mappedCount = 0;

    for (const job of audit.jobs) {
      let payloadModified = false;
      const updatedKeys: string[] = [];

      if (job.source === 'actor_outbox') {
        const payloadObj = job.payload;
        // Map envelope payload keys if matches rules
        if (payloadObj.envelope?.payload) {
          const mappedPayload: Record<string, any> = {};
          for (const key of Object.keys(payloadObj.envelope.payload)) {
            const newKey = mappingRules[key];
            if (newKey && newKey !== key) {
              mappedPayload[newKey] = payloadObj.envelope.payload[key];
              updatedKeys.push(key);
              payloadModified = true;
            } else {
              mappedPayload[key] = payloadObj.envelope.payload[key];
            }
          }
          payloadObj.envelope.payload = mappedPayload;
        }

        // Map delta keys if present
        if (payloadObj.delta) {
          if (Array.isArray(payloadObj.delta.add)) {
            payloadObj.delta.add = payloadObj.delta.add.map((quadStr: string) => {
              try {
                const quad = JSON.parse(quadStr);
                const newPredicate = mappingRules[quad.predicate];
                if (newPredicate && newPredicate !== quad.predicate) {
                  quad.predicate = newPredicate;
                  updatedKeys.push(quad.predicate);
                  payloadModified = true;
                }
                return JSON.stringify(quad);
              } catch {
                return quadStr;
              }
            });
          }
          if (Array.isArray(payloadObj.delta.remove)) {
            payloadObj.delta.remove = payloadObj.delta.remove.map((quadStr: string) => {
              try {
                const quad = JSON.parse(quadStr);
                const newPredicate = mappingRules[quad.predicate];
                if (newPredicate && newPredicate !== quad.predicate) {
                  quad.predicate = newPredicate;
                  updatedKeys.push(quad.predicate);
                  payloadModified = true;
                }
                return JSON.stringify(quad);
              } catch {
                return quadStr;
              }
            });
          }
        }

        if (payloadModified) {
          await db
            .update(actorOutbox)
            .set({ payload: JSON.stringify(payloadObj) })
            .where(eq(actorOutbox.id, job.id));
          mappedCount++;
          details.push({
            jobId: job.id,
            source: 'actor_outbox',
            updatedKeys,
          });
        }
      } else if (job.source === 'sync_queue') {
        const payloadObj = job.payload;
        // Map general payload attributes
        const mappedPayload: Record<string, any> = {};
        for (const key of Object.keys(payloadObj)) {
          const newKey = mappingRules[key];
          if (newKey && newKey !== key) {
            mappedPayload[newKey] = payloadObj[key];
            updatedKeys.push(key);
            payloadModified = true;
          } else {
            mappedPayload[key] = payloadObj[key];
          }
        }

        if (payloadModified) {
          await db
            .update(syncQueue)
            .set({ payload: JSON.stringify(mappedPayload) })
            .where(eq(syncQueue.id, Number(job.id)));
          mappedCount++;
          details.push({
            jobId: job.id,
            source: 'sync_queue',
            updatedKeys,
          });
        }
      }
    }

    return {
      success: true,
      mappedCount,
      details,
    };
  }

  /**
   * Verifies that pending tension queue jobs refer only to allowed/registered hook identifiers.
   */
  public async validateQueueConsistency(
    packName: string,
    allowedHooks: string[]
  ): Promise<{ consistent: boolean; issues: string[] }> {
    const audit = await this.auditTensionQueue(packName);
    const issues: string[] = [];

    for (const job of audit.jobs) {
      if (job.hookId && !allowedHooks.includes(job.hookId)) {
        issues.push(
          `Job ${job.id} references hook '${job.hookId}' which is not in the allowed hooks list for pack '${packName}'.`
        );
      }
    }

    return {
      consistent: issues.length === 0,
      issues,
    };
  }
}
