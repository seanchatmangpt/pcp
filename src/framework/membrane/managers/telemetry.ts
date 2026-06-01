import { MembraneTelemetryEvent, TelemetryListener } from '../types';

/**
 * Manages advanced telemetry tracing interfaces for the Membrane.
 */
export class TelemetryManager {
  private listeners = new Set<TelemetryListener>();
  private activeSpans = new Map<
    string,
    { startTime: number; name: string; traceId: string; parentSpanId?: string }
  >();

  /**
   * Registers a telemetry listener.
   */
  public register(listener: TelemetryListener) {
    this.listeners.add(listener);
  }

  /**
   * Unregisters a telemetry listener.
   */
  public unregister(listener: TelemetryListener) {
    this.listeners.delete(listener);
  }

  /**
   * Clears all telemetry listeners.
   */
  public clear() {
    this.listeners.clear();
  }

  /**
   * Emits a telemetry event to all registered listeners.
   */
  public emit(event: MembraneTelemetryEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Error in membrane telemetry listener:', e);
      }
    }
  }

  /**
   * Starts a new tracing span.
   * @param name The name of the span or operation.
   * @param traceId The overarching trace identifier.
   * @param parentSpanId An optional parent span identifier.
   * @returns The newly created spanId.
   */
  public startSpan(
    name: string,
    traceId: string = `trace_${Date.now()}`,
    parentSpanId?: string
  ): string {
    const spanId = `span_${Math.random().toString(36).substring(2, 11)}`;
    this.activeSpans.set(spanId, { startTime: Date.now(), name, traceId, parentSpanId });

    this.emit({
      timestamp: new Date().toISOString(),
      type: 'span_start',
      flowName: name,
      traceId,
      spanId,
      parentSpanId,
    });

    return spanId;
  }

  /**
   * Ends an active tracing span and calculates duration.
   * @param spanId The identifier of the span to end.
   */
  public endSpan(spanId: string) {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    const durationMs = Date.now() - span.startTime;
    this.emit({
      timestamp: new Date().toISOString(),
      type: 'span_end',
      flowName: span.name,
      traceId: span.traceId,
      spanId,
      parentSpanId: span.parentSpanId,
      durationMs,
    });

    this.activeSpans.delete(spanId);
  }
}
