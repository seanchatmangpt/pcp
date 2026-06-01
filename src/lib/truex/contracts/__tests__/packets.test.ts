import { createHookPacket, HookPacket } from '../hookPacket';
import { createHookReceiptContract, HookReceiptContract } from '../hookReceipt';
import { HookActorRef, HookMessage } from '../../hook-otp/types';

describe('Contracts', () => {
  const mockActorRef: HookActorRef = {
    tenantId: 'tenant-1',
    packId: 'pack-1',
    hookId: 'hook-1',
    instanceId: 'inst-1'
  };

  const mockMessage: HookMessage = {
    id: 'msg-1',
    type: 'graph_delta',
    payload: {},
    actorRef: mockActorRef,
    timestamp: new Date().toISOString()
  };

  describe('HookPacket', () => {
    it('should create a HookPacket correctly', () => {
      const packetData: HookPacket = {
        packetId: 'packet-1',
        tenantId: 'tenant-1',
        message: mockMessage,
        sentAt: new Date().toISOString(),
        attempts: 2
      };

      const packet = createHookPacket(packetData);
      expect(packet.packetId).toBe('packet-1');
      expect(packet.tenantId).toBe('tenant-1');
      expect(packet.message).toEqual(mockMessage);
      expect(packet.attempts).toBe(2);
    });

    it('should default attempts to 0 if falsy', () => {
      const packetData = {
        packetId: 'packet-2',
        tenantId: 'tenant-1',
        message: mockMessage,
        sentAt: new Date().toISOString(),
        attempts: 0
      } as HookPacket;

      const packet = createHookPacket(packetData);
      expect(packet.attempts).toBe(0);
    });
  });

  describe('HookReceiptContract', () => {
    it('should create a HookReceiptContract correctly', () => {
      const receiptData: HookReceiptContract = {
        receiptHash: 'hash-1',
        previousReceiptHash: 'hash-0',
        hookRunId: 'run-1',
        tenantId: 'tenant-1',
        actorRef: mockActorRef,
        messageId: 'msg-1',
        inputHash: 'hash-in',
        outputHash: 'hash-out',
        deltaHash: 'hash-delta',
        status: 'Confirmed',
        avatarProjectionHashes: { a: 'b' },
        supervisorEvents: ['event-1'],
        timestamp: new Date().toISOString()
      };

      const receipt = createHookReceiptContract(receiptData);
      expect(receipt.receiptHash).toBe('hash-1');
      expect(receipt.status).toBe('Confirmed');
      expect(receipt.avatarProjectionHashes).toEqual({ a: 'b' });
      expect(receipt.supervisorEvents).toEqual(['event-1']);
    });

    it('should use defaults for status, avatarProjectionHashes, and supervisorEvents if not provided or falsy', () => {
      const receiptData = {
        receiptHash: 'hash-2',
        previousReceiptHash: 'hash-0',
        hookRunId: 'run-2',
        tenantId: 'tenant-2',
        actorRef: mockActorRef,
        messageId: 'msg-2',
        inputHash: 'hash-in-2',
        outputHash: 'hash-out-2',
        deltaHash: 'hash-delta-2',
        timestamp: new Date().toISOString()
      } as HookReceiptContract;

      const receipt = createHookReceiptContract(receiptData);
      expect(receipt.status).toBe('Pending');
      expect(receipt.avatarProjectionHashes).toEqual({});
      expect(receipt.supervisorEvents).toEqual([]);
    });
  });
});
