import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';
import { HookRuntime } from '../lib/truex/hook-otp/runtime';
import { HookActorRef, HookMessage, HookReceipt, HookBehavior } from '../lib/truex/hook-otp/types';
import { AvatarRole, AvatarProjection } from '../lib/truex/avatar/types';
import { projectHookOutput } from '../lib/truex/avatar/projector';
import { DefaultHookSupervisor } from '../lib/truex/hook-otp/supervisor';
import { stringifyActorRef } from '../lib/truex/hook-otp/actorRef';
import { livestreamIncidentBehavior } from '../lib/truex/packs/livestream/hooks';
import { supabase } from '@/lib/supabase';

interface VkgContextType {
  pendingReceipts: number;
  processedReceipts: number;
  quarantinedHooks: string[];
  lastReceipt: HookReceipt | null;
  avatar: AvatarRole;
  setAvatar: (role: AvatarRole) => void;
  projection: AvatarProjection | null;
  triggerHook: (subject: string, predicate: string, object: string) => Promise<void>;
  repairLastQuarantine: () => Promise<void>;
  activeHookId: 'volunteer_shortage' | 'livestream_degradation';
  setActiveHookId: (hookId: 'volunteer_shortage' | 'livestream_degradation') => void;
  triggerLivestream: (
    action: 'degrade' | 'escalate' | 'resolve',
    bitrateKbps?: number,
    packetLossRatio?: number
  ) => Promise<void>;
}

const VkgContext = createContext<VkgContextType | undefined>(undefined);

// Core behavior for volunteer shortages
const volunteerShortageBehavior: HookBehavior = {
  init: async () => ({
    openSlots: 4,
    candidates: ['Sarah Brown', 'Michael Green', 'David White'],
    shortageRatio: 0.5,
    serviceDate: '2026-05-24',
  }),
  handleDelta: async (msg, ctx) => {
    if (msg.payload.action === 'cancel') {
      ctx.state.openSlots += 1;
      ctx.state.shortageRatio = ctx.state.openSlots / 8;
      return [{ type: 'slot_opened', payload: { openSlots: ctx.state.openSlots } }];
    }
    return [];
  },
};

const volunteerActorRef: HookActorRef = {
  tenantId: 'tenant-123',
  packId: 'volunteer',
  hookId: 'volunteer_shortage',
  instanceId: 'default-instance',
};

const livestreamActorRef: HookActorRef = {
  tenantId: 'tenant-123',
  packId: 'livestream',
  hookId: 'livestream_degradation',
  instanceId: 'default-instance',
};

const runtime = new HookRuntime();

