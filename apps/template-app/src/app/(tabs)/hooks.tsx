import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useVkgEngine } from '@/src/components/VkgProvider';
import { AvatarRole } from '@/src/lib/truex/avatar/types';
import { Ionicons } from '@expo/vector-icons';
import { OfflineBanner } from '@/src/components/OfflineBanner';

const rolesList: AvatarRole[] = [
  'guest',
  'member',
  'volunteer',
  'teamLead',
  'pastor',
  'admin',
  'operator',
];

export default function HooksProjection() {
  const {
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
  } = useVkgEngine();

  const isQuarantined = quarantinedHooks.length > 0;

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <ScrollView
        style={{ flex: 1, backgroundColor: '#0f172a' }}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      >
        <Text className="text-3xl font-extrabold text-slate-50 text-center mb-8 tracking-tight">
          Truex Hook Cockpit
        </Text>

        {/* Switch Avatar Control */}
        <View className="mb-8">
          <Text className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
            Select Avatar Context
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {rolesList.map((role) => (
              <TouchableOpacity
                key={role}
                className={`py-2 px-4 rounded-full border ${
                  avatar === role
                    ? 'bg-sky-500 border-sky-400'
                    : 'bg-slate-800 border-slate-700 active:bg-slate-700'
                }`}
                onPress={() => setAvatar(role)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Select avatar ${role}`}
                accessibilityState={{ selected: avatar === role }}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              >
                <Text
                  className={`text-sm font-bold ${
                    avatar === role ? 'text-slate-950' : 'text-slate-300'
                  }`}
                >
                  {role}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Switch Hook Control */}
        <View className="mb-8">
          <Text className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
            Select Hook Scenario
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <TouchableOpacity
              className={`py-2 px-4 rounded-full border ${
                activeHookId === 'volunteer_shortage'
                  ? 'bg-sky-500 border-sky-400'
                  : 'bg-slate-800 border-slate-700 active:bg-slate-700'
              }`}
              onPress={() => setActiveHookId('volunteer_shortage')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Select volunteer shortage scenario"
              accessibilityState={{ selected: activeHookId === 'volunteer_shortage' }}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <Text
                className={`text-sm font-bold ${
                  activeHookId === 'volunteer_shortage' ? 'text-slate-950' : 'text-slate-300'
                }`}
              >
                Volunteer Shortage
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`py-2 px-4 rounded-full border ${
                activeHookId === 'livestream_degradation'
                  ? 'bg-sky-500 border-sky-400'
                  : 'bg-slate-800 border-slate-700 active:bg-slate-700'
              }`}
              onPress={() => setActiveHookId('livestream_degradation')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Select livestream incident scenario"
              accessibilityState={{ selected: activeHookId === 'livestream_degradation' }}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <Text
                className={`text-sm font-bold ${
                  activeHookId === 'livestream_degradation' ? 'text-slate-950' : 'text-slate-300'
                }`}
              >
                Livestream Incident
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Projection Display */}
        <View className="mb-8">
          <Text className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
            VKG Projection Surface
          </Text>
          {projection && projection.visible ? (
            <View className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-sm">
              <View className="flex-row items-center mb-4">
                <View className="bg-sky-500/20 px-3 py-1 rounded-md border border-sky-500/30">
                  <Text className="text-sky-400 text-xs font-black tracking-widest">
                    {projection.surface.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text className="text-lg font-medium text-slate-100 mb-3 leading-6">
                {projection.payload?.message || 'Projection matches active role.'}
              </Text>
              {projection.payload && (
                <View className="bg-slate-950 rounded-xl p-4 mb-4 border border-slate-800">
                  <Text className="font-mono text-xs text-sky-300 leading-5">
                    {JSON.stringify(projection.payload, null, 2)}
                  </Text>
                </View>
              )}
              <View className="pt-4 border-t border-slate-700/50">
                <Text className="text-xs font-bold text-slate-400 mb-3">Allowed Actions:</Text>
                {projection.allowedActions.length > 0 ? (
                  <View className="flex-row flex-wrap gap-2">
                    {projection.allowedActions.map((act) => (
                      <View
                        key={act}
                        className="bg-emerald-500/20 px-3 py-1.5 rounded-lg border border-emerald-500/30 flex-row items-center"
                      >
                        <Ionicons name="flash" size={12} color="#34D399" className="mr-1" />
                        <Text className="text-emerald-400 text-xs font-bold">{act}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="text-slate-500 text-sm italic">
                    No actions permitted for this role.
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View className="bg-slate-800/50 rounded-2xl p-8 items-center border border-dashed border-slate-700">
              <Ionicons name="eye-off-outline" size={32} color="#64748B" className="mb-2" />
              <Text className="text-slate-500 text-sm font-semibold">
                [HIDDEN] No projection visible for guest avatar.
              </Text>
            </View>
          )}
        </View>

        {/* Metrics & Quarantine */}
        <View className="bg-slate-800 rounded-2xl p-5 border border-slate-700 mb-6 flex-row justify-between items-center shadow-sm">
          <View className="items-center flex-1">
            <Text className="text-slate-400 text-xs font-bold uppercase mb-1">Pending</Text>
            <Text className="text-amber-400 text-2xl font-black">{pendingReceipts}</Text>
          </View>
          <View className="w-px h-10 bg-slate-700" />
          <View className="items-center flex-1">
            <Text className="text-slate-400 text-xs font-bold uppercase mb-1">Confirmed</Text>
            <Text className="text-emerald-400 text-2xl font-black">{processedReceipts}</Text>
          </View>
        </View>

        {isQuarantined && (
          <View className="bg-rose-950/50 border border-rose-900 rounded-2xl p-5 mb-6 shadow-sm">
            <View className="flex-row items-center mb-2">
              <Ionicons name="warning" size={20} color="#F87171" className="mr-2" />
              <Text className="text-rose-400 text-base font-bold">HOOK QUARANTINED</Text>
            </View>
            <Text className="text-rose-200/70 text-sm mb-4 leading-5">
              A hook execution failed. Hook mailbox processing is paused.
            </Text>
            <TouchableOpacity
              className="bg-emerald-600 active:bg-emerald-700 py-4 px-4 rounded-xl flex-row justify-center items-center"
              onPress={repairLastQuarantine}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Trigger repair and replay"
            >
              <Ionicons name="build" size={16} color="white" className="mr-2" />
              <Text className="text-white font-bold text-sm">Trigger Repair & Replay</Text>
            </TouchableOpacity>
          </View>
        )}

        {pendingReceipts > 0 && (
          <View className="bg-amber-500/20 border border-amber-500/30 p-4 rounded-xl mb-6 flex-row items-center justify-center">
            <Ionicons name="sync" size={16} color="#FBBF24" className="mr-2 animate-spin" />
            <Text className="text-amber-400 font-bold text-sm">Processing optimistic sync...</Text>
          </View>
        )}

        {processedReceipts > 0 && pendingReceipts === 0 && !isQuarantined && (
          <View className="bg-emerald-500/20 border border-emerald-500/30 p-4 rounded-xl mb-6 flex-row items-center justify-center">
            <Ionicons name="checkmark-circle" size={18} color="#34D399" className="mr-2" />
            <Text className="text-emerald-400 font-bold text-sm">Evidence Reconciled ✅</Text>
          </View>
        )}

        {/* Command Triggers */}
        <View className="mb-8">
          {activeHookId === 'volunteer_shortage' ? (
            <TouchableOpacity
              className={`py-4 rounded-xl flex-row justify-center items-center shadow-sm ${
                isQuarantined ? 'bg-slate-700' : 'bg-sky-500 active:bg-sky-600'
              }`}
              disabled={isQuarantined}
              onPress={() => triggerHook('volunteer_123', 'volunteer_cancel', 'shift_abc')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Trigger Volunteer Cancellation"
              accessibilityState={{ disabled: isQuarantined }}
            >
              <Text
                className={`text-base font-bold ${isQuarantined ? 'text-slate-500' : 'text-slate-950'}`}
              >
                Trigger Volunteer Cancellation
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="gap-3">
              <TouchableOpacity
                className={`py-4 rounded-xl flex-row justify-center items-center shadow-sm ${
                  isQuarantined ? 'bg-slate-700' : 'bg-amber-600 active:bg-amber-700'
                }`}
                disabled={isQuarantined}
                onPress={() => triggerLivestream('degrade', 1200, 0.1)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Trigger Bitrate Degradation 1200kbps, 10% loss"
                accessibilityState={{ disabled: isQuarantined }}
              >
                <Text className="text-base font-bold text-white">
                  Trigger Bitrate Degradation (1200kbps, 10% loss)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`py-4 rounded-xl flex-row justify-center items-center shadow-sm ${
                  isQuarantined ? 'bg-slate-700' : 'bg-rose-600 active:bg-rose-700'
                }`}
                disabled={isQuarantined}
                onPress={() => triggerLivestream('escalate')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Escalate Incident High Priority"
                accessibilityState={{ disabled: isQuarantined }}
              >
                <Text className="text-base font-bold text-white">
                  Escalate Incident (High Priority)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`py-4 rounded-xl flex-row justify-center items-center shadow-sm ${
                  isQuarantined ? 'bg-slate-700' : 'bg-emerald-600 active:bg-emerald-700'
                }`}
                disabled={isQuarantined}
                onPress={() => triggerLivestream('resolve')}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Resolve Livestream Incident"
                accessibilityState={{ disabled: isQuarantined }}
              >
                <Text className="text-base font-bold text-white">Resolve Livestream Incident</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Audit Log / Receipt Details */}
        {lastReceipt && (
          <View className="mb-6">
            <Text className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
              Last Cryptographic Receipt
            </Text>
            <View className="bg-slate-800 rounded-xl p-4 border-l-4 border-l-sky-500 border border-slate-700">
              <Text className="font-mono text-xs text-sky-400 mb-2 truncate" numberOfLines={1}>
                Hash: {lastReceipt.receiptHash}
              </Text>
              <View className="flex-row items-center mb-1">
                <Text className="text-slate-500 text-xs font-semibold w-20">Status:</Text>
                <Text className="text-slate-300 text-xs">{lastReceipt.status}</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-slate-500 text-xs font-semibold w-20">Message ID:</Text>
                <Text className="text-slate-300 text-xs">{lastReceipt.messageId}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export { ErrorBoundary } from '@/src/components/ErrorBoundary';
