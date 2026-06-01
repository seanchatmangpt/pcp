import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SyncJobBase } from '../types';
import { SyncReplaySession } from './types';
import { useSyncReplay } from './useSyncReplay';

export interface SyncReplayDebuggerProps<TJob extends SyncJobBase> {
  session: SyncReplaySession<TJob>;
  onClose?: () => void;
}

export const SyncReplayDebugger = <TJob extends SyncJobBase>({
  session,
  onClose,
}: SyncReplayDebuggerProps<TJob>) => {
  const {
    currentIndex,
    currentEvent,
    currentSnapshot,
    isPlaying,
    canGoBack,
    canGoForward,
    next,
    prev,
    play,
    pause,
    totalEvents,
  } = useSyncReplay(session);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sync Replay Debugger</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          onPress={prev}
          disabled={!canGoBack}
          style={[styles.button, !canGoBack && styles.disabled]}>
          <Text>Prev</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={isPlaying ? pause : play} style={styles.button}>
          <Text>{isPlaying ? 'Pause' : 'Play'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={next}
          disabled={!canGoForward}
          style={[styles.button, !canGoForward && styles.disabled]}>
          <Text>Next</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progress}>
        <Text>
          Step: {currentIndex + 1} / {totalEvents}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {currentEvent && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event: {currentEvent.type}</Text>
            <Text>Job ID: {String(currentEvent.jobId)}</Text>
            {currentEvent.error && (
              <Text style={styles.errorText}>Error: {JSON.stringify(currentEvent.error)}</Text>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Queue State</Text>
          <View style={styles.snapshotGrid}>
            <SnapshotColumn title="Pending" jobs={currentSnapshot.pending} />
            <SnapshotColumn title="Processing" jobs={currentSnapshot.processing} />
            <SnapshotColumn title="Failed" jobs={currentSnapshot.failed} />
            <SnapshotColumn title="Quarantined" jobs={currentSnapshot.quarantined} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const SnapshotColumn = ({ title, jobs }: { title: string; jobs: SyncJobBase[] }) => (
  <View style={styles.column}>
    <Text style={styles.columnTitle}>
      {title} ({jobs.length})
    </Text>
    {jobs.map((job) => (
      <View key={String(job.id)} style={styles.jobItem}>
        <Text style={styles.jobId}>#{String(job.id).slice(0, 8)}</Text>
        <Text style={styles.jobType}>{job.jobType}</Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#ddd',
    borderRadius: 4,
  },
  closeButtonText: {
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    marginHorizontal: 8,
  },
  disabled: {
    backgroundColor: '#A0CFFF',
  },
  progress: {
    alignItems: 'center',
    marginBottom: 16,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorText: {
    color: 'red',
    marginTop: 4,
  },
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  column: {
    width: '50%',
    padding: 4,
    marginBottom: 8,
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#666',
  },
  jobItem: {
    backgroundColor: '#f9f9f9',
    padding: 6,
    borderRadius: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  jobId: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#888',
  },
  jobType: {
    fontSize: 12,
  },
});
