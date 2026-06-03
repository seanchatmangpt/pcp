import { Event } from './EventWindow';

export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export class OnlineEvidence {
    public readonly evidenceId: string;
    public readonly caseId: string;
    public readonly detectedAt: number;
    public readonly triggerEventId: string;
    public readonly description: string;
    public readonly confidence: ConfidenceLevel;

    constructor(
        evidenceId: string,
        caseId: string,
        detectedAt: number,
        triggerEventId: string,
        description: string,
        confidence: ConfidenceLevel
    ) {
        if (!evidenceId || !caseId || !triggerEventId) {
            throw new Error("Invalid arguments: evidenceId, caseId, and triggerEventId are required.");
        }
        this.evidenceId = evidenceId;
        this.caseId = caseId;
        this.detectedAt = detectedAt;
        this.triggerEventId = triggerEventId;
        this.description = description;
        this.confidence = confidence;
    }

    public static evaluateEvent(
        event: Event, 
        ruleCondition: (e: Event) => boolean, 
        description: string,
        confidence: ConfidenceLevel = 'High'
    ): OnlineEvidence | null {
        if (ruleCondition(event)) {
            return new OnlineEvidence(
                `evd-${event.id}-${Date.now()}`,
                event.caseId,
                Date.now(),
                event.id,
                description,
                confidence
            );
        }
        return null;
    }
    
    public toJSON(): Record<string, unknown> {
        return {
            evidenceId: this.evidenceId,
            caseId: this.caseId,
            detectedAt: this.detectedAt,
            triggerEventId: this.triggerEventId,
            description: this.description,
            confidence: this.confidence,
        };
    }
}
