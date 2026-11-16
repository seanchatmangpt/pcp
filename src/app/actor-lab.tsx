import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AlertManager as Alert } from '../../framework/ui/dialog/AlertManager';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminCard } from '../../components/admin/AdminCard';
import { CommandButton } from '../../components/admin/CommandButton';
import { ReceiptBadge } from '../../components/admin/ReceiptBadge';
import {
  useActorOpsStore,
  setNetworkOffline,
  setRemoteRejectionMocked,
  setCurrentPrincipal,
  globalLocalDispatcher,
  globalRemoteDispatcher,
  globalVkgClient,
} from '@/src/lib/actor/actorOps';
import { DataFactory } from '../../lib/vkg/rdf';
import { db } from '../../lib/db/db';
import { actorOutbox, actorQuarantine } from '../../lib/db/schema';
import { count } from 'drizzle-orm';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useHaptics } from '../../framework/ui/haptics/useHaptics';
import { HapticFeedbackPattern } from '../../framework/ui/haptics/IntelligentHaptics';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  category: 'SYSTEM' | 'TRANSACTION' | 'SYNC' | 'NETWORK';
  message: string;
}

interface ConnectorProps {
  status: 'active' | 'inactive' | 'error' | 'syncing';
  label?: string;
}

function Connector({ status, label }: ConnectorProps) {
  let lineColor = 'rgba(255, 255, 255, 0.2)';
  let lineStyle: 'solid' | 'dashed' = 'solid';
  if (status === 'active') {
    lineColor = '#34D399'; // Emerald 400
  } else if (status === 'error') {
    lineColor = '#F87171'; // Red 400
    lineStyle = 'dashed';
  } else if (status === 'syncing') {
    lineColor = '#60A5FA'; // Blue 400
  }

  return (
    <View style={styles.connectorContainer}>
      <View
        style={[styles.connectorLine, { borderColor: lineColor, borderStyle: lineStyle }]}
        testID={`connector-${status}`}
      />
      {label && (
        <View
          style={[
            styles.connectorLabelBg,
            {
              backgroundColor:
                status === 'error'
                  ? 'rgba(239, 68, 68, 0.2)'
                  : status === 'syncing'
                    ? 'rgba(59, 130, 246, 0.2)'
                    : 'rgba(16, 185, 129, 0.2)',
            },
          ]}
        >
          <Text style={[styles.connectorLabelText, { color: lineColor }]}>{label}</Text>
        </View>
      )}
      <View style={styles.connectorArrowContainer}>
        <FontAwesome name="chevron-down" size={10} color={lineColor} />
      </View>
    </View>
  );
}

interface SimulationNodeProps {
  icon: string;
  title: string;
  subtitle: string;
  statusColor: string;
  statusText: string;
  badgeText?: string;
}

function SimulationNode({
  icon,
  title,
  subtitle,
  statusColor,
  statusText,
  badgeText,
}: SimulationNodeProps) {
  return (
    <View style={[styles.nodeCard, { borderColor: statusColor + '50' }]}>
      <View style={[styles.nodeIconBg, { backgroundColor: statusColor + '20' }]}>
        <FontAwesome name={icon as any} size={18} color={statusColor} />
      </View>
      <View style={styles.nodeInfo}>
        <Text style={styles.nodeTitle}>{title}</Text>
        <Text style={styles.nodeSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.nodeStatusContainer}>
        {badgeText && (
          <View
            style={[
              styles.nodeBadge,
              { backgroundColor: statusColor + '25', borderColor: statusColor + '50' },
            ]}
          >
            <Text style={[styles.nodeBadgeText, { color: statusColor }]}>{badgeText}</Text>
          </View>
        )}
        <Text style={[styles.nodeStatusText, { color: statusColor }]}>{statusText}</Text>
      </View>
    </View>
  );
}

