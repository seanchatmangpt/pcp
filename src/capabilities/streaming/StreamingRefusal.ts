export type LateArrivalReason = { type: 'LateArrival'; threshold: number; actualDelay: number };
export type MalformedEventReason = { type: 'MalformedEvent'; details: string };
export type BufferOverflowReason = { type: 'BufferOverflow'; capacity: number };
export type InvalidSequenceReason = { type: 'InvalidSequence'; expected: string; received: string };

export type RefusalReason =
  | LateArrivalReason
  | MalformedEventReason
  | BufferOverflowReason
  | InvalidSequenceReason;

export class StreamingRefusal extends Error {
    public readonly eventId: string | null;
    public readonly reason: RefusalReason;
    public readonly timestamp: number;

    constructor(eventId: string | null, reason: RefusalReason) {
        super(`Streaming Refusal: ${reason.type}`);
        this.eventId = eventId;
        this.reason = reason;
        this.timestamp = Date.now();
        this.name = 'StreamingRefusal';

        Object.setPrototypeOf(this, StreamingRefusal.prototype);
    }

    public getFormattedMessage(): string {
        switch (this.reason.type) {
            case 'LateArrival':
                return `Event ${this.eventId} arrived late. Threshold: ${this.reason.threshold}, Delay: ${this.reason.actualDelay}ms.`;
            case 'MalformedEvent':
                return `Event ${this.eventId} is malformed: ${this.reason.details}.`;
            case 'BufferOverflow':
                return `Refused event ${this.eventId} due to buffer overflow (capacity: ${this.reason.capacity}).`;
            case 'InvalidSequence':
                return `Invalid sequence for event ${this.eventId}. Expected ${this.reason.expected}, but received ${this.reason.received}.`;
            default:
                const _exhaustiveCheck: never = this.reason;
                throw new Error(`Unhandled refusal reason: ${JSON.stringify(_exhaustiveCheck)}`);
        }
    }
}
