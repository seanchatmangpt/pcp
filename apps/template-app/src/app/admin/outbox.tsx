import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { AlertManager as Alert } from '../../framework/ui/dialog/AlertManager';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminCard } from '../../components/admin/AdminCard';
import { OutboxBadge } from '../../components/admin/OutboxBadge';
import { CommandButton } from '../../components/admin/CommandButton';
import { db } from '../../lib/db/db';
import { actorOutbox, actorQuarantine } from '../../lib/db/schema';
import { desc } from 'drizzle-orm';
import {
  globalLocalDispatcher,
  globalRemoteDispatcher,
  useActorOpsStore,
} from '@/src/lib/actor/actorOps';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export function formatTimestamp(date: Date | any): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return 'N/A';
  }
  const pad = (num: number) => String(num).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

interface CodePayloadProps {
  data: any;
  title: string;
}

export function CodePayload({ data, title }: CodePayloadProps) {
  const [collapsed, setCollapsed] = useState(true);
  let formattedJson = '';
  try {
    const obj = typeof data === 'string' ? JSON.parse(data) : data;
    formattedJson = JSON.stringify(obj, null, 2);
  } catch (e) {
    formattedJson = String(data);
  }

  return (
    <View style={styles.codeContainer} testID="code-payload">
      <TouchableOpacity
        style={styles.codeHeader}
        onPress={() => setCollapsed(!collapsed)}
        activeOpacity={0.7}
      >
        <View style={styles.codeHeaderLeft}>
          <Text style={styles.codeTagIndicator}>&lt;code&gt;</Text>
          <Text style={styles.codeTitle}>{title}</Text>
        </View>
        <View style={styles.codeHeaderRight}>
          <View style={styles.jsonBadge}>
            <Text style={styles.jsonBadgeText}>JSON</Text>
          </View>
          <FontAwesome
            name={collapsed ? 'chevron-right' : 'chevron-down'}
            size={10}
            color="#94A3B8"
          />
        </View>
      </TouchableOpacity>
      {!collapsed && (
        <View style={styles.codeBody}>
          <Text style={styles.codeText}>{formattedJson}</Text>
          <Text style={styles.codeTagIndicatorClose}>&lt;/code&gt;</Text>
        </View>
      )}
    </View>
  );
}

