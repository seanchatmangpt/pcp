import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

/**
 * Log levels for the LogViewer.
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Interface representing a single log entry.
 */
export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: number;
}

/**
 * Props for the LogViewer component.
 */
export interface LogViewerProps {
  /** Array of logs to display */
  logs: LogEntry[];
  /** Optional title for the viewer */
  title?: string;
  /** Maximum height of the viewer */
  maxHeight?: number;
}

/**
 * Enhanced Log Viewer for Admin Diagnostics.
 * Displays real-time logs with color coding based on log level.
 *
 * @param props - Component properties.
 */
export const LogViewer: React.FC<LogViewerProps> = ({
  logs,
  title = 'System Logs',
  maxHeight = 300,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView style={[styles.scrollView, { maxHeight }]} nestedScrollEnabled>
        {logs.length === 0 ? (
          <Text style={styles.emptyText}>No logs available.</Text>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text style={[styles.level, styles[log.level]]}>[{log.level.toUpperCase()}]</Text>
              <Text style={styles.timestamp}>{new Date(log.timestamp).toLocaleTimeString()}</Text>
              <Text style={styles.message}>{log.message}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  scrollView: {
    backgroundColor: '#000',
    borderRadius: 4,
    padding: 8,
  },
  emptyText: {
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  logRow: {
    flexDirection: 'row',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  level: {
    fontWeight: 'bold',
    marginRight: 8,
    width: 60,
  },
  info: {
    color: '#4caf50',
  },
  warn: {
    color: '#ff9800',
  },
  error: {
    color: '#f44336',
  },
  debug: {
    color: '#2196f3',
  },
  timestamp: {
    color: '#888',
    marginRight: 8,
  },
  message: {
    color: '#ddd',
    flex: 1,
  },
});
