import { useState, useEffect, useCallback, useMemo } from 'react';
import { SyncJobBase } from '../types';
import { SyncReplaySession, SyncQueueSnapshot, ReplayEvent } from './types';
import { SyncReplayManager } from './manager';

export interface UseSyncReplayResult<TJob extends SyncJobBase> {
  currentIndex: number;
  currentEvent: ReplayEvent<TJob> | null;
  currentSnapshot: SyncQueueSnapshot<TJob>;
  isPlaying: boolean;
  playbackSpeed: number;
  canGoBack: boolean;
  canGoForward: boolean;
  next: () => void;
  prev: () => void;
  seek: (index: number) => void;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  totalEvents: number;
}

export function useSyncReplay<TJob extends SyncJobBase>(
  session: SyncReplaySession<TJob>
): UseSyncReplayResult<TJob> {
  const manager = useMemo(() => new SyncReplayManager(session), [session]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const totalEvents = manager.getEventCount();

  const next = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, totalEvents - 1));
  }, [totalEvents]);

  const prev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, -1));
  }, []);

  const seek = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(-1, Math.min(index, totalEvents - 1)));
    },
    [totalEvents]
  );

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const setSpeed = useCallback((speed: number) => setPlaybackSpeed(speed), []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && currentIndex < totalEvents - 1) {
      timer = setTimeout(() => {
        next();
      }, 1000 / playbackSpeed);
    } else if (currentIndex >= totalEvents - 1) {
      setIsPlaying(false);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentIndex, totalEvents, playbackSpeed, next]);

  const currentEvent = currentIndex >= 0 ? manager.getEvent(currentIndex) || null : null;
  const currentSnapshot = manager.getSnapshotAt(currentIndex);

  return {
    currentIndex,
    currentEvent,
    currentSnapshot,
    isPlaying,
    playbackSpeed,
    canGoBack: currentIndex > -1,
    canGoForward: currentIndex < totalEvents - 1,
    next,
    prev,
    seek,
    play,
    pause,
    setSpeed,
    totalEvents,
  };
}
