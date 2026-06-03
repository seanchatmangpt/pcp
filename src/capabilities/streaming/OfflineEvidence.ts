import { EventWindow, Event } from './EventWindow';

export class OfflineEvidence {
    public readonly batchId: string;
    public readonly caseId: string;
    public readonly analyzedEvents: number;
    public readonly deviationsFound: string[];
    public readonly generationTime: number;

    constructor(
        batchId: string,
        caseId: string,
        analyzedEvents: number,
        deviationsFound: string[]
    ) {
        if (!batchId || !caseId) {
            throw new Error("Invalid arguments: batchId and caseId are required.");
        }
        this.batchId = batchId;
        this.caseId = caseId;
        this.analyzedEvents = analyzedEvents;
        this.deviationsFound = [...deviationsFound];
        this.generationTime = Date.now();
    }

    public static aggregateFromWindow(
        batchId: string, 
        caseId: string, 
        window: EventWindow, 
        deviationDetector: (events: readonly Event[]) => string[]
    ): OfflineEvidence {
        const caseEvents = window.getEvents().filter(e => e.caseId === caseId);
        
        if (caseEvents.length === 0) {
            return new OfflineEvidence(batchId, caseId, 0, []);
        }

        const deviations = deviationDetector(caseEvents);
        
        return new OfflineEvidence(
            batchId,
            caseId,
            caseEvents.length,
            deviations
        );
    }
    
    public hasDeviations(): boolean {
        return this.deviationsFound.length > 0;
    }

    public toJSON(): Record<string, unknown> {
        return {
            batchId: this.batchId,
            caseId: this.caseId,
            analyzedEvents: this.analyzedEvents,
            deviationsFound: this.deviationsFound,
            generationTime: this.generationTime,
        };
    }
}
