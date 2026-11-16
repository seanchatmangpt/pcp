import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Pressable, ScrollView } from 'react-native';
import { AlertManager as Alert } from '../../framework/ui/dialog/AlertManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminCard } from '../../components/admin/AdminCard';
import { useSession } from '../../../context/SessionProvider';
import { useActorOpsStore } from '@/src/lib/actor/actorOps';
import { mmkvInstance } from '../../lib/store/mmkvStorage';
import { Ionicons } from '@expo/vector-icons';
const Switch = ({ active, colorClass }: { active: boolean; colorClass: string }) => (
  <View
    className={`w-12 h-7 rounded-full p-1 justify-center ${active ? colorClass : 'bg-slate-700/80 border border-slate-600/50'}`}
  >
    <View
      className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${active ? 'translate-x-5' : 'translate-x-0'}`}
    />
  </View>
);

export default function AdminSettings() {
  const { session } = useSession();

  // Load developer-simulated settings from MMKV
  const [walMode, setWalMode] = useState(true);
  const [verboseLogs, setVerboseLogs] = useState(false);
  const [supervisionRestart, setSupervisionRestart] = useState(true);
  const [mmkvKeysCount, setMmkvKeysCount] = useState(0);

  // Sync state with Zustand store
  const networkOnline = useActorOpsStore((state) => state.networkOnline);
  const setNetworkOnline = useActorOpsStore((state) => state.setNetworkOnline);
  const remoteRejectActive = useActorOpsStore((state) => state.remoteRejectActive);
  const setRemoteRejectActive = useActorOpsStore((state) => state.setRemoteRejectActive);
  const packetDropRate = useActorOpsStore((state) => state.packetDropRate);
  const setPacketDropRate = useActorOpsStore((state) => state.setPacketDropRate);
  const cdcEventsCount = useActorOpsStore((state) => state.cdcEventsCount);
  const setCdcEventsCount = useActorOpsStore((state) => state.setCdcEventsCount);

  useEffect(() => {
    try {
      setWalMode(mmkvInstance.getBoolean('admin_sqlite_wal') !== false);
      setVerboseLogs(mmkvInstance.getBoolean('admin_verbose_logs') || false);
      setSupervisionRestart(mmkvInstance.getBoolean('admin_supervision_restart') !== false);
      setMmkvKeysCount(mmkvInstance.getAllKeys().length);
    } catch (e) {
      console.warn('Failed to load MMKV properties:', e);
    }
  }, []);

  const refreshMMKVKeyCount = () => {
    try {
      setMmkvKeysCount(mmkvInstance.getAllKeys().length);
    } catch (e) {
      console.warn(e);
    }
  };

  const toggleWalMode = () => {
    const next = !walMode;
    setWalMode(next);
    mmkvInstance.set('admin_sqlite_wal', next);
    refreshMMKVKeyCount();
  };

  const toggleVerboseLogs = () => {
    const next = !verboseLogs;
    setVerboseLogs(next);
    mmkvInstance.set('admin_verbose_logs', next);
    refreshMMKVKeyCount();
  };

  const toggleSupervisionRestart = () => {
    const next = !supervisionRestart;
    setSupervisionRestart(next);
    mmkvInstance.set('admin_supervision_restart', next);
    refreshMMKVKeyCount();
  };

  // Safe developer resets
  const handleClearMMKV = () => {
    Alert.alert(
      'Wipe MMKV Cache',
      'Are you sure you want to clear all MMKV keys? This deletes all client state and settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            try {
              mmkvInstance.clearAll();
              setMmkvKeysCount(0);
              Alert.alert('Success', 'MMKV Cache cleared.');
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Wipe failed');
            }
          },
        },
      ]
    );
  };

  const handleClearAsyncStorage = () => {
    Alert.alert(
      'Wipe AsyncStorage Cache',
      'Are you sure you want to clear all AsyncStorage keys? This deletes all traditional cache, session info, and indices.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('Success', 'AsyncStorage cache cleared.');
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Wipe failed');
            }
          },
        },
      ]
    );
  };

  const handleResetZustand = () => {
    console.log(
      'DEBUG handleResetZustand: setNetworkOnline is',
      setNetworkOnline,
      'isMock:',
      (setNetworkOnline as any)._isMockFunction || (setNetworkOnline as any).mock !== undefined
    );
    Alert.alert(
      'Reset Local Actor Ops Store',
      'Restores outboxes, queues, and sync parameters back to initial clean states.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Store',
          onPress: () => {
            try {
              setNetworkOnline(true);
              setRemoteRejectActive(false);
              useActorOpsStore.getState().setLatestReceipt(null);
              useActorOpsStore.getState().setLatestEvent(null);
              useActorOpsStore.getState().setCounts(0, 0);
              useActorOpsStore.getState().setPacketDropRate(0);
              useActorOpsStore.getState().setCdcEventsCount(0);
              Alert.alert('Success', 'Zustand operations store reset completed.');
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Reset failed');
            }
          },
        },
      ]
    );
  };

  const handleSeedSandboxData = () => {
    try {
      mmkvInstance.set('sandbox_seeded_at', new Date().toISOString());
      mmkvInstance.set('sandbox_tenant_ref', 'tenant-test-override-999');
      mmkvInstance.set('sandbox_sync_facade', 'Supabase Realtime CDC Facade');
      refreshMMKVKeyCount();
      Alert.alert('Success', 'Sandbox parameters seeded into MMKV store.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Seeding failed');
    }
  };

  return (
    <AdminShell
      title="System Settings"
      subtitle="Supervision Geometry parameters and configurations"
    >
      {/* SECTION 1: Authentication Context */}
      <AdminCard title="Authentication Context" subtitle="Active session properties">
        <View className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <View className="flex-row justify-between items-center p-3.5 border-b border-slate-700/50">
            <Text className="text-slate-400 text-sm font-medium">Principal User</Text>
            <Text className="text-slate-200 text-sm font-semibold">
              {session?.user?.email || 'N/A'}
            </Text>
          </View>
          <View className="flex-row justify-between items-center p-3.5 border-b border-slate-700/50">
            <Text className="text-slate-400 text-sm font-medium">User UUID</Text>
            <Text className="text-slate-300 text-xs font-mono">{session?.user?.id || 'N/A'}</Text>
          </View>
          <View className="flex-row justify-between items-center p-3.5">
            <Text className="text-slate-400 text-sm font-medium">Auth Confirmed</Text>
            <View
              className={`px-2.5 py-1 rounded-md ${session?.user?.email_confirmed_at ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}
            >
              <Text
                className={`text-xs font-bold ${session?.user?.email_confirmed_at ? 'text-emerald-500' : 'text-rose-500'}`}
              >
                {session?.user?.email_confirmed_at ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>
        </View>
      </AdminCard>

      {/* SECTION 2: Local Storage & Sync Engine */}
      <AdminCard
        title="Engine Configurations"
        subtitle="Zoe Multi-tenant Boundaries & Sync Settings"
      >
        <View className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <Pressable
            accessibilityRole="button"
            onPress={toggleWalMode}
            className="flex-row justify-between items-center p-4 border-b border-slate-700/50 active:bg-slate-700/30"
          >
            <View className="flex-1 pr-4">
              <Text className="text-slate-200 font-semibold text-sm">SQLite WAL Mode</Text>
              <Text className="text-slate-400 text-xs mt-1">
                Enable write-ahead logging database speedups
              </Text>
            </View>
            <Switch active={walMode} colorClass="bg-blue-500" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setNetworkOnline(!networkOnline)}
            className="flex-row justify-between items-center p-4 border-b border-slate-700/50 active:bg-slate-700/30"
          >
            <View className="flex-1 pr-4">
              <Text className="text-slate-200 font-semibold text-sm">Network Simulator</Text>
              <Text className="text-slate-400 text-xs mt-1">
                Simulate offline state for testing synchronization outbox
              </Text>
            </View>
            <Switch active={networkOnline} colorClass="bg-emerald-500" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setRemoteRejectActive(!remoteRejectActive)}
            className="flex-row justify-between items-center p-4 border-b border-slate-700/50 active:bg-slate-700/30"
          >
            <View className="flex-1 pr-4">
              <Text className="text-slate-200 font-semibold text-sm">Remote Rejections</Text>
              <Text className="text-slate-400 text-xs mt-1">
                Simulate conflicts by rejecting incoming server actions
              </Text>
            </View>
            <Switch active={remoteRejectActive} colorClass="bg-rose-500" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={toggleVerboseLogs}
            className="flex-row justify-between items-center p-4 border-b border-slate-700/50 active:bg-slate-700/30"
          >
            <View className="flex-1 pr-4">
              <Text className="text-slate-200 font-semibold text-sm">Verbose Sync Logging</Text>
              <Text className="text-slate-400 text-xs mt-1">
                Output sync logs to serial terminal
              </Text>
            </View>
            <Switch active={verboseLogs} colorClass="bg-purple-500" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={toggleSupervisionRestart}
            className="flex-row justify-between items-center p-4 active:bg-slate-700/30"
          >
            <View className="flex-1 pr-4">
              <Text className="text-slate-200 font-semibold text-sm">Supervision Auto-Restart</Text>
              <Text className="text-slate-400 text-xs mt-1">
                Restart syncing threads on driver crash events
              </Text>
            </View>
            <Switch active={supervisionRestart} colorClass="bg-blue-500" />
          </Pressable>
        </View>
      </AdminCard>

      {/* SECTION 2.5: Network Simulator & Telemetry Consequence Supervision */}
      <AdminCard
        title="Network Simulator Consequence Supervision"
        subtitle="Autonomic routing membrane & real-time telemetry"
      >
        <View className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 space-y-4">
          {/* Status Row */}
          <View className="flex-row justify-between items-center bg-slate-900/40 p-3 rounded-lg border border-slate-700/30">
            <View className="flex-row items-center space-x-2">
              <View
                className={`w-3.5 h-3.5 rounded-full ${networkOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}
                testID="network-status-indicator"
              />
              <Text className="text-slate-300 text-sm font-semibold">
                Network Link: {networkOnline ? 'Connected' : 'Offline'}
              </Text>
            </View>
            <View
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${networkOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}
            >
              {networkOnline ? 'ADMITTING' : 'TENSION_QUEUE'}
            </View>
          </View>

          {/* Packet Drop Rate Indicator */}
          <View className="space-y-2">
            <View className="flex-row justify-between items-center">
              <Text className="text-slate-300 text-xs font-semibold">
                Simulated Packet Drop Rate
              </Text>
              <Text className="text-slate-200 text-xs font-bold" testID="drop-rate-value">
                {packetDropRate}% (
                {packetDropRate === 0
                  ? 'Stable'
                  : packetDropRate <= 25
                    ? 'Low Loss'
                    : packetDropRate <= 50
                      ? 'Moderate Loss'
                      : packetDropRate <= 75
                        ? 'Heavy Loss'
                        : 'Blackout'}
                )
              </Text>
            </View>

            {/* Visual Bar Indicator */}
            <View className="h-2 w-full bg-slate-700/50 rounded-full overflow-hidden flex-row">
              <View
                style={{ width: `${packetDropRate}%` }}
                className={`h-full ${
                  packetDropRate <= 25
                    ? 'bg-amber-500'
                    : packetDropRate <= 50
                      ? 'bg-orange-500'
                      : 'bg-rose-500'
                }`}
                testID="packet-drop-bar"
              />
              <View
                style={{ width: `${100 - packetDropRate}%` }}
                className="h-full bg-emerald-500"
                testID="packet-success-bar"
              />
            </View>

            {/* Selector Buttons */}
            <View className="flex-row space-x-1.5 pt-1">
              {[0, 25, 50, 75, 100].map((rate) => (
                <TouchableOpacity
                  key={rate}
                  activeOpacity={0.7}
                  onPress={() => setPacketDropRate(rate)}
                  className={`flex-1 py-1.5 rounded-lg border items-center justify-center ${
                    packetDropRate === rate
                      ? 'bg-blue-600 border-blue-500'
                      : 'bg-slate-800/80 border-slate-700 active:bg-slate-700/80'
                  }`}
                  testID={`drop-rate-btn-${rate}`}
                >
                  <Text
                    className={`text-[10px] font-bold ${packetDropRate === rate ? 'text-white' : 'text-slate-400'}`}
                  >
                    {rate}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* CDC Pipeline Telemetry */}
          <View className="border-t border-slate-700/50 pt-3.5 space-y-3">
            <Text className="text-slate-300 text-xs font-semibold">
              Change Data Capture (CDC) Pipeline
            </Text>

            <View className="flex-row space-x-3">
              <View className="flex-1 bg-slate-900/40 p-3 rounded-lg border border-slate-700/30 justify-between">
                <Text className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">
                  CDC Stream
                </Text>
                <View className="flex-row items-center space-x-1.5 mt-1">
                  <View
                    className={`w-2 h-2 rounded-full ${networkOnline ? 'bg-emerald-400' : 'bg-slate-500'}`}
                    testID="cdc-stream-dot"
                  />
                  <Text className="text-slate-200 text-xs font-bold" testID="cdc-stream-status">
                    {networkOnline ? 'Subscribed' : 'Suspended'}
                  </Text>
                </View>
              </View>

              <View className="flex-1 bg-slate-900/40 p-3 rounded-lg border border-slate-700/30 justify-between">
                <Text className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">
                  Events Intake
                </Text>
                <Text
                  className="text-slate-200 text-sm font-mono font-bold mt-1"
                  testID="cdc-events-counter"
                >
                  {cdcEventsCount} evts
                </Text>
              </View>
            </View>

            {/* CDC Simulation controls */}
            <View className="flex-row space-x-2">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setCdcEventsCount(cdcEventsCount + 1)}
                className="flex-1 bg-slate-800/80 active:bg-slate-700/80 border border-slate-700 rounded-lg py-2 items-center justify-center flex-row space-x-1.5"
                testID="simulate-cdc-btn"
              >
                <Ionicons name="pulse" size={12} color="#60A5FA" style={{ marginRight: 4 }} />
                <Text className="text-slate-200 text-xs font-bold">Simulate CDC Event</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setCdcEventsCount(0)}
                className="bg-slate-800/80 active:bg-slate-700/80 border border-slate-700 rounded-lg px-3 py-2 items-center justify-center"
                testID="reset-cdc-btn"
              >
                <Ionicons name="trash-outline" size={12} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </AdminCard>

      {/* SECTION 3: Diagnostic Reset Actions */}
      <AdminCard
        title="Diagnostics Console & Resets"
        subtitle="Direct memory modifications & debug tools"
      >
        <View className="flex-row justify-between items-center bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50 mb-4">
          <View className="flex-row items-center space-x-2">
            <Ionicons name="server-outline" size={16} color="#94A3B8" />
            <Text className="text-slate-300 text-sm font-semibold">MMKV Storage Keys</Text>
          </View>
          <View className="bg-blue-500/20 px-3 py-1 rounded-md border border-blue-500/30">
            <Text className="text-xs font-bold text-blue-400">{mmkvKeysCount}</Text>
          </View>
        </View>

        <View className="space-y-3">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleSeedSandboxData}
            className="w-full bg-slate-800/80 active:bg-slate-700/80 border border-slate-700 rounded-xl py-3.5 px-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center space-x-3">
              <View className="w-8 h-8 rounded-full bg-blue-500/10 items-center justify-center">
                <Ionicons name="flask-outline" size={16} color="#60A5FA" />
              </View>
              <Text className="text-slate-200 font-semibold text-sm">Seed Sandbox Parameters</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleResetZustand}
            className="w-full bg-slate-800/80 active:bg-slate-700/80 border border-slate-700 rounded-xl py-3.5 px-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center space-x-3">
              <View className="w-8 h-8 rounded-full bg-purple-500/10 items-center justify-center">
                <Ionicons name="refresh-outline" size={16} color="#A78BFA" />
              </View>
              <Text className="text-slate-200 font-semibold text-sm">
                Reset Local Zustand Stores
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleClearAsyncStorage}
            className="w-full bg-slate-800/80 active:bg-slate-700/80 border border-slate-700 rounded-xl py-3.5 px-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center space-x-3">
              <View className="w-8 h-8 rounded-full bg-orange-500/10 items-center justify-center">
                <Ionicons name="trash-bin-outline" size={16} color="#FB923C" />
              </View>
              <Text className="text-slate-200 font-semibold text-sm">Wipe AsyncStorage Cache</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleClearMMKV}
            className="w-full bg-rose-500/10 active:bg-rose-500/20 border border-rose-500/30 rounded-xl py-3.5 px-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center space-x-3">
              <View className="w-8 h-8 rounded-full bg-rose-500/20 items-center justify-center">
                <Ionicons name="warning-outline" size={16} color="#F43F5E" />
              </View>
              <Text className="text-rose-400 font-bold text-sm">Wipe MMKV Cache Storage</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#F43F5E" />
          </TouchableOpacity>
        </View>
      </AdminCard>
    </AdminShell>
  );
}
