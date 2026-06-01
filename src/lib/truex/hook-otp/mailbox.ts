import { HookMessage } from './types';

export class HookMailbox {
  private queue: HookMessage[] = [];
  private processing = false;
  private processor: (msg: HookMessage) => Promise<void>;

  constructor(processor: (msg: HookMessage) => Promise<void>) {
    this.processor = processor;
  }

  /**
   * Push a message onto the mailbox queue.
   */
  public push(msg: HookMessage): void {
    this.queue.push(msg);
    this.triggerProcessing();
  }

  /**
   * Returns the count of pending messages in the queue.
   */
  public getLength(): number {
    return this.queue.length;
  }

  /**
   * Returns copies of the currently queued messages.
   */
  public getMessages(): HookMessage[] {
    return [...this.queue];
  }

  /**
   * Clears the mailbox queue.
   */
  public clear(): void {
    this.queue = [];
  }

  /**
   * Sequentially process all messages in the mailbox queue.
   */
  private async triggerProcessing(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const msg = this.queue.shift();
      if (msg) {
        try {
          await this.processor(msg);
        } catch (err) {
          // Processing errors are expected to be handled by the behavior execution context
          // and the supervisor, but we capture them here to avoid breaking the mailbox loop.
          console.error(`[Mailbox] Error processing message ${msg.id}:`, err);
        }
      }
    }

    this.processing = false;
  }
}
