import { HookMessage } from '../hook-otp/types';

export interface HookPacket {
  packetId: string;
  tenantId: string;
  message: HookMessage;
  sentAt: string;
  attempts: number;
}

export function createHookPacket(packet: HookPacket): HookPacket {
  return {
    ...packet,
    attempts: packet.attempts || 0,
  };
}
