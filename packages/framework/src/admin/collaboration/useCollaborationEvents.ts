import { useEffect, useRef, useCallback } from 'react';
import { CollaborationEvent, UseCollaborationEventsOptions } from './types';

/**
 * Hook for broadcasting and receiving real-time collaboration events.
 * Useful for cursor movements, typing indicators, etc.
 *
 * @param options - Configuration options including channelId and eventType.
 * @returns Object containing a function to broadcast events.
 */
export function useCollaborationEvents<T = unknown>(options: UseCollaborationEventsOptions<T>) {
  const { channelId, eventType, onEvent } = options;

  useEffect(() => {
    if (!channelId) return;

    // Stub implementation
    console.warn('useCollaborationEvents is stubbed');

    return () => {
      // cleanup
    };
  }, [channelId, eventType, onEvent]);

  /**
   * Broadcast an event to all users in the channel.
   *
   * @param userId - The ID of the user sending the event.
   * @param payload - The data to broadcast.
   */
  const broadcast = useCallback((userId: string, payload: T) => {
    console.warn('broadcast is stubbed', userId, payload);
  }, []);

  return { broadcast };
}