export default function AdminOutbox() {
  const [outboxList, setOutboxList] = useState<any[]>([]);
  const [quarantineList, setQuarantineList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const networkOnline = useActorOpsStore((state) => state.networkOnline);

  const fetchQueueData = async () => {
    setRefreshing(true);
    try {
      const outbox = await db.select().from(actorOutbox).orderBy(desc(actorOutbox.createdAt));
      setOutboxList(outbox);

      const quarantine = await db
        .select()
        .from(actorQuarantine)
        .orderBy(desc(actorQuarantine.createdAt));
      setQuarantineList(quarantine);
    } catch (e: any) {
      console.error('Failed to load queue data:', e);
      setErrorMsg(e.message || 'Failed to load queue data');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
  }, []);

  const triggerSync = async () => {
    setSyncing(true);
    setSyncStatusMsg('Step 1/2: Replaying outbox commands to remote...');
    try {
      await globalLocalDispatcher.syncOutbox(globalRemoteDispatcher);
      setSyncStatusMsg('Step 2/2: Flushing sync engine queues to Supabase...');
      await globalLocalDispatcher.getSyncEngine().pushChanges();
      setSyncStatusMsg('Sync Completed Successfully!');
      Alert.alert('Outbox Sync', 'Synchronization and queue flush completed successfully.');
    } catch (err: any) {
      console.error(err);
      setSyncStatusMsg(`Sync Failed: ${err.message}`);
      Alert.alert('Outbox Sync Error', err.message);
    } finally {
      setSyncing(false);
      fetchQueueData();
    }
  };

  const renderOutboxItem = ({ item }: { item: any }) => {
    let payloadData = {};
    try {
      payloadData = JSON.parse(item.payload);
    } catch (e) {}

    return (
      <AdminCard
        title={`Job: ${item.id.slice(0, 10)}...`}
        subtitle={`Created: ${formatTimestamp(item.createdAt)}`}
        headerRight={<OutboxBadge status={item.status} />}
        style={styles.cardSpacing}
      >
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Command ID:</Text>
            <Text style={styles.valueMono}>{item.commandId}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Attempts:</Text>
            <View style={styles.badgeWrapper}>
              <Text style={styles.valueText}>{item.attempts} / 3</Text>
            </View>
          </View>
          <CodePayload data={payloadData} title="Command Context Data" />
        </View>
      </AdminCard>
    );
  };

  const renderQuarantineItem = ({ item }: { item: any }) => {
    let actorParsed = {};
    let payloadParsed = {};
    try {
      actorParsed = JSON.parse(item.actorRef);
      payloadParsed = JSON.parse(item.payload);
    } catch (e) {}

    return (
      <AdminCard
        title={`Quarantine: ${item.id.slice(0, 10)}...`}
        subtitle={`Quarantined: ${formatTimestamp(item.createdAt)}`}
        style={StyleSheet.flatten([styles.quarantineCard, styles.cardSpacing])}
      >
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Command ID:</Text>
            <Text style={styles.valueMono}>{item.commandId}</Text>
          </View>
          <View style={styles.errorBox}>
            <View style={styles.errorHeader}>
              <FontAwesome
                name="exclamation-circle"
                size={12}
                color="#F87171"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.errorLabel}>Last Rejection Error:</Text>
            </View>
            <Text style={styles.errorText}>{item.error}</Text>
          </View>
          <CodePayload
            data={{ actor: actorParsed, payload: payloadParsed }}
            title="Execution Dump Data"
          />
        </View>
      </AdminCard>
    );
  };

  return (
    <AdminShell
      title="Outbox & Sync Manager"
      subtitle="Control authoritative synchronization replays"
      scrollable={false}
    >
      <View style={styles.headerControls}>
        <View style={styles.buttonRow}>
          <CommandButton
            title={syncing ? 'Flushing...' : 'Flush Outbox'}
            onPress={triggerSync}
            disabled={syncing || !networkOnline}
            testID="flush-outbox"
            style={styles.flushBtn}
          />
          <CommandButton
            title={syncing ? 'Syncing...' : 'Sync Outbox Now'}
            onPress={triggerSync}
            disabled={syncing || !networkOnline}
            testID="sync-outbox-now"
            style={styles.syncBtn}
          />
        </View>
        {syncStatusMsg && <Text style={styles.syncStatus}>{syncStatusMsg}</Text>}
        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
        {!networkOnline && (
          <View testID="outbox-offline-state" style={styles.offlineContainer}>
            <FontAwesome
              name="exclamation-triangle"
              size={12}
              color="#D97706"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.offlineText}>
              Device is offline. Synchronization is disabled until network is restored.
            </Text>
          </View>
        )}
        {syncStatusMsg && (
          <View
            style={[
              styles.statusMessageContainer,
              syncStatusMsg.includes('Failed')
                ? styles.statusContainerFail
                : syncStatusMsg.includes('Completed')
                  ? styles.statusContainerSuccess
                  : null,
            ]}
          >
            <FontAwesome
              name={
                syncStatusMsg.includes('Failed')
                  ? 'times-circle'
                  : syncStatusMsg.includes('Completed')
                    ? 'check-circle'
                    : 'spinner'
              }
              size={14}
              color={
                syncStatusMsg.includes('Failed')
                  ? '#F87171'
                  : syncStatusMsg.includes('Completed')
                    ? '#34D399'
                    : '#94A3B8'
              }
              style={{ marginRight: 8 }}
            />
            <Text
              style={[
                styles.statusMessage,
                syncStatusMsg.includes('Failed')
                  ? styles.statusFail
                  : syncStatusMsg.includes('Completed')
                    ? styles.statusSuccess
                    : null,
              ]}
            >
              {syncStatusMsg}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Text style={styles.metricLabel}>Outbox Queue</Text>
            <View
              style={[
                styles.statusIndicator,
                outboxList.length > 0 ? styles.indicatorPending : styles.indicatorSuccess,
              ]}
            />
          </View>
          <View style={styles.metricBody}>
            <Text style={styles.metricValue}>{outboxList.length}</Text>
            <Text style={styles.metricSubtext}>Pending synchronization</Text>
          </View>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Text style={styles.metricLabel}>Quarantined</Text>
            <View
              style={[
                styles.statusIndicator,
                quarantineList.length > 0 ? styles.indicatorFailed : styles.indicatorSuccess,
              ]}
            />
          </View>
          <View style={styles.metricBody}>
            <Text style={styles.metricValue}>{quarantineList.length}</Text>
            <Text style={styles.metricSubtext}>Isolated execution errors</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={outboxList}
        renderItem={renderOutboxItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchQueueData} tintColor="#3B82F6" />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Sync Outbox Queue</Text>
            <View
              style={[
                styles.sectionBadge,
                outboxList.length > 0 ? styles.sectionBadgePending : styles.sectionBadgeEmpty,
              ]}
            >
              <Text style={styles.sectionBadgeText}>{outboxList.length}</Text>
            </View>
          </View>
        }
        ListFooterComponent={
          <>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Quarantine Failures</Text>
              <View
                style={[
                  styles.sectionBadge,
                  quarantineList.length > 0 ? styles.sectionBadgeFailed : styles.sectionBadgeEmpty,
                ]}
              >
                <Text style={styles.sectionBadgeText}>{quarantineList.length}</Text>
              </View>
            </View>
            <FlatList
              data={quarantineList}
              renderItem={renderQuarantineItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <FontAwesome
                    name="shield"
                    size={24}
                    color="#334155"
                    style={{ marginBottom: 8 }}
                  />
                  <Text style={styles.emptyText}>No quarantined commands detected.</Text>
                </View>
              }
            />
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome
              name="check-circle-o"
              size={24}
              color="#334155"
              style={{ marginBottom: 8 }}
            />
            <Text style={styles.emptyText}>Outbox queue is empty. Ready for offline commands.</Text>
          </View>
        }
      />
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  headerControls: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flushBtn: {
    flex: 1,
    backgroundColor: '#10B981', // Emerald 500
    borderRadius: 12,
    height: 48,
  },
  syncBtn: {
    flex: 1,
    backgroundColor: '#3B82F6', // Blue 500
    borderRadius: 12,
    height: 48,
  },
  statusMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statusContainerSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusContainerFail: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusMessage: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: 'SpaceMono',
    fontWeight: '600',
  },
  statusSuccess: {
    color: '#34D399',
  },
  statusFail: {
    color: '#F87171',
  },
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  indicatorPending: {
    backgroundColor: '#FBBF24', // Amber-400
    shadowColor: '#FBBF24',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  indicatorSuccess: {
    backgroundColor: '#34D399', // Emerald-400
    shadowColor: '#34D399',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  indicatorFailed: {
    backgroundColor: '#F87171', // Red-400
    shadowColor: '#F87171',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  metricBody: {
    marginTop: 2,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  metricSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgePending: {
    backgroundColor: '#F59E0B', // Amber-500
  },
  sectionBadgeFailed: {
    backgroundColor: '#EF4444', // Red-500
  },
  sectionBadgeEmpty: {
    backgroundColor: '#334155', // Slate-700
  },
  sectionBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  cardSpacing: {
    marginBottom: 12,
  },
  details: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    color: '#94A3B8',
    fontSize: 13,
    width: 100,
    fontWeight: '600',
  },
  valueMono: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    color: '#E2E8F0',
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  badgeWrapper: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  valueText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: 'bold',
  },
  quarantineCard: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 10,
    marginTop: 8,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  errorLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F87171',
    textTransform: 'uppercase',
  },
  syncStatus: {
    color: '#A7F3D0',
    fontSize: 13,
    marginTop: 8,
  },
  errorText: {
    fontFamily: 'SpaceMono',
    fontSize: 11,
    color: '#FECACA',
    lineHeight: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderStyle: 'dashed',
    marginTop: 8,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  codeContainer: {
    backgroundColor: '#020617', // Slate-950
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#0F172A', // Slate-900
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  codeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeTagIndicator: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    color: '#3B82F6',
    marginRight: 8,
    fontWeight: 'bold',
  },
  codeTagIndicatorClose: {
    fontFamily: 'SpaceMono',
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 8,
    fontWeight: 'bold',
  },
  codeTitle: {
    fontSize: 13,
    color: '#E2E8F0',
    fontWeight: '700',
  },
  codeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jsonBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 10,
  },
  jsonBadgeText: {
    fontSize: 9,
    color: '#93C5FD',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  codeBody: {
    padding: 14,
    backgroundColor: '#020617', // Slate-950
  },
  codeText: {
    fontFamily: 'SpaceMono',
    fontSize: 11,
    color: '#34D399', // Emerald-400
    lineHeight: 16,
  },
  offlineContainer: {
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    borderColor: 'rgba(217, 119, 6, 0.2)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
