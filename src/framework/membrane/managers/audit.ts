import { SecurityAuditEvent } from '../types';

export type AuditListener = (event: SecurityAuditEvent) => void;

/**
 * Manages security audit logs within the Membrane framework.
 */
export class AuditManager {
  private logs: SecurityAuditEvent[] = [];
  private listeners = new Set<AuditListener>();

  /**
   * Registers a listener for security audit events.
   * @param listener Callback function for audit events.
   */
  public registerListener(listener: AuditListener): void {
    this.listeners.add(listener);
  }

  /**
   * Unregisters a security audit listener.
   * @param listener Callback function to remove.
   */
  public unregisterListener(listener: AuditListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Logs a security audit event and notifies listeners.
   * @param level Severity level of the audit event.
   * @param action Description of the action taking place.
   * @param details Additional context for the event.
   * @param commandId Optional command ID context.
   * @param capabilityId Optional capability ID context.
   * @param actorId Optional actor ID performing the action.
   */
  public log(
    level: 'info' | 'warn' | 'critical',
    action: string,
    details: Record<string, any>,
    commandId?: string,
    capabilityId?: string,
    actorId?: string
  ): void {
    const event: SecurityAuditEvent = {
      timestamp: new Date().toISOString(),
      level,
      action,
      details,
      commandId,
      capabilityId,
      actorId,
    };

    this.logs.push(event);

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('Error in membrane audit listener:', e);
      }
    }
  }

  /**
   * Retrieves all logged security audit events.
   */
  public getLogs(): SecurityAuditEvent[] {
    return [...this.logs];
  }

  /**
   * Clears the current audit log history.
   */
  public clear(): void {
    this.logs = [];
  }
}