export function VkgProvider({ children }: { children: ReactNode }) {
  const [pendingReceipts, setPendingReceipts] = useState(0);
  const [processedReceipts, setProcessedReceipts] = useState(0);
  const [quarantinedHooks, setQuarantinedHooks] = useState<string[]>([]);
  const [lastReceipt, setLastReceipt] = useState<HookReceipt | null>(null);
  const [avatar, setAvatar] = useState<AvatarRole>('member');
  const [projection, setProjection] = useState<AvatarProjection | null>(null);
  const [actorState, setActorState] = useState<any>(null);
  const [activeHookId, setActiveHookId] = useState<'volunteer_shortage' | 'livestream_degradation'>(
    'volunteer_shortage'
  );

  // Initialize runtime actors
  useEffect(() => {
    const initActors = async () => {
      const volInstance = await runtime.spawn(
        volunteerActorRef,
        volunteerShortageBehavior,
        new DefaultHookSupervisor(3, 10)
      );

      const liveInstance = await runtime.spawn(
        livestreamActorRef,
        livestreamIncidentBehavior,
        new DefaultHookSupervisor(5, 20)
      );

      // Set initial state
      if (activeHookId === 'volunteer_shortage') {
        setActorState({ ...volInstance.state });
        setProjection(projectHookOutput('volunteer_shortage', volInstance.state, avatar));
      } else {
        setActorState({ ...liveInstance.state });
        setProjection(projectHookOutput('livestream_degradation', liveInstance.state, avatar));
      }
    };
    initActors();
  }, []);

  // Update state/projection when activeHookId or avatar changes
  useEffect(() => {
    const registry = runtime.getRegistry();
    const currentRef =
      activeHookId === 'volunteer_shortage' ? volunteerActorRef : livestreamActorRef;
    const instance = registry.get(currentRef);
    if (instance) {
      setActorState({ ...instance.state });
      setProjection(projectHookOutput(activeHookId, instance.state, avatar));
    }
  }, [activeHookId, avatar]);

  // Telemetry listener to catch runtime events
  useEffect(() => {
    const handleTelemetry = (evt: any) => {
      const registry = runtime.getRegistry();
      if (evt.type === 'message_processed') {
        setLastReceipt(evt.receipt);
        if (evt.actorRef.hookId === activeHookId) {
          const instance = registry.get(evt.actorRef);
          if (instance) {
            setActorState({ ...instance.state });
          }
        }
      } else if (evt.type === 'supervisor_intervention' && evt.action === 'quarantine') {
        setQuarantinedHooks((prev) => [...prev, stringifyActorRef(evt.actorRef)]);
      }
    };
    runtime.registerTelemetry(handleTelemetry);
    return () => runtime.unregisterTelemetry(handleTelemetry);
  }, [activeHookId]);

  /**
   * Triggers a volunteer shortage hook mutation optimistically.
   */
  const triggerHook = useCallback(
    async (subject: string, predicate: string, object: string) => {
      setPendingReceipts((prev) => prev + 1);

      const msg: HookMessage = {
        id: 'msg_' + Math.random().toString(36).substring(2, 11),
        type: 'graph_delta',
        payload: { action: 'cancel', subject, predicate, object },
        actorRef: volunteerActorRef,
        timestamp: new Date().toISOString(),
      };

      try {
        runtime.send(volunteerActorRef, msg);
      } catch (err) {
        console.error('Local evaluation error:', err instanceof Error ? err.message : err);
      }

      // Simulate Outbox Sync to Supabase Edge function
      try {
        const { data: result, error } = await supabase.functions.invoke('vkg-hooks-apply', {
          body: { delta: msg.payload },
        });

        if (!error && result) {
          setPendingReceipts((prev) => Math.max(0, prev - 1));
          setProcessedReceipts((prev) => prev + 1);
          if (result.receipt) {
            setLastReceipt({
              receiptHash: result.receipt,
              previousReceiptHash: lastReceipt?.receiptHash || 'init_chain_hash',
              hookRunId: 'run_authoritative',
              tenantId: volunteerActorRef.tenantId,
              actorRef: volunteerActorRef,
              messageId: msg.id,
              inputHash: 'input_hash',
              outputHash: 'output_hash',
              deltaHash: 'delta_hash',
              status: 'Confirmed',
              avatarProjectionHashes: {},
              supervisorEvents: [],
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          throw error || new Error('Supabase Edge offline or returned error');
        }
      } catch (err) {
        // Local fallback
        setTimeout(() => {
          setPendingReceipts((prev) => Math.max(0, prev - 1));
          setProcessedReceipts((prev) => prev + 1);
        }, 1500);
      }
    },
    [lastReceipt]
  );

  /**
   * Triggers a livestream incident hook mutation.
   */
  const triggerLivestream = useCallback(
    async (
      action: 'degrade' | 'escalate' | 'resolve',
      bitrateKbps?: number,
      packetLossRatio?: number
    ) => {
      setPendingReceipts((prev) => prev + 1);

      const msg: HookMessage = {
        id: 'msg_' + Math.random().toString(36).substring(2, 11),
        type: 'graph_delta',
        payload: { action, bitrateKbps, packetLossRatio },
        actorRef: livestreamActorRef,
        timestamp: new Date().toISOString(),
      };

      try {
        runtime.send(livestreamActorRef, msg);
      } catch (err) {
        console.error('Local evaluation error:', err instanceof Error ? err.message : err);
      }

      // Simulate Outbox Sync fallback
      setTimeout(() => {
        setPendingReceipts((prev) => Math.max(0, prev - 1));
        setProcessedReceipts((prev) => prev + 1);

        setLastReceipt({
          receiptHash: 'auth_' + Math.random().toString(36).substring(2, 11),
          previousReceiptHash: lastReceipt?.receiptHash || 'init_chain_hash',
          hookRunId: 'run_authoritative_livestream',
          tenantId: livestreamActorRef.tenantId,
          actorRef: livestreamActorRef,
          messageId: msg.id,
          inputHash: 'input_hash',
          outputHash: 'output_hash',
          deltaHash: 'delta_hash',
          status: 'Confirmed',
          avatarProjectionHashes: {},
          supervisorEvents: [],
          timestamp: new Date().toISOString(),
        });
      }, 1000);
    },
    [lastReceipt]
  );

  const repairLastQuarantine = useCallback(async () => {
    const registry = runtime.getRegistry();
    const currentRef =
      activeHookId === 'volunteer_shortage' ? volunteerActorRef : livestreamActorRef;
    const instance = registry.get(currentRef);
    if (instance) {
      const repairMsg: HookMessage = {
        id: 'msg_repair_' + Date.now(),
        type: 'supervisor_signal',
        payload: {
          action: 'repair',
          state:
            activeHookId === 'volunteer_shortage'
              ? {
                  openSlots: 4,
                  candidates: ['Sarah Brown', 'Michael Green'],
                  shortageRatio: 0.5,
                  serviceDate: '2026-05-24',
                }
              : {
                  streamStatus: 'healthy',
                  bitrateKbps: 4500,
                  packetLossRatio: 0.0,
                  incidentCount: 0,
                  operatorAlerted: false,
                  memberNotified: false,
                  escalated: false,
                  resolved: true,
                  history: ['Incident repaired by supervisor intervention.'],
                },
        },
        actorRef: currentRef,
        timestamp: new Date().toISOString(),
      };
      instance.quarantined = false;
      setQuarantinedHooks([]);
      runtime.send(currentRef, repairMsg);
    }
  }, [activeHookId]);

  return (
    <VkgContext.Provider
      value={{
        pendingReceipts,
        processedReceipts,
        quarantinedHooks,
        lastReceipt,
        avatar,
        setAvatar,
        projection,
        triggerHook,
        repairLastQuarantine,
        activeHookId,
        setActiveHookId,
        triggerLivestream,
      }}
    >
      {children}
    </VkgContext.Provider>
  );
}

export function useVkgEngine() {
  const context = useContext(VkgContext);
  if (context === undefined) {
    throw new Error('useVkgEngine must be used within a VkgProvider');
  }
  return context;
}
