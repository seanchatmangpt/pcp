import { HookBehavior } from '../../hook-otp/types';

export const volunteerShortageBehavior: HookBehavior = {
  init: async () => ({
    openSlots: 3,
    candidates: ['Alice Smith', 'Bob Johnson'],
    shortageRatio: 0.33,
    serviceDate: '2026-05-24',
  }),
  handleDelta: async (msg, ctx) => {
    if (msg.payload.action === 'cancel') {
      ctx.state.openSlots += 1;
      ctx.state.shortageRatio = ctx.state.openSlots / 9;
      return [{ type: 'slot_opened', payload: { openSlots: ctx.state.openSlots } }];
    }
    return [];
  },
};
