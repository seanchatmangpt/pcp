import { StreamingRefusal } from './StreamingRefusal';

export interface Event {
    id: string;
    caseId: string;
    activity: string;
    timestamp: number;
    attributes: Record<string, unknown>;
}

export class EventWindow {
    public readonly id: string;
    public readonly startTime: number;
    public readonly endTime: number;
    private events: Event[];
    private capacity: number;
    private closed: boolean;

    constructor(id: string, startTime: number, endTime: number, capacity: number = 10000) {
        if (startTime >= endTime) {
            throw new Error("Invalid window boundaries: startTime must be strictly less than endTime");
        }
        this.id = id;
        this.startTime = startTime;
        this.endTime = endTime;
        this.capacity = capacity;
        this.events = [];
        this.closed = false;
    }

    public addEvent(event: Event): void {
        if (this.closed) {
            throw new StreamingRefusal(event.id, {
                type: 'LateArrival',
                threshold: this.endTime,
                actualDelay: event.timestamp > this.endTime ? event.timestamp - this.endTime : 0
            });
        }

        if (event.timestamp < this.startTime || event.timestamp > this.endTime) {
            throw new StreamingRefusal(event.id, {
                type: 'MalformedEvent',
                details: `Event timestamp ${event.timestamp} is outside window [${this.startTime}, ${this.endTime}]`
            });
        }

        if (this.events.length >= this.capacity) {
            throw new StreamingRefusal(event.id, {
                type: 'BufferOverflow',
                capacity: this.capacity
            });
        }

        // Maintain ordered insertion based on timestamp
        const index = this.events.findIndex(e => e.timestamp > event.timestamp);
        if (index === -1) {
            this.events.push(event);
        } else {
            this.events.splice(index, 0, event);
        }
    }

    public close(): void {
        this.closed = true;
    }

    public isClosed(): boolean {
        return this.closed;
    }

    public getEvents(): readonly Event[] {
        return this.events;
    }

    public getEventCount(): number {
        return this.events.length;
    }
}