export default function ActorLab() {
  const haptics = useHaptics();
  const {
    networkOnline,
    remoteRejectActive,
    currentPrincipal,
    latestReceipt,
    latestEvent,
    outboxCount,
    quarantineCount,
    setCounts,
    setNetworkOnline,
    setRemoteRejectActive,
  } = useActorOpsStore();

  const [sermonTitles, setSermonTitles] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [simState, setSimState] = useState<'stopped' | 'running' | 'paused'>('stopped');
  const [levelFilter, setLevelFilter] = useState<'ALL' | LogEntry['level']>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | LogEntry['category']>('ALL');

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init',
      timestamp: new Date().toLocaleTimeString(),
      level: 'INFO',
      category: 'SYSTEM',
      message: 'Actor Lab digital twin simulation initialized.',
    },
    {
      id: 'session',
      timestamp: new Date().toLocaleTimeString(),
      level: 'SUCCESS',
      category: 'TRANSACTION',
      message: 'Identity session established for Principal Role: admin',
    },
    {
      id: 'net-init',
      timestamp: new Date().toLocaleTimeString(),
      level: 'INFO',
      category: 'NETWORK',
      message: 'Simulated network interface configured: ONLINE',
    },
  ]);

  const addLog = (level: LogEntry['level'], category: LogEntry['category'], message: string) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      level,
      category,
      message,
    };
    setLogs((prev) => [newLog, ...prev].slice(0, 100));
  };

  const prevReceipt = useRef<typeof latestReceipt>(null);
  const prevEvent = useRef<typeof latestEvent>(null);

  // Monitor store for new transaction receipts and events to log them automatically
  useEffect(() => {
    if (latestReceipt && latestReceipt !== prevReceipt.current) {
      const isErr = latestReceipt.status.includes('rejected') || !!latestReceipt.error;
      const msg = `Transaction Receipt: status=${latestReceipt.status}${
        latestReceipt.error ? `, error=${latestReceipt.error}` : ''
      }, commandId=${latestReceipt.commandId.substring(0, 8)}...`;
      addLog(isErr ? 'ERROR' : 'SUCCESS', 'TRANSACTION', msg);
      prevReceipt.current = latestReceipt;
    }
  }, [latestReceipt]);

  useEffect(() => {
    if (latestEvent && latestEvent !== prevEvent.current) {
      addLog('SUCCESS', 'SYSTEM', `Event Emitted: ${latestEvent}`);
      prevEvent.current = latestEvent;
    }
  }, [latestEvent]);

  const refreshState = async () => {
    try {
      // Refresh DB metrics
      const outboxRes = await db.select({ value: count() }).from(actorOutbox);
      const quarantineRes = await db.select({ value: count() }).from(actorQuarantine);
      setCounts(outboxRes[0]?.value || 0, quarantineRes[0]?.value || 0);

      // Query the local VKG for sermon names
      const namePredicate = DataFactory.namedNode('https://schema.org/name');
      const quadsList = await globalVkgClient.match(undefined, namePredicate, undefined);
      const titles = quadsList.map((q) => q.object.value);
      setSermonTitles(titles);
    } catch (e) {
      console.error('Failed to load metrics:', e);
    }
  };

  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleNetwork = (online: boolean) => {
    setNetworkOffline(!online);
    addLog(
      'INFO',
      'NETWORK',
      `Simulated network status updated to: ${online ? 'ONLINE' : 'OFFLINE'}`
    );
  };

  const toggleRemoteRejection = (active: boolean) => {
    setRemoteRejectionMocked(active);
    addLog(
      'WARNING',
      'SYSTEM',
      `Remote Authority Mock Rejection switched to: ${active ? 'ENABLED (MOCK ON)' : 'DISABLED (MOCK OFF)'}`
    );
  };

  const handleRoleChange = (role: 'admin' | 'pastor' | 'member' | 'guest') => {
    setCurrentPrincipal({
      id: `usr_${role}`,
      role: role,
    });
    addLog(
      'INFO',
      'TRANSACTION',
      `Identity session overridden. Principal switched to role: ${role}`
    );
  };

  const triggerSync = async () => {
    setSyncing(true);
    addLog('INFO', 'SYNC', 'Manual outbox sync initiated. Commencing queue replay...');
    try {
      await globalLocalDispatcher.syncOutbox(globalRemoteDispatcher);
      addLog('SUCCESS', 'SYNC', 'Manual sync process completed successfully.');
      Alert.alert('Outbox Sync', 'Synchronization completed.');
    } catch (err: any) {
      console.error(err);
      addLog('ERROR', 'SYNC', `Manual sync aborted due to error: ${err.message}`);
      Alert.alert('Outbox Sync Error', err.message);
    } finally {
      setSyncing(false);
      refreshState();
    }
  };

  // Maps the dispatcher error reason to the exact codes required by Maestro assertions
  const getErrorCode = () => {
    if (!latestReceipt || !latestReceipt.error) return 'None';
    const err = latestReceipt.error;
    if (err.includes('AuthorizationError')) {
      return 'AUTHZ_DENIED';
    }
    if (err.includes('ValidationError')) {
      if (latestReceipt.status === 'rejected_local') {
        return 'INPUT_INVALID';
      }
      return 'REMOTE_AUTHORITY_REJECTED';
    }
    return 'EXECUTION_FAILED';
  };

  // Simulation daemon control functions
  const startSimulation = () => {
    haptics.trigger(HapticFeedbackPattern.MEDIUM);
    setSimState('running');
    addLog('SUCCESS', 'SYSTEM', 'Simulation daemon STARTED. Automated state replication active.');
  };

  const pauseSimulation = () => {
    haptics.trigger(HapticFeedbackPattern.MEDIUM);
    setSimState('paused');
    addLog('WARNING', 'SYSTEM', 'Simulation daemon PAUSED. Replication loops halted.');
  };

  const restartSimulation = async () => {
    haptics.trigger(HapticFeedbackPattern.MEDIUM);
    setSimState('stopped');
    toggleNetwork(true);
    toggleRemoteRejection(false);
    handleRoleChange('admin');
    await refreshState();
    setLogs([
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        level: 'SUCCESS',
        category: 'SYSTEM',
        message: 'Simulation daemon RESTARTED. Runtime parameters reset to default.',
      },
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        level: 'INFO',
        category: 'NETWORK',
        message: 'Simulated network status: ONLINE',
      },
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        level: 'INFO',
        category: 'TRANSACTION',
        message: 'Principal identity override reset: usr_admin',
      },
    ]);
  };

  // Simulation background daemon tick effect
  useEffect(() => {
    if (simState !== 'running') return;

    const interval = setInterval(async () => {
      addLog(
        'INFO',
        'SYSTEM',
        `Heartbeat tick. Outbox: ${outboxCount}, network is ${networkOnline ? 'ONLINE' : 'OFFLINE'}.`
      );

      if (outboxCount > 0) {
        if (networkOnline) {
          addLog(
            'INFO',
            'SYNC',
            `Found ${outboxCount} unsynced items. Commencing auto-synchronization replay...`
          );
          try {
            await globalLocalDispatcher.syncOutbox(globalRemoteDispatcher);
            addLog(
              'SUCCESS',
              'SYNC',
              'Auto-sync task completed. Replayed items committed to server authority.'
            );
            await refreshState();
          } catch (err: any) {
            addLog('ERROR', 'SYNC', `Auto-sync failed: ${err.message}`);
            await refreshState();
          }
        } else {
          addLog(
            'WARNING',
            'SYNC',
            `Outbox contains ${outboxCount} items, but sync is deferred due to network DISCONNECTION.`
          );
        }
      } else {
        const telemetryChecks = [
          'Memory footprint: stable.',
          'Virtual Knowledge Graph node density: verified.',
          'Local DB transaction logs flushed.',
          'Pre-Admission Tension Queue idle.',
        ];
        const randomCheck = telemetryChecks[Math.floor(Math.random() * telemetryChecks.length)];
        addLog('INFO', 'SYSTEM', `Telemetry verification: ${randomCheck}`);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [simState, outboxCount, networkOnline]);

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = levelFilter === 'ALL' || log.level === levelFilter;
    const matchesCategory = categoryFilter === 'ALL' || log.category === categoryFilter;
    return matchesLevel && matchesCategory;
  });

  return (
    <AdminShell
      title="Developer Actor Lab"
      subtitle="Deterministic runtime testbench for execution trust"
      scrollable={false}
    >
      {/* Target status ready token for Maestro boot verification */}
      <View testID="actor-runtime-ready" style={styles.statusBar}>
        <View style={styles.dotGreen} />
        <Text style={styles.statusText}>Actor Runtime Engine: Active & Ready</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Digital Twin Simulation Topology View */}
        <AdminCard
          title="Digital Twin Simulation Topology"
          subtitle="Real-time transactional flow & schema replication mapping"
        >
          <View style={styles.topologyContainer}>
            {/* Node 1: User Client Actor */}
            <SimulationNode
              icon="user"
              title="Client Actor"
              subtitle={`Principal: ${currentPrincipal.role}`}
              statusColor={currentPrincipal.role === 'guest' ? '#94A3B8' : '#3B82F6'}
              statusText={currentPrincipal.role.toUpperCase()}
              badgeText="INITIATOR"
            />

            <Connector status="active" label="LOCAL PATH" />

            {/* Node 2: Local DB / Outbox */}
            <SimulationNode
              icon="database"
              title="Local Storage & Outbox"
              subtitle="Offline Journal & Outbox"
              statusColor={
                quarantineCount > 0 ? '#EF4444' : outboxCount > 0 ? '#F59E0B' : '#10B981'
              }
              statusText={
                quarantineCount > 0 ? 'QUARANTINE' : outboxCount > 0 ? 'PENDING' : 'SYNCED'
              }
              badgeText={`${outboxCount} Outbox | ${quarantineCount} Quar`}
            />

            <Connector
              status={!networkOnline ? 'error' : syncing ? 'syncing' : 'active'}
              label={!networkOnline ? 'OFFLINE TUNNEL' : syncing ? 'SYNC ACTIVE' : 'READY'}
            />

            {/* Node 3: Simulated Gateway */}
            <SimulationNode
              icon={networkOnline ? 'wifi' : 'ban'}
              title="Simulated Gateway"
              subtitle={networkOnline ? 'Network online & routing' : 'Network offline & deferred'}
              statusColor={networkOnline ? '#10B981' : '#EF4444'}
              statusText={networkOnline ? 'ONLINE' : 'OFFLINE'}
            />

            <Connector
              status={!networkOnline ? 'error' : 'active'}
              label={!networkOnline ? 'BLOCKED' : 'READY'}
            />

            {/* Node 4: Remote Dispatcher */}
            <SimulationNode
              icon="server"
              title="Remote Server Authority"
              subtitle={remoteRejectActive ? 'Mock failure active' : 'Relaying transactions'}
              statusColor={remoteRejectActive ? '#EF4444' : '#10B981'}
              statusText={remoteRejectActive ? 'REJECTING' : 'HEALTHY'}
            />

            <Connector
              status={remoteRejectActive ? 'error' : 'active'}
              label={remoteRejectActive ? 'REJECTED' : 'COMMITTED'}
            />

            {/* Node 5: Authoritative VKG */}
            <SimulationNode
              icon="cloud"
              title="VKG Authoritative Store"
              subtitle={`${sermonTitles.length} Sermon Triple(s)`}
              statusColor="#10B981"
              statusText="ACTIVE"
            />
          </View>
        </AdminCard>

        {/* 2. Simulation Daemon Controller */}
        <AdminCard
          title="Simulation Daemon Controller"
          subtitle="Manage background virtual twin traffic & replication loops"
        >
          <View style={styles.simStatusContainer}>
            <Text style={styles.simStatusLabel}>Daemon Status:</Text>
            <View
              style={[
                styles.simStatusBadge,
                simState === 'running'
                  ? styles.badgeRunning
                  : simState === 'paused'
                    ? styles.badgePaused
                    : styles.badgeStopped,
              ]}
            >
              <Text
                style={[
                  styles.simStatusText,
                  simState === 'running'
                    ? styles.textRunning
                    : simState === 'paused'
                      ? styles.textPaused
                      : styles.textStopped,
                ]}
              >
                {simState.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btnThird, simState === 'running' && styles.btnActiveGreen]}
              onPress={startSimulation}
              activeOpacity={0.7}
            >
              <FontAwesome
                name="play"
                size={14}
                color={simState === 'running' ? '#F8FAFC' : '#94A3B8'}
                style={styles.btnIcon}
              />
              <Text style={[styles.btnText, simState === 'running' && styles.btnTextActive]}>
                START
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnThird, simState === 'paused' && styles.btnActiveYellow]}
              onPress={pauseSimulation}
              activeOpacity={0.7}
            >
              <FontAwesome
                name="pause"
                size={14}
                color={simState === 'paused' ? '#F8FAFC' : '#94A3B8'}
                style={styles.btnIcon}
              />
              <Text style={[styles.btnText, simState === 'paused' && styles.btnTextActive]}>
                PAUSE
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              style={styles.btnThird}
              onPress={restartSimulation}
              activeOpacity={0.7}
            >
              <FontAwesome name="refresh" size={14} color="#94A3B8" style={styles.btnIcon} />
              <Text style={styles.btnText}>RESTART</Text>
            </TouchableOpacity>
          </View>
        </AdminCard>

        {/* 3. Network Simulation Controls */}
        <AdminCard
          title="Network Connectivity Simulation"
          subtitle="Toggle device simulated network connectivity"
        >
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btnHalf, networkOnline && styles.btnActiveGreen]}
              onPress={() => toggleNetwork(true)}
              testID="mock-network-on"
              activeOpacity={0.7}
            >
              <FontAwesome
                name="wifi"
                size={16}
                color={networkOnline ? '#F8FAFC' : '#94A3B8'}
                style={styles.btnIcon}
              />
              <Text style={[styles.btnText, networkOnline && styles.btnTextActive]}>ONLINE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnHalf, !networkOnline && styles.btnActiveRed]}
              onPress={() => toggleNetwork(false)}
              testID="mock-network-off"
              activeOpacity={0.7}
            >
              <FontAwesome
                name="ban"
                size={16}
                color={!networkOnline ? '#F8FAFC' : '#94A3B8'}
                style={styles.btnIcon}
              />
              <Text style={[styles.btnText, !networkOnline && styles.btnTextActive]}>OFFLINE</Text>
            </TouchableOpacity>
          </View>
        </AdminCard>

        {/* 4. Authority Simulation Controls */}
        <AdminCard
          title="Remote Authority Mock Rejection"
          subtitle="Force authoritative server transaction failure"
        >
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btnHalf, remoteRejectActive && styles.btnActiveRed]}
              onPress={() => toggleRemoteRejection(true)}
              testID="mock-remote-reject-on"
              activeOpacity={0.7}
            >
              <FontAwesome
                name="times"
                size={16}
                color={remoteRejectActive ? '#F8FAFC' : '#94A3B8'}
                style={styles.btnIcon}
              />
              <Text style={[styles.btnText, remoteRejectActive && styles.btnTextActive]}>
                MOCK ON
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnHalf, !remoteRejectActive && styles.btnActiveGreen]}
              onPress={() => toggleRemoteRejection(false)}
              testID="mock-remote-reject-off"
              activeOpacity={0.7}
            >
              <FontAwesome
                name="check"
                size={16}
                color={!remoteRejectActive ? '#F8FAFC' : '#94A3B8'}
                style={styles.btnIcon}
              />
              <Text style={[styles.btnText, !remoteRejectActive && styles.btnTextActive]}>
                MOCK OFF
              </Text>
            </TouchableOpacity>
          </View>
        </AdminCard>

        {/* 5. Principal Role Overrides */}
        <AdminCard
          title="Principal Role Simulation Override"
          subtitle="Simulate command execution as guest, member, or pastor"
        >
          <View style={styles.btnGroupRow}>
            {(['guest', 'member', 'pastor', 'admin'] as const).map((role) => {
              const active = currentPrincipal.role === role;
              return (
                <TouchableOpacity
                  key={role}
                  style={[styles.btnQuarter, active && styles.btnActiveBlue]}
                  onPress={() => handleRoleChange(role)}
                  testID={`principal-role-picker-${role}`}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.roleText, active && styles.roleTextActive]}>{role}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </AdminCard>

        {/* 6. Trigger Sync Action */}
        <AdminCard
          title="Trigger Outbox Sync Replay"
          subtitle="Manually push Pre-Admission Tension Queue items up to Server Authority"
        >
          <CommandButton
            title={syncing ? 'Synchronizing...' : 'Sync Outbox Now'}
            onPress={triggerSync}
            disabled={syncing}
            testID="sync-outbox-now"
            style={styles.syncBtn}
          />
        </AdminCard>

        {/* 7. Metrics & Status Outputs */}
        <AdminCard title="Runtime Metric Monitor" subtitle="Reactive execution logs state">
          <View style={styles.metricCardBox}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Local Outbox Size</Text>
              <Text style={styles.metricValMono} testID="outbox-count">
                {outboxCount}
              </Text>
            </View>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Quarantined Count</Text>
              <Text style={styles.metricValMono} testID="quarantine-count">
                {quarantineCount}
              </Text>
            </View>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Latest Receipt</Text>
              <ReceiptBadge
                status={latestReceipt?.status || 'accepted_pending'}
                testID="receipt-status"
              />
            </View>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Latest Event Emitted</Text>
              <Text style={styles.metricVal} testID="latest-event-type">
                {latestEvent || 'None'}
              </Text>
            </View>

            <View
              style={[
                styles.metricRow,
                { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 },
              ]}
            >
              <Text style={styles.metricLabel}>Error Code Label</Text>
              <Text style={[styles.metricVal, styles.errorText]} testID="latest-error-code">
                {getErrorCode()}
              </Text>
            </View>
          </View>
        </AdminCard>

        {/* 8. Virtual Knowledge Graph Projection View */}
        <AdminCard
          title="VKG Semantic Sermon Projection"
          subtitle="Rendered schema:name properties present in standard triple store"
        >
          <View style={styles.metricCardBox}>
            {sermonTitles.length > 0 ? (
              sermonTitles.map((titleStr, idx) => (
                <View key={`${titleStr}-${idx}`} style={styles.sermonRow}>
                  <FontAwesome
                    name="check-circle"
                    size={16}
                    color="#34D399"
                    style={styles.checkIcon}
                  />
                  <Text style={styles.sermonTitleText} testID="sermon-title-rendered">
                    {titleStr}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyProjectionText}>
                Virtual Knowledge Graph contains 0 sermon name quads.
              </Text>
            )}
          </View>
        </AdminCard>

        {/* 9. Interactive Log Terminal */}
        <AdminCard
          title="Interactive Log Terminal"
          subtitle="Filtered live feed of execution path mutations & mock transactions"
        >
          {/* Filters */}
          <View style={styles.logFiltersContainer}>
            <Text style={styles.filterTitle}>Filter Level:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              {(['ALL', 'INFO', 'SUCCESS', 'WARNING', 'ERROR'] as const).map((lvl) => {
                const active = levelFilter === lvl;
                const colorMap = {
                  ALL: '#94A3B8',
                  INFO: '#60A5FA',
                  SUCCESS: '#34D399',
                  WARNING: '#FBBF24',
                  ERROR: '#F87171',
                };
                const activeBgMap = {
                  ALL: 'rgba(148, 163, 184, 0.15)',
                  INFO: 'rgba(59, 130, 246, 0.15)',
                  SUCCESS: 'rgba(16, 185, 129, 0.15)',
                  WARNING: 'rgba(245, 158, 11, 0.15)',
                  ERROR: 'rgba(239, 68, 68, 0.15)',
                };
                return (
                  <TouchableOpacity
                    key={lvl}
                    style={[
                      styles.filterBadge,
                      active && { backgroundColor: activeBgMap[lvl], borderColor: colorMap[lvl] },
                    ]}
                    onPress={() => setLevelFilter(lvl)}
                    testID={`filter-level-${lvl}`}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterBadgeText,
                        { color: active ? colorMap[lvl] : '#64748B' },
                      ]}
                    >
                      {lvl}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.logFiltersContainer}>
            <Text style={styles.filterTitle}>Filter Category:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              {(['ALL', 'SYSTEM', 'TRANSACTION', 'SYNC', 'NETWORK'] as const).map((cat) => {
                const active = categoryFilter === cat;
                const colorMap = {
                  ALL: '#94A3B8',
                  SYSTEM: '#C084FC',
                  TRANSACTION: '#818CF8',
                  SYNC: '#22D3EE',
                  NETWORK: '#FB923C',
                };
                const activeBgMap = {
                  ALL: 'rgba(148, 163, 184, 0.15)',
                  SYSTEM: 'rgba(167, 139, 250, 0.15)',
                  TRANSACTION: 'rgba(129, 140, 248, 0.15)',
                  SYNC: 'rgba(34, 211, 238, 0.15)',
                  NETWORK: 'rgba(251, 146, 60, 0.15)',
                };
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.filterBadge,
                      active && { backgroundColor: activeBgMap[cat], borderColor: colorMap[cat] },
                    ]}
                    onPress={() => setCategoryFilter(cat)}
                    testID={`filter-category-${cat}`}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterBadgeText,
                        { color: active ? colorMap[cat] : '#64748B' },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Log Box */}
          <View style={styles.terminalBox}>
            <ScrollView style={styles.terminalScroll} nestedScrollEnabled={true}>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  let lvlColor = '#94A3B8';
                  if (log.level === 'INFO') lvlColor = '#60A5FA';
                  else if (log.level === 'SUCCESS') lvlColor = '#34D399';
                  else if (log.level === 'WARNING') lvlColor = '#FBBF24';
                  else if (log.level === 'ERROR') lvlColor = '#F87171';

                  let catColor = '#C084FC';
                  if (log.category === 'SYSTEM') catColor = '#C084FC';
                  else if (log.category === 'TRANSACTION') catColor = '#818CF8';
                  else if (log.category === 'SYNC') catColor = '#22D3EE';
                  else if (log.category === 'NETWORK') catColor = '#FB923C';

                  return (
                    <View key={log.id} style={styles.logRow}>
                      <Text style={styles.logTime}>{log.timestamp}</Text>
                      <Text style={[styles.logLevel, { color: lvlColor }]}>[{log.level}]</Text>
                      <Text style={[styles.logCategory, { color: catColor }]}>#{log.category}</Text>
                      <Text style={styles.logMessage}>{log.message}</Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyLogsText}>No logs match the current filters.</Text>
              )}
            </ScrollView>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            style={styles.clearLogsBtn}
            onPress={() => setLogs([])}
            testID="clear-logs"
            activeOpacity={0.7}
          >
            <FontAwesome name="trash" size={14} color="#94A3B8" style={{ marginRight: 6 }} />
            <Text style={styles.clearLogsText}>Clear Terminal Logs</Text>
          </TouchableOpacity>
        </AdminCard>
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
    marginRight: 10,
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  statusText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -6,
  },
  btnHalf: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    marginHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnThird: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    marginHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActiveGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  btnActiveRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  btnActiveBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  btnActiveYellow: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  btnIcon: {
    marginRight: 8,
  },
  btnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  btnTextActive: {
    color: '#F8FAFC',
  },
  btnGroupRow: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  btnQuarter: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'capitalize',
  },
  roleTextActive: {
    color: '#F8FAFC',
    fontWeight: 'bold',
  },
  syncBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    height: 48,
  },
  metricCardBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 14,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 10,
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  metricVal: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  metricValMono: {
    fontFamily: 'SpaceMono',
    fontSize: 14,
    color: '#F8FAFC',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  errorText: {
    color: '#F87171',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  sermonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  checkIcon: {
    marginRight: 10,
  },
  sermonTitleText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyProjectionText: {
    color: '#64748B',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  // New Digital Twin styles
  topologyContainer: {
    marginVertical: 6,
  },
  nodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  nodeIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  nodeInfo: {
    flex: 1,
  },
  nodeTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  nodeSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  nodeStatusContainer: {
    alignItems: 'flex-end',
  },
  nodeBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  nodeBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  nodeStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  connectorContainer: {
    alignItems: 'center',
    marginVertical: 4,
    height: 32,
    justifyContent: 'center',
  },
  connectorLine: {
    height: 32,
    width: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    position: 'absolute',
  },
  connectorLabelBg: {
    position: 'absolute',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 10,
  },
  connectorLabelText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  connectorArrowContainer: {
    position: 'absolute',
    bottom: -4,
    zIndex: 5,
  },
  // Simulation control styles
  simStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  simStatusLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  simStatusBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  simStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeRunning: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#34D399',
  },
  badgePaused: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#FBBF24',
  },
  badgeStopped: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#F87171',
  },
  textRunning: {
    color: '#34D399',
  },
  textPaused: {
    color: '#FBBF24',
  },
  textStopped: {
    color: '#F87171',
  },
  // Log terminal styles
  logFiltersContainer: {
    marginBottom: 12,
  },
  filterTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  filterScroll: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  filterBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  terminalBox: {
    backgroundColor: '#020617', // Slate 950
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    height: 220,
    padding: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  terminalScroll: {
    flex: 1,
  },
  logRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
    alignItems: 'flex-start',
  },
  logTime: {
    color: '#64748B',
    fontFamily: 'SpaceMono',
    fontSize: 10,
    marginRight: 6,
    marginTop: 2,
  },
  logLevel: {
    fontFamily: 'SpaceMono',
    fontSize: 10,
    fontWeight: 'bold',
    marginRight: 6,
    marginTop: 2,
  },
  logCategory: {
    fontFamily: 'SpaceMono',
    fontSize: 10,
    fontWeight: 'bold',
    marginRight: 6,
    marginTop: 2,
  },
  logMessage: {
    color: '#E2E8F0',
    fontFamily: 'SpaceMono',
    fontSize: 11,
    flex: 1,
    minWidth: 180,
    lineHeight: 16,
  },
  emptyLogsText: {
    color: '#475569',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 80,
    fontSize: 12,
  },
  clearLogsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  clearLogsText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
});

export { ErrorBoundary } from '@/src/components/ErrorBoundary';
