import { HookMessage } from '../hook-otp/types';

export function compressMessageLog(messages: HookMessage[]): HookMessage[] {
  const seenIds = new Set<string>();
  const compressed: HookMessage[] = [];

  // Remove duplicate messages by ID or correlationId
  for (const msg of messages) {
    const key = msg.correlationId || msg.id;
    if (!seenIds.has(key)) {
      seenIds.add(key);
      compressed.push(msg);
    }
  }

  return compressed;
}
