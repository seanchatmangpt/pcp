export interface TelemetryEvent {
  timestamp: string;
  type: string;
  payload: any;
}

export class HookTelemetry {
  private events: TelemetryEvent[] = [];

  public log(type: string, payload: any): void {
    this.events.push({
      timestamp: new Date().toISOString(),
      type,
      payload,
    });
  }

  public getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  public clear(): void {
    this.events = [];
  }
}
