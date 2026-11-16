import { HookMessage } from '../../hook-otp/types';

export const livestreamReplayFixtures: {
  initialState: any;
  messages: HookMessage[];
  expectedHistory: { messageId: string; outputHash: string; runId: string }[];
} = {
  initialState: {
    streamStatus: 'healthy',
    bitrateKbps: 4500,
    packetLossRatio: 0.0,
    incidentCount: 0,
    operatorAlerted: false,
    memberNotified: false,
    escalated: false,
    resolved: true,
    history: ['Initialized livestream status as healthy.'],
  },
  messages: [
    {
      id: 'msg-livestream-fixture-1',
      type: 'graph_delta',
      payload: { action: 'degrade', bitrateKbps: 1200, packetLossRatio: 0.12 },
      actorRef: {
        tenantId: 'tenant-123',
        packId: 'livestream',
        hookId: 'livestream_degradation',
        instanceId: 'default-instance',
      },
      timestamp: '2026-06-01T09:14:00-07:00',
    },
  ],
  expectedHistory: [
    {
      messageId: 'msg-livestream-fixture-1',
      outputHash: 'will_be_recalculated_dynamically',
      runId: 'run-livestream-fixture-1',
    },
  ],
};
