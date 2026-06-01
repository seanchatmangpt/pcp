jest.unmock('../actorOps');
jest.unmock('@/src/lib/actor/actorOps');

import {
  isNetworkOffline,
  setNetworkOffline,
  isRemoteRejectionMocked,
  setRemoteRejectionMocked,
  getCurrentPrincipal,
  setCurrentPrincipal,
  getPacketDropRate,
  setPacketDropRate,
  useActorOpsStore,
  globalVkgClient,
  globalSyncEngine,
  globalLocalDispatcher,
  globalRemoteDispatcher,
} from '../actorOps';
import { Principal } from '../types';

describe('actorOps', () => {
  beforeEach(() => {
    // Reset state before each test
    setNetworkOffline(false);
    setRemoteRejectionMocked(false);
    setCurrentPrincipal({ id: 'usr-admin', role: 'admin' });
    setPacketDropRate(0);
  });

  describe('Global Proxy Getters/Setters', () => {
    it('should manage network offline state and sync with store', () => {
      expect(isNetworkOffline()).toBe(false);
      expect(useActorOpsStore.getState().networkOnline).toBe(true);

      setNetworkOffline(true);
      expect(isNetworkOffline()).toBe(true);
      expect(useActorOpsStore.getState().networkOnline).toBe(false);
    });

    it('should manage remote rejection mocked state and sync with store', () => {
      expect(isRemoteRejectionMocked()).toBe(false);
      expect(useActorOpsStore.getState().remoteRejectActive).toBe(false);

      setRemoteRejectionMocked(true);
      expect(isRemoteRejectionMocked()).toBe(true);
      expect(useActorOpsStore.getState().remoteRejectActive).toBe(true);
    });

    it('should manage current principal state and sync with store', () => {
      const defaultPrincipal = getCurrentPrincipal();
      expect(defaultPrincipal).toEqual({ id: 'usr-admin', role: 'admin' });
      expect(useActorOpsStore.getState().currentPrincipal).toEqual({ id: 'usr-admin', role: 'admin' });

      const newPrincipal: Principal = { id: 'usr-test', role: 'guest' };
      setCurrentPrincipal(newPrincipal);
      expect(getCurrentPrincipal()).toEqual(newPrincipal);
      expect(useActorOpsStore.getState().currentPrincipal).toEqual(newPrincipal);
    });

    it('should manage packet drop rate state and sync with store', () => {
      expect(getPacketDropRate()).toBe(0);
      expect(useActorOpsStore.getState().packetDropRate).toBe(0);

      setPacketDropRate(0.5);
      expect(getPacketDropRate()).toBe(0.5);
      expect(useActorOpsStore.getState().packetDropRate).toBe(0.5);
    });
  });

  describe('useActorOpsStore Actions', () => {
    it('setNetworkOnline should update proxy and store', () => {
      useActorOpsStore.getState().setNetworkOnline(false);
      expect(isNetworkOffline()).toBe(true);
      expect(useActorOpsStore.getState().networkOnline).toBe(false);

      useActorOpsStore.getState().setNetworkOnline(true);
      expect(isNetworkOffline()).toBe(false);
      expect(useActorOpsStore.getState().networkOnline).toBe(true);
    });

    it('setRemoteRejectActive should update proxy and store', () => {
      useActorOpsStore.getState().setRemoteRejectActive(true);
      expect(isRemoteRejectionMocked()).toBe(true);
      expect(useActorOpsStore.getState().remoteRejectActive).toBe(true);

      useActorOpsStore.getState().setRemoteRejectActive(false);
      expect(isRemoteRejectionMocked()).toBe(false);
      expect(useActorOpsStore.getState().remoteRejectActive).toBe(false);
    });

    it('setCurrentPrincipal should update proxy and store', () => {
      const principal: Principal = { id: 'usr-store', role: 'guest' };
      useActorOpsStore.getState().setCurrentPrincipal(principal);
      expect(getCurrentPrincipal()).toEqual(principal);
      expect(useActorOpsStore.getState().currentPrincipal).toEqual(principal);
    });

    it('setLatestReceipt should update store', () => {
      const receipt: any = { eventId: 'ev-123' };
      useActorOpsStore.getState().setLatestReceipt(receipt);
      expect(useActorOpsStore.getState().latestReceipt).toEqual(receipt);
    });

    it('setLatestEvent should update store', () => {
      useActorOpsStore.getState().setLatestEvent('TestEvent');
      expect(useActorOpsStore.getState().latestEvent).toBe('TestEvent');
    });

    it('setCounts should update outbox and quarantine counts in store', () => {
      useActorOpsStore.getState().setCounts(5, 2);
      expect(useActorOpsStore.getState().outboxCount).toBe(5);
      expect(useActorOpsStore.getState().quarantineCount).toBe(2);
    });

    it('setPacketDropRate should update proxy and store', () => {
      useActorOpsStore.getState().setPacketDropRate(0.8);
      expect(getPacketDropRate()).toBe(0.8);
      expect(useActorOpsStore.getState().packetDropRate).toBe(0.8);
    });

    it('setCdcEventsCount should update store', () => {
      useActorOpsStore.getState().setCdcEventsCount(42);
      expect(useActorOpsStore.getState().cdcEventsCount).toBe(42);
    });
  });

  describe('Global Singletons', () => {
    it('should initialize global singletons', () => {
      expect(globalVkgClient).toBeDefined();
      expect(globalSyncEngine).toBeDefined();
      expect(globalLocalDispatcher).toBeDefined();
      expect(globalRemoteDispatcher).toBeDefined();
    });
  });
});
