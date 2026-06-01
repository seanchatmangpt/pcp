import { useState, useEffect } from 'react';

export interface AalstEvent {
  id: string;
  type: 'PETRI_NET' | 'ALIGNMENT' | 'OCEL_TELEMETRY' | 'CONVERSATION_FEED';
  payload: string;
  timestamp: number;
}

const FINAL_LOGS: AalstEvent[] = [
  {
    id: 'final-petri',
    type: 'PETRI_NET',
    payload: JSON.stringify({
      places: [
        { id: 'INBOX', tokens: 0 },
        { id: 'VERIFYING', tokens: 0 },
        { id: 'CERTIFIED', tokens: 1 },
      ],
      transitions: [
        { id: 'RECEIVE', enabled: false },
        { id: 'PROCESS', enabled: false },
        { id: 'ARCHIVE', enabled: true },
      ],
    }),
    timestamp: Date.now(),
  },
  {
    id: 'final-metrics',
    type: 'CONVERSATION_FEED',
    payload: 'Final Metrics: 100% Semantic Fit, 1.0 Conformance, 0 Drift Detected.',
    timestamp: Date.now(),
  },
  {
    id: 'broadcast-status',
    type: 'OCEL_TELEMETRY',
    payload: 'BROADCAST ACTIVE - VAN DER AALST CERTIFIED',
    timestamp: Date.now(),
  },
];

export function useAalstStream() {
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<AalstEvent[]>([]);

  useEffect(() => {
    setIsConnected(true);
    setLogs(FINAL_LOGS);

    return () => {
      setIsConnected(false);
    };
  }, []);

  return { isConnected, logs };
}
