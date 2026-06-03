import { TemporalOrder, TemporalProfile, TemporalRefusal, Result } from "./types";

/**
 * Defensive panic boundary for unreachable states.
 */
function panic(message: string): never {
    throw new Error(`PANIC [Temporal Capability]: ${message}`);
}

export interface EventRecord {
    eventId: string;
    timestamp: number;
    localClockAtReceipt: number;
}

export class TemporalAnalyzer {
    private events: Map<string, EventRecord>;
    private readonly maxClockDriftMs: number;
    private lastRecordedTimestamp: number;

    constructor(maxClockDriftMs: number = 5000) {
        this.events = new Map();
        this.maxClockDriftMs = maxClockDriftMs;
        this.lastRecordedTimestamp = -1;
    }

    /**
     * Ingests an event and validates temporal constraints.
     */
    public ingestEvent(event: EventRecord): Result<void, TemporalRefusal> {
        // Edge case: empty string event ID
        if (event.eventId.trim() === "") {
            panic("Event ID cannot be empty");
        }

        // Exhaustive check for ClockDriftDetected
        const drift = Math.abs(event.timestamp - event.localClockAtReceipt);
        if (drift > this.maxClockDriftMs) {
            return { success: false, error: "ClockDriftDetected" };
        }

        // Exhaustive check for NonMonotonicTimestamps
        if (this.lastRecordedTimestamp !== -1 && event.timestamp < this.lastRecordedTimestamp) {
            return { success: false, error: "NonMonotonicTimestamps" };
        }

        // State update
        this.events.set(event.eventId, { ...event });
        this.lastRecordedTimestamp = event.timestamp;

        return { success: true, value: undefined };
    }

    /**
     * Determines the temporal order between two specific timestamps.
     */
    private computeOrder(ts1: number, ts2: number): TemporalOrder {
        if (ts1 < ts2) {
            return "Before";
        } else if (ts1 > ts2) {
            return "After";
        } else if (ts1 === ts2) {
            return "Concurrent";
        }
        
        // This should be mathematically impossible, hence panic!
        panic(`Unreachable state during timestamp comparison: ts1=${ts1}, ts2=${ts2}`);
    }

    /**
     * Evaluates the relationship between two specific events by their IDs.
     */
    public evaluateRelation(eventIdA: string, eventIdB: string): TemporalOrder {
        const eventA = this.events.get(eventIdA);
        const eventB = this.events.get(eventIdB);

        if (!eventA || !eventB) {
            return "Unknown";
        }

        const order = this.computeOrder(eventA.timestamp, eventB.timestamp);

        // Exhaustive pattern matching simulation on the derived order
        switch (order) {
            case "Before":
            case "After":
            case "Concurrent":
                return order;
            case "Unknown":
                panic("computeOrder should never return 'Unknown'");
                break;
            default:
                const _exhaustiveCheck: never = order;
                panic(`Unhandled temporal order matched: ${_exhaustiveCheck}`);
        }
    }

    /**
     * Generates a complete TemporalProfile containing all pairwise relations
     * for the currently ingested events.
     */
    public buildProfile(): TemporalProfile {
        const relations: Array<[string, string, TemporalOrder]> = [];
        const eventIds = Array.from(this.events.keys());

        for (let i = 0; i < eventIds.length; i++) {
            for (let j = i + 1; j < eventIds.length; j++) {
                const idA = eventIds[i];
                const idB = eventIds[j];

                // Ensure idA and idB are properly defined
                if (idA === undefined || idB === undefined) {
                    panic("Undefined event ID encountered during profile building");
                }

                const order = this.evaluateRelation(idA, idB);
                
                // Add relation A -> B
                relations.push([idA, idB, order]);

                // Calculate the inverse relation for completeness
                let inverseOrder: TemporalOrder;
                switch (order) {
                    case "Before":
                        inverseOrder = "After";
                        break;
                    case "After":
                        inverseOrder = "Before";
                        break;
                    case "Concurrent":
                        inverseOrder = "Concurrent";
                        break;
                    case "Unknown":
                        inverseOrder = "Unknown";
                        break;
                    default:
                        const _exhaustiveCheck: never = order;
                        panic(`Unhandled temporal order during inversion: ${_exhaustiveCheck}`);
                }

                relations.push([idB, idA, inverseOrder]);
            }
        }

        return { relations };
    }
}

export * from "./types";
