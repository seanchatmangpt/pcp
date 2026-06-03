export type TemporalOrder = "Before" | "After" | "Concurrent" | "Unknown";

export interface TemporalProfile {
    relations: Array<[string, string, TemporalOrder]>;
}

export type TemporalRefusal = "ClockDriftDetected" | "NonMonotonicTimestamps";

export type Result<T, E> = 
    | { success: true; value: T }
    | { success: false; error: E };
