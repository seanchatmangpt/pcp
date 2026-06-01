import { create } from 'zustand';
import { VirtualKnowledgeGraphClient } from '../vkg/client';
import { ActorDispatcher, ActorSyncEngine } from './dispatcher';
import { Principal, Receipt } from './types';
import { MembraneContext } from '../membrane/context';
import { ProxyableBridge } from '../membrane/proxyableBridge';

// Define the global operational membrane context for simulator/dev mutations
const globalStateMembraneContext = new MembraneContext({
  mode: 'strict',
  tenantId: 'tenant-default',
  authorityRole: 'admin',
});

// Target state object that will hold the actual values under proxy protection
const globalStateTarget = {
  networkOffline: false,
  remoteRejectionMocked: false,
  currentPrincipal: { id: 'usr-admin', role: 'admin' } as Principal,
  packetDropRate: 0,
};

// Wrap the target state object in a ProxyableBridge governed by the MembraneContext
const proxyGlobalState = ProxyableBridge.wrap(globalStateTarget, globalStateMembraneContext, {
  onMutation: (prop, value) => {
    if (prop === 'networkOffline') {
      useActorOpsStore.setState({ networkOnline: !value });
    } else if (prop === 'remoteRejectionMocked') {
      useActorOpsStore.setState({ remoteRejectActive: value });
    } else if (prop === 'currentPrincipal') {
      useActorOpsStore.setState({ currentPrincipal: value });
    }
    /* istanbul ignore next */
    else if (prop === 'packetDropRate') {
      useActorOpsStore.setState({ packetDropRate: value });
    }
  },
});

export function isNetworkOffline(): boolean {
  return proxyGlobalState.networkOffline;
}

export function setNetworkOffline(val: boolean) {
  proxyGlobalState.networkOffline = val;
}

export function isRemoteRejectionMocked(): boolean {
  return proxyGlobalState.remoteRejectionMocked;
}

export function setRemoteRejectionMocked(val: boolean) {
  proxyGlobalState.remoteRejectionMocked = val;
}

export function getCurrentPrincipal(): Principal {
  return proxyGlobalState.currentPrincipal;
}

export function setCurrentPrincipal(principal: Principal) {
  proxyGlobalState.currentPrincipal = principal;
}

export function getPacketDropRate(): number {
  return proxyGlobalState.packetDropRate;
}

export function setPacketDropRate(val: number) {
  proxyGlobalState.packetDropRate = val;
}

// Global Singletons
export const globalVkgClient = new VirtualKnowledgeGraphClient();
export const globalSyncEngine = new ActorSyncEngine();
export const globalLocalDispatcher = new ActorDispatcher(globalVkgClient, { mode: 'local', authority: 'optimistic' }, globalSyncEngine);
export const globalRemoteDispatcher = new ActorDispatcher(globalVkgClient, { mode: 'remote', authority: 'authoritative' });

interface ActorOpsState {
  networkOnline: boolean;
  remoteRejectActive: boolean;
  currentPrincipal: Principal;
  latestReceipt: Receipt | null;
  latestEvent: string | null;
  outboxCount: number;
  quarantineCount: number;
  packetDropRate: number;
  cdcEventsCount: number;
  setNetworkOnline: (online: boolean) => void;
  setRemoteRejectActive: (active: boolean) => void;
  setCurrentPrincipal: (principal: Principal) => void;
  setLatestReceipt: (receipt: Receipt | null) => void;
  setLatestEvent: (event: string | null) => void;
  setCounts: (outbox: number, quarantine: number) => void;
  setPacketDropRate: (rate: number) => void;
  setCdcEventsCount: (count: number) => void;
}

export const useActorOpsStore = create<ActorOpsState>((set) => ({
  networkOnline: !proxyGlobalState.networkOffline,
  remoteRejectActive: proxyGlobalState.remoteRejectionMocked,
  currentPrincipal: proxyGlobalState.currentPrincipal,
  latestReceipt: null,
  latestEvent: null,
  outboxCount: 0,
  quarantineCount: 0,
  packetDropRate: proxyGlobalState.packetDropRate || 0,
  cdcEventsCount: 0,
  setNetworkOnline: (online) => {
    proxyGlobalState.networkOffline = !online;
    set({ networkOnline: online });
  },
  setRemoteRejectActive: (active) => {
    proxyGlobalState.remoteRejectionMocked = active;
    set({ remoteRejectActive: active });
  },
  setCurrentPrincipal: (principal) => {
    proxyGlobalState.currentPrincipal = principal;
    set({ currentPrincipal: principal });
  },
  setLatestReceipt: (receipt) => set({ latestReceipt: receipt }),
  setLatestEvent: (event) => set({ latestEvent: event }),
  setCounts: (outbox, quarantine) => set({ outboxCount: outbox, quarantineCount: quarantine }),
  setPacketDropRate: (rate) => {
    proxyGlobalState.packetDropRate = rate;
    set({ packetDropRate: rate });
  },
  setCdcEventsCount: (count) => set({ cdcEventsCount: count }),
}));
