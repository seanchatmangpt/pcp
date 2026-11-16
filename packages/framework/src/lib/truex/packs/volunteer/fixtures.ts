import { HookMessage } from '../../hook-otp/types';

export const volunteerReplayFixtures: {
  initialState: any;
  messages: HookMessage[];
  expectedHistory: { messageId: string; outputHash: string; runId: string }[];
} = {
  initialState: {
    openSlots: 3,
    candidates: ['Alice Smith', 'Bob Johnson'],
    shortageRatio: 0.33,
    serviceDate: '2026-05-24',
  },
  messages: [
    {
      id: 'msg-fixture-1',
      type: 'graph_delta',
      payload: { action: 'cancel' },
      actorRef: {
        tenantId: 'tenant-123',
        packId: 'volunteer',
        hookId: 'volunteer_shortage',
        instanceId: 'default-instance',
      },
      timestamp: '2026-05-23T01:26:45-07:00',
    },
  ],
  expectedHistory: [
    {
      messageId: 'msg-fixture-1',
      outputHash: 'will_be_recalculated_dynamically',
      runId: 'run-fixture-1',
    },
  ],
};
