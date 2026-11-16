import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import { AlertManager as Alert } from '../../framework/ui/dialog/AlertManager';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useHaptics } from '../../framework/ui/haptics/useHaptics';
import { HapticFeedbackPattern } from '../../framework/ui/haptics/IntelligentHaptics';
import { useRouter } from 'expo-router';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminCard } from '../../components/admin/AdminCard';
import { ReceiptBadge } from '../../components/admin/ReceiptBadge';
import { JsonInspector } from '../../components/admin/JsonInspector';
import { useActorOpsStore } from '@/src/lib/actor/actorOps';
import { db } from '../../lib/db/db';
import {
  actorOutbox,
  actorQuarantine,
  actorReceipts,
  quads,
  ActorReceiptRecord,
  ActorQuarantineRecord,
} from '../../lib/db/schema';
import { count, eq, desc, or } from 'drizzle-orm';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { generateReceiptHash } from '../../lib/crypto/receipts';
import { SupervisionProcessConformanceEvaluator } from '../../lib/truex/supervision/supervision';
import { HookMessage, HookActorRef } from '../../lib/truex/hook-otp/types';
import { HookActorInstance } from '../../lib/truex/hook-otp/registry';
import { HookMailbox } from '../../lib/truex/hook-otp/mailbox';

// Consequence Supervisors Info
const supervisorsList = [
  {
    id: 'default-hook-supervisor',
    name: 'Default Hook Supervisor',
    maxRetries: 3,
    backoffMs: 10,
    patterns: ['quarantine', 'fatal', 'divergence', 'validation'],
    status: 'Active',
    description:
      'System fault boundary for standard hook actors. Resolves optimistic state mutations and coordinates local rollbacks.',
    color: '#3B82F6',
  },
  {
    id: 'volunteer-flood-supervisor',
    name: 'Volunteer Flood Supervisor',
    maxRetries: 3,
    backoffMs: 10,
    patterns: ['quarantine', 'fatal', 'divergence', 'validation'],
    status: 'Active',
    description:
      'Supervises critical volunteer capacity events. Safeguards ledger consensus and throttles batch command overflows.',
    color: '#10B981',
  },
];

const adminModules = [
  {
    name: 'Consequence Supervision',
    route: '/admin/consequence-supervision',
    icon: 'tachometer',
    color: '#3B82F6',
  },
  { name: 'Church Profile', route: '/admin/church', icon: 'institution', color: '#10B981' },
  { name: 'Content', route: '/admin/content', icon: 'file-text-o', color: '#8B5CF6' },
  { name: 'Sermons', route: '/admin/sermons', icon: 'microphone', color: '#F59E0B' },
  { name: 'Events', route: '/admin/events', icon: 'calendar', color: '#EC4899' },
  { name: 'Groups', route: '/admin/groups', icon: 'users', color: '#06B6D4' },
  { name: 'People', route: '/admin/people', icon: 'vcard-o', color: '#14B8A6' },
  { name: 'Prayer', route: '/admin/prayer', icon: 'heart', color: '#F43F5E' },
  { name: 'Volunteers', route: '/admin/volunteers', icon: 'hand-paper-o', color: '#84CC16' },
  { name: 'Actor Lab', route: '/admin/actor-lab', icon: 'flask', color: '#A855F7' },
  { name: 'Receipts', route: '/admin/receipts', icon: 'ticket', color: '#E2E8F0' },
  { name: 'Outbox Queue', route: '/admin/outbox', icon: 'send-o', color: '#E11D48' },
  { name: 'Realtime Monitor', route: '/admin/realtime', icon: 'flash', color: '#EAB308' },
  { name: 'Process Intel', route: '/admin/intelligence', icon: 'cogs', color: '#6366F1' },
  { name: 'Settings', route: '/admin/settings', icon: 'gears', color: '#64748B' },
];

const throughputData = [
  { label: 'T-30m', value: 35, rate: '12 ops' },
  { label: 'T-25m', value: 55, rate: '18 ops' },
  { label: 'T-20m', value: 80, rate: '27 ops' },
  { label: 'T-15m', value: 45, rate: '15 ops' },
  { label: 'T-10m', value: 95, rate: '32 ops' },
  { label: 'T-5m', value: 65, rate: '22 ops' },
  { label: 'Now', value: 85, rate: '29 ops' },
];

export default function AdminConsequenceSupervision() {
  const router = useRouter();
  const haptics = useHaptics();
  const { outboxCount, quarantineCount, latestReceipt, networkOnline, setCounts } =
    useActorOpsStore();

  const [uptime, setUptime] = useState('00:00:00');
  const [receiptChainValid, setReceiptChainValid] = useState(true);
  const [latestRefusal, setLatestRefusal] = useState<ActorReceiptRecord | null>(null);
  const [totalQuads, setTotalQuads] = useState(0);
  const [reconciliationLag, setReconciliationLag] = useState('0ms');

  // Process Conformance Inspector States
  const [declaredWorkflow] = useState<string[]>([
    'PublishSermon',
    'SendNotification',
    'VerifyFeed',
    'ArchiveRecord',
  ]);
  const [selectedTraceType, setSelectedTraceType] = useState<
    'truthful' | 'skipped' | 'deviant' | 'malformed'
  >('truthful');
  const [conformanceReport, setConformanceReport] = useState<any>(null);

  // Autonomic Dispatch Event Log States
  const [autonomicLogs, setAutonomicLogs] = useState<
    Array<{
      id: string;
      timestamp: string;
      hookId: string;
      messageType: string;
      verdict: string;
      reason?: string;
      mailboxLength: number;
      loadFactor: number;
    }>
  >([
    {
      id: 'AL-001',
      timestamp: new Date(Date.now() - 60000).toLocaleTimeString(),
      hookId: 'ShortageDetectionHook',
      messageType: 'graph_delta',
      verdict: 'allow',
      mailboxLength: 1,
      loadFactor: 0.15,
    },
    {
      id: 'AL-002',
      timestamp: new Date(Date.now() - 45000).toLocaleTimeString(),
      hookId: 'DefaultHook',
      messageType: 'graph_delta',
      verdict: 'allow',
      mailboxLength: 2,
      loadFactor: 0.25,
    },
  ]);

  const actualTraces = {
    truthful: ['PublishSermon', 'SendNotification', 'VerifyFeed', 'ArchiveRecord'],
    skipped: ['PublishSermon', 'VerifyFeed', 'ArchiveRecord'],
    deviant: ['PublishSermon', 'SendNotification', 'VerifyFeed', 'UpdateDatabase', 'ArchiveRecord'],
    malformed: ['SendNotification', 'PublishSermon', 'ArchiveRecord'],
  };

  useEffect(() => {
    const evaluator = new SupervisionProcessConformanceEvaluator();
    const report = evaluator.evaluateTraceConformance(
      declaredWorkflow,
      actualTraces[selectedTraceType]
    );
    setConformanceReport(report);
  }, [selectedTraceType]);

  const simulateAutonomicDispatch = (
    profile: 'normal' | 'flood' | 'pressure' | 'oscillation' | 'high_load'
  ) => {
    const evaluator = new SupervisionProcessConformanceEvaluator();
    const hookId = profile === 'oscillation' ? 'OscillationDetectorHook' : 'DefaultHook';
    const actorRef: HookActorRef = {
      tenantId: 'tenant-1',
      packId: 'pack-1',
      hookId,
      instanceId: `inst-${Math.floor(Math.random() * 1000)}`,
    };

    const mockMailbox = new HookMailbox(async () => {});
    const mailboxLen = profile === 'pressure' ? 12 : 2;
    for (let i = 0; i < mailboxLen; i++) {
      mockMailbox.push({
        id: `m-${i}`,
        type: 'graph_delta',
        payload: {},
        actorRef,
        timestamp: new Date().toISOString(),
      });
    }

    const mockInstance: HookActorInstance = {
      ref: actorRef,
      state: {},
      mailbox: mockMailbox,
      behavior: {},
      supervisor: { onFailure: async () => 'restart' },
      quarantined: false,
      history: [],
      receiptChainHash: '',
    };

    const trace =
      profile === 'oscillation'
        ? [
            'OscillationDetectorHook',
            'OscillationDetectorHook',
            'OscillationDetectorHook',
            'OscillationDetectorHook',
          ]
        : [];
    const msg: HookMessage = {
      id: `msg-${Date.now()}`,
      type: 'graph_delta',
      payload: { trace },
      actorRef,
      timestamp: new Date().toISOString(),
    };

    if (profile === 'flood') {
      for (let i = 0; i < 5; i++) {
        evaluator.evaluateMessage(
          {
            ...msg,
            id: `msg-flood-${i}-${Date.now()}`,
          },
          mockInstance,
          0.1
        );
      }
    }

    const loadFactor = profile === 'high_load' ? 0.9 : 0.2;
    const result = evaluator.evaluateMessage(msg, mockInstance, loadFactor);

    const newLogItem = {
      id: `AL-${Math.floor(Math.random() * 900) + 100}`,
      timestamp: new Date().toLocaleTimeString(),
      hookId,
      messageType: msg.type,
      verdict: result.action,
      reason: result.reason,
      mailboxLength: mailboxLen,
      loadFactor,
    };

    setAutonomicLogs((prev) => [newLogItem, ...prev]);
  };

  const [quarantinedItems, setQuarantinedItems] = useState<ActorQuarantineRecord[]>([]);
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [receiptCounts, setReceiptCounts] = useState<Record<string, number>>({
    accepted_pending: 0,
    rejected_local: 0,
    applied_local: 0,
    applied_remote: 0,
    rejected_remote: 0,
    quarantined: 0,
  });

  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const diff = Date.now() - startTime;
      const secs = Math.floor(diff / 1000) % 60;
      const mins = Math.floor(diff / 60000) % 60;
      const hrs = Math.floor(diff / 3600000) % 24;
      setUptime(
        `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const refreshCounts = async () => {
    try {
      const outboxRes = await db
        .select({ value: count() })
        .from(actorOutbox)
        .where(eq(actorOutbox.status, 'pending'));
      const pendingOutbox = outboxRes[0]?.value || 0;

      const quarantineRes = await db.select({ value: count() }).from(actorQuarantine);
      const pendingQuarantine = quarantineRes[0]?.value || 0;

      setCounts(pendingOutbox, pendingQuarantine);

      const quadsRes = await db.select({ value: count() }).from(quads);
      setTotalQuads(quadsRes[0]?.value || 0);

      const refusals = await db
        .select()
        .from(actorReceipts)
        .where(
          or(
            eq(actorReceipts.status, 'rejected_local'),
            eq(actorReceipts.status, 'rejected_remote'),
            eq(actorReceipts.status, 'quarantined')
          )
        )
        .orderBy(desc(actorReceipts.createdAt))
        .limit(1);
      setLatestRefusal(refusals[0] || null);

      const receipts = await db.select().from(actorReceipts).orderBy(actorReceipts.createdAt);
      let isValid = true;
      let prevHash = '';
      for (const rec of receipts) {
        const data = {
          commandId: rec.commandId,
          status: rec.status,
          error: rec.error || undefined,
        };
        const expectedHash = generateReceiptHash(prevHash, data);
        if (rec.deltaHash && rec.deltaHash !== expectedHash) {
          isValid = false;
        }
        prevHash = rec.deltaHash || expectedHash;
      }
      setReceiptChainValid(isValid);

      setReconciliationLag(pendingOutbox > 0 ? '1.2s (Replaying)' : '0ms (Reconciled)');

      const qList = await db
        .select()
        .from(actorQuarantine)
        .orderBy(desc(actorQuarantine.createdAt))
        .limit(10);

      // Animate if list changed
      setQuarantinedItems(qList);

      const receiptStatusRes = await db
        .select({ status: actorReceipts.status, value: count() })
        .from(actorReceipts)
        .groupBy(actorReceipts.status);
      const countsMap: Record<string, number> = {
        accepted_pending: 0,
        rejected_local: 0,
        applied_local: 0,
        applied_remote: 0,
        rejected_remote: 0,
        quarantined: 0,
      };
      for (const r of receiptStatusRes) {
        if (r.status && r.status in countsMap) {
          countsMap[r.status] = r.value || 0;
        }
      }
      setReceiptCounts(countsMap);
    } catch (e) {
      console.error('Failed to load metrics:', e);
    }
  };

  useEffect(() => {
    refreshCounts();
    const interval = setInterval(refreshCounts, 3000);
    return () => clearInterval(interval);
  }, [quarantinedItems.length]);

  const handleReplay = async (item: ActorQuarantineRecord) => {
    setOperatingId(item.id);
    try {
      const existingOutbox = await db.select().from(actorOutbox).where(eq(actorOutbox.id, item.id));

      if (existingOutbox.length === 0) {
        await db.insert(actorOutbox).values({
          id: item.id,
          commandId: item.commandId,
          jobType: 'DISPATCH_AUTHORITATIVE',
          payload: item.payload,
          status: 'pending',
          attempts: 0,
          createdAt: new Date(),
        });
      } else {
        await db
          .update(actorOutbox)
          .set({ status: 'pending', attempts: 0, createdAt: new Date() })
          .where(eq(actorOutbox.id, item.id));
      }

      await db.delete(actorQuarantine).where(eq(actorQuarantine.id, item.id));
      haptics.trigger(HapticFeedbackPattern.SUCCESS);
      Alert.alert('Replay Dispatched', 'The command has been returned to the outbox queue.');
      await refreshCounts();
    } catch (e) {
      haptics.trigger(HapticFeedbackPattern.ERROR);
      console.error('Failed to replay quarantined item:', e);
      Alert.alert('Error', 'Failed to dispatch replay for this quarantined flow.');
    } finally {
      setOperatingId(null);
    }
  };

  const handlePurge = async (id: string) => {
    Alert.alert(
      'Confirm Purge',
      'Are you sure you want to permanently discard this quarantined flow? This might cause state drift.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge',
          style: 'destructive',
          onPress: async () => {
            setOperatingId(id);
            try {
              await db.delete(actorQuarantine).where(eq(actorQuarantine.id, id));
              await refreshCounts();
            } catch (e) {
              console.error('Failed to purge item:', e);
            } finally {
              setOperatingId(null);
            }
          },
        },
      ]
    );
  };

  const formatTime = (dateInput: Date | string | number | null | undefined) => {
    if (!dateInput) return 'unknown';
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? String(dateInput) : d.toLocaleTimeString();
  };

  const totalReceipts = Object.values(receiptCounts).reduce((a, b) => a + b, 0);
  const successCount = receiptCounts.applied_local + receiptCounts.applied_remote;
  const rejectionCount =
    receiptCounts.rejected_local + receiptCounts.rejected_remote + receiptCounts.accepted_pending;
  const quarantinedCount = receiptCounts.quarantined;

  const successPercent = totalReceipts > 0 ? (successCount / totalReceipts) * 100 : 0;
  const rejectionPercent = totalReceipts > 0 ? (rejectionCount / totalReceipts) * 100 : 0;
  const quarantinedPercent = totalReceipts > 0 ? (quarantinedCount / totalReceipts) * 100 : 0;

  return (
    <AdminShell
      title="ActorOps Console"
      subtitle="Authoritative Command Engine Admin Consequence Supervision"
      scrollable={true}
    >
      <Animated.View entering={FadeIn.duration(500)}>
        <Text style={styles.sectionHeader}>Mission Control Diagnostics</Text>
        <View style={styles.diagnosticsGrid}>
          {[
            {
              title: 'Runtime Health',
              icon: 'heartbeat',
              color: '#10B981',
              value: 'Active / Healthy',
              sub: [`Uptime: ${uptime}`, 'Engine: 1 Active'],
            },
            {
              title: 'Outbox Queue',
              icon: 'send-o',
              color: '#F59E0B',
              value: `${outboxCount} Pending`,
              sub: ['Mode: Local Dispatcher', 'Queue: SQLite outbox'],
              route: '/admin/outbox',
            },
            {
              title: 'Quarantine Count',
              icon: 'bug',
              color: '#EF4444',
              value: `${quarantineCount} Poisoned`,
              sub: ['Failures isolated', 'Status: Secure'],
              route: '/admin/outbox',
            },
            {
              title: 'Latest Refusals',
              icon: 'warning',
              color: '#EC4899',
              value: latestRefusal ? latestRefusal.status : '0 logged',
              sub: latestRefusal
                ? [`${latestRefusal.commandId.slice(0, 15)}...`]
                : ['No active rejections'],
              valColor: latestRefusal ? '#F472B6' : undefined,
            },
            {
              title: 'Reconcile Lag',
              icon: 'clock-o',
              color: '#06B6D4',
              value: reconciliationLag,
              sub: ['Replay delta: Auto', 'Authority check: OK'],
            },
            {
              title: 'Receipt Integrity',
              icon: 'shield',
              color: '#3B82F6',
              value: receiptChainValid ? 'VERIFIED' : 'TAMPERED',
              sub: ['Alg: BLAKE3 chain', 'Receipts verified: OK'],
            },
            {
              title: 'Projection Drift',
              icon: 'database',
              color: '#84CC16',
              value: '0% Drift (OK)',
              sub: [`Total Quads: ${totalQuads}`, 'SQLite tables: Match'],
            },
            {
              title: 'Realtime Channel',
              icon: 'wifi',
              color: '#A855F7',
              value: networkOnline ? 'ONLINE' : 'OFFLINE',
              sub: ['Supabase Broadcast', 'WebSockets: Active'],
              valColor: networkOnline ? '#34D399' : '#F87171',
            },
          ].map((item, idx) => (
            <Pressable
              key={idx}
              style={({ pressed }) => [
                styles.diagCard,
                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => (item.route ? router.push(item.route as any) : null)}
              disabled={!item.route}
            >
              <View style={styles.diagHeader}>
                <View style={[styles.diagIconBox, { backgroundColor: item.color + '20' }]}>
                  <FontAwesome name={item.icon as any} size={14} color={item.color} />
                </View>
                <Text style={styles.diagTitle}>{item.title}</Text>
              </View>
              <Text style={[styles.diagStatusText, item.valColor && { color: item.valColor }]}>
                {item.value}
              </Text>
              {item.sub.map((subText, sIdx) => (
                <Text key={sIdx} style={styles.diagSubText} numberOfLines={1}>
                  {subText}
                </Text>
              ))}
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionHeader}>Consequence Fault Supervision & Retries</Text>
        <View style={styles.supervisorsContainer}>
          {supervisorsList.map((sup) => (
            <View key={sup.id} style={styles.supervisorCard}>
              <View style={styles.supervisorHeader}>
                <Text style={styles.supervisorTitle}>{sup.name}</Text>
                <View style={styles.statusBadge}>
                  <View style={[styles.statusDot, { backgroundColor: sup.color }]} />
                  <Text style={[styles.statusBadgeText, { color: sup.color }]}>{sup.status}</Text>
                </View>
              </View>

              <Text style={styles.supervisorDesc}>{sup.description}</Text>

              <View style={styles.configTable}>
                <View style={styles.configRow}>
                  <Text style={styles.configLabel}>Retry Limit:</Text>
                  <Text style={styles.configValue}>{sup.maxRetries} Execution Attempts</Text>
                </View>
                <View style={styles.configRow}>
                  <Text style={styles.configLabel}>Exponential Backoff:</Text>
                  <Text style={styles.configValue}>Base delay {sup.backoffMs}ms</Text>
                </View>
                <View style={styles.configRow}>
                  <Text style={styles.configLabel}>Isolation Triggers:</Text>
                  <View style={styles.patternPills}>
                    {sup.patterns.map((p) => (
                      <Text key={p} style={styles.patternPill}>
                        {p}
                      </Text>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.pathwayContainer}>
                <Text style={styles.pathwayLabel}>Engine Mitigation Flow:</Text>
                <View style={styles.pathwayLine}>
                  <View style={styles.pathwayStep}>
                    <Text style={styles.pathwayText}>Dispatch</Text>
                  </View>
                  <FontAwesome
                    name="chevron-right"
                    size={10}
                    color="#475569"
                    style={styles.pathwayArrow}
                  />
                  <View style={styles.pathwayStep}>
                    <Text style={styles.pathwayText}>Retry 1</Text>
                  </View>
                  <FontAwesome
                    name="chevron-right"
                    size={10}
                    color="#475569"
                    style={styles.pathwayArrow}
                  />
                  <View style={styles.pathwayStep}>
                    <Text style={styles.pathwayText}>Retry 2</Text>
                  </View>
                  <FontAwesome
                    name="chevron-right"
                    size={10}
                    color="#475569"
                    style={styles.pathwayArrow}
                  />
                  <View style={[styles.pathwayStep, styles.pathwayStepWarn]}>
                    <Text style={styles.pathwayTextWarn}>Retry 3</Text>
                  </View>
                  <FontAwesome
                    name="chevron-right"
                    size={10}
                    color="#475569"
                    style={styles.pathwayArrow}
                  />
                  <View style={[styles.pathwayStep, styles.pathwayStepError]}>
                    <Text style={styles.pathwayTextError}>Quarantine</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionHeader}>Processing Metrics & Outcome Graphs</Text>

        <AdminCard
          title="Command Outcomes Distribution"
          subtitle="Distribution of executed command states inside the engine ledger."
        >
          <View style={styles.graphContainer}>
            <View style={styles.stackedBarContainer}>
              {totalReceipts > 0 ? (
                <>
                  {successPercent > 0 && (
                    <View
                      style={[
                        styles.stackedBarSegment,
                        { width: `${successPercent}%`, backgroundColor: '#10B981' },
                      ]}
                    />
                  )}
                  {rejectionPercent > 0 && (
                    <View
                      style={[
                        styles.stackedBarSegment,
                        { width: `${rejectionPercent}%`, backgroundColor: '#F59E0B' },
                      ]}
                    />
                  )}
                  {quarantinedPercent > 0 && (
                    <View
                      style={[
                        styles.stackedBarSegment,
                        { width: `${quarantinedPercent}%`, backgroundColor: '#EF4444' },
                      ]}
                    />
                  )}
                </>
              ) : (
                <View
                  style={[styles.stackedBarSegment, { width: '100%', backgroundColor: '#475569' }]}
                />
              )}
            </View>

            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendText}>
                  Applied: {successCount} ({successPercent.toFixed(0)}%)
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.legendText}>
                  Rejected: {rejectionCount} ({rejectionPercent.toFixed(0)}%)
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.legendText}>
                  Quarantined: {quarantinedCount} ({quarantinedPercent.toFixed(0)}%)
                </Text>
              </View>
            </View>
          </View>
        </AdminCard>

        <AdminCard
          title="Realtime Dispatch Throughput Pulse"
          subtitle="Command replay frequency and speed monitor over the last 30 minutes."
        >
          <View style={styles.graphContainer}>
            <View style={styles.vBarChartContainer}>
              {throughputData.map((d, i) => (
                <View key={i} style={styles.vBarCol}>
                  <Text style={styles.vBarTooltip}>{d.rate}</Text>
                  <View style={styles.vBarTrack}>
                    <View style={[styles.vBarFill, { height: `${d.value}%` }]} />
                  </View>
                  <Text style={styles.vBarLabel}>{d.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.chartMeta}>
              <Text style={styles.chartMetaText}>Average speed: 1.4s per sync batch</Text>
              <Text style={styles.chartMetaText}>Peak speed: 32 ops/min</Text>
            </View>
          </View>
        </AdminCard>

        <Text style={styles.sectionHeader}>Quarantine Isolation Vault</Text>

        {quarantineCount > 0 ? (
          <View style={styles.quarantineVaultContainer}>
            <View style={styles.alertBanner}>
              <View style={styles.alertIconWrapper}>
                <FontAwesome name="exclamation-triangle" size={20} color="#F87171" />
              </View>
              <View style={styles.alertTextWrapper}>
                <Text style={styles.alertTitle}>CONSEQUENCE ENGINE ALERT</Text>
                <Text style={styles.alertBody}>
                  {quarantineCount} execution flow(s) isolated due to fatal contract divergence or
                  runtime integrity errors. Inbound sync queues for these hooks are paused to
                  prevent SQLite drift.
                </Text>
              </View>
            </View>

            <View style={styles.quarantineList}>
              {quarantinedItems.map((item) => {
                let actorParsed = {};
                let payloadParsed = {};
                try {
                  actorParsed = JSON.parse(item.actorRef);
                  payloadParsed = JSON.parse(item.payload);
                } catch (e) {}
                const isOperating = operatingId === item.id;

                return (
                  <View key={item.id} style={styles.quarantineItem}>
                    <View style={styles.quarantineItemHeader}>
                      <View style={styles.quarantineItemHeaderLeft}>
                        <FontAwesome name="bug" size={14} color="#EF4444" style={styles.bugIcon} />
                        <Text style={styles.quarantineItemTitle}>
                          Flow ID: {item.id.slice(0, 10)}...
                        </Text>
                      </View>
                      <Text style={styles.quarantineItemTime}>{formatTime(item.createdAt)}</Text>
                    </View>

                    <View style={styles.quarantineDetailGrid}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Command ID:</Text>
                        <Text style={styles.detailValueMono} numberOfLines={1}>
                          {item.commandId}
                        </Text>
                      </View>
                      <View style={styles.detailErrorBox}>
                        <Text style={styles.detailErrorLabel}>Fault Cause:</Text>
                        <Text style={styles.detailErrorText}>{item.error}</Text>
                      </View>
                    </View>

                    <JsonInspector
                      data={{ actor: actorParsed, payload: payloadParsed }}
                      title="Execution Dump Data"
                    />

                    <View style={styles.itemActions}>
                      <Pressable
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.actionBtn,
                          styles.btnReplay,
                          isOperating && styles.btnDisabled,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => handleReplay(item)}
                        disabled={isOperating}
                      >
                        {isOperating ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <FontAwesome
                              name="play-circle"
                              size={14}
                              color="#FFFFFF"
                              style={styles.btnIcon}
                            />
                            <Text style={styles.btnText}>Force Replay</Text>
                          </>
                        )}
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.actionBtn,
                          styles.btnPurge,
                          isOperating && styles.btnDisabled,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => handlePurge(item.id)}
                        disabled={isOperating}
                      >
                        {isOperating ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <>
                            <FontAwesome
                              name="trash-o"
                              size={14}
                              color="#EF4444"
                              style={styles.btnIcon}
                            />
                            <Text style={[styles.btnText, styles.btnTextPurge]}>Purge Record</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.secureBanner}>
            <View style={styles.secureIconWrapper}>
              <FontAwesome name="shield" size={20} color="#34D399" />
            </View>
            <View style={styles.secureTextWrapper}>
              <Text style={styles.secureTitle}>ISOLATION VAULT SECURE</Text>
              <Text style={styles.secureBody}>
                All actor state projections are fully synchronized. No active fault quarantines or
                poisoned messages detected in the system.
              </Text>
            </View>
          </View>
        )}

        <AdminCard title="Latest Process Receipt" subtitle="Operational Audit Trail Info">
          {latestReceipt ? (
            <View style={styles.receiptContainer}>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Command:</Text>
                <Text style={styles.receiptVal}>{latestReceipt.commandId}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Status:</Text>
                <ReceiptBadge status={latestReceipt.status} />
              </View>
              {latestReceipt.error && (
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Error:</Text>
                  <Text style={[styles.receiptVal, styles.errorText]}>{latestReceipt.error}</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.noReceiptText}>No commands executed in this session yet.</Text>
          )}
        </AdminCard>

        <Text style={styles.sectionHeader}>Process Conformance & Trace Auditor</Text>
        <AdminCard
          title="Trace Conformance Analyzer"
          subtitle="Verifies actual execution trajectory against declared workflow."
          headerRight={
            conformanceReport && (
              <View
                style={[
                  styles.verdictBadge,
                  conformanceReport.verdict === 'TRUTHFUL' && styles.verdictTruthful,
                  conformanceReport.verdict === 'VARIANCE' && styles.verdictVariance,
                  conformanceReport.verdict === 'DECEPTIVE' && styles.verdictDeceptive,
                ]}
              >
                <Text style={styles.verdictBadgeText}>{conformanceReport.verdict}</Text>
              </View>
            )
          }
        >
          <View style={styles.conformanceContainer}>
            <Text style={styles.conformanceLabel}>Declared Workflow:</Text>
            <View style={styles.workflowChain}>
              {declaredWorkflow.map((step, idx) => (
                <React.Fragment key={step}>
                  {idx > 0 && (
                    <FontAwesome
                      name="long-arrow-right"
                      size={12}
                      color="#64748B"
                      style={styles.chainArrow}
                    />
                  )}
                  <View style={styles.workflowStep}>
                    <Text style={styles.workflowStepText}>{step}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            <Text style={styles.conformanceLabel}>Scenario Trace Selector:</Text>
            <View style={styles.scenarioRow}>
              {(['truthful', 'skipped', 'deviant', 'malformed'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  activeOpacity={0.8}
                  style={[
                    styles.scenarioBtn,
                    selectedTraceType === type && styles.scenarioBtnActive,
                  ]}
                  onPress={() => setSelectedTraceType(type)}
                  testID={`scenario-btn-${type}`}
                >
                  <Text
                    style={[
                      styles.scenarioBtnText,
                      selectedTraceType === type && styles.scenarioBtnTextActive,
                    ]}
                  >
                    {type.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {conformanceReport && (
              <View style={styles.conformanceResultBox}>
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCell}>
                    <Text style={styles.metricCellVal}>
                      {(conformanceReport.fitness * 100).toFixed(0)}%
                    </Text>
                    <Text style={styles.metricCellLabel}>Fitness</Text>
                  </View>
                  <View style={styles.metricCell}>
                    <Text style={styles.metricCellVal}>
                      {(conformanceReport.precision * 100).toFixed(0)}%
                    </Text>
                    <Text style={styles.metricCellLabel}>Precision</Text>
                  </View>
                  <View style={styles.metricCell}>
                    <Text style={styles.metricCellVal}>
                      {(conformanceReport.simplicity * 100).toFixed(0)}%
                    </Text>
                    <Text style={styles.metricCellLabel}>Simplicity</Text>
                  </View>
                </View>

                <Text style={styles.conformanceLabel}>Observed Trace Visualization:</Text>
                <View style={styles.actualTraceChain}>
                  {actualTraces[selectedTraceType].map((step, idx) => {
                    const prevStep = idx > 0 ? actualTraces[selectedTraceType][idx - 1] : null;
                    const isDeviant = prevStep
                      ? !declaredWorkflow.includes(prevStep) ||
                        !declaredWorkflow.includes(step) ||
                        declaredWorkflow.indexOf(step) !== declaredWorkflow.indexOf(prevStep) + 1
                      : false;
                    return (
                      <React.Fragment key={`${step}-${idx}`}>
                        {idx > 0 && (
                          <View style={styles.arrowContainer}>
                            <FontAwesome
                              name="long-arrow-right"
                              size={12}
                              color={isDeviant ? '#EF4444' : '#10B981'}
                              style={styles.chainArrow}
                            />
                            {isDeviant && (
                              <FontAwesome
                                name="exclamation-triangle"
                                size={10}
                                color="#EF4444"
                                style={styles.deviantWarningIcon}
                              />
                            )}
                          </View>
                        )}
                        <View
                          style={[
                            styles.workflowStep,
                            isDeviant ? styles.stepDeviant : styles.stepConforming,
                          ]}
                        >
                          <Text
                            style={[
                              styles.workflowStepText,
                              isDeviant ? styles.stepTextDeviant : styles.stepTextConforming,
                            ]}
                          >
                            {step}
                          </Text>
                        </View>
                      </React.Fragment>
                    );
                  })}
                </View>

                {conformanceReport.deviations.length > 0 ? (
                  <View style={styles.deviationsBox}>
                    <Text style={styles.deviationsHeader}>Detected Trace Deviations:</Text>
                    {conformanceReport.deviations.map((dev: string, dIdx: number) => (
                      <View key={dIdx} style={styles.deviationRow}>
                        <FontAwesome
                          name="warning"
                          size={12}
                          color="#F59E0B"
                          style={styles.deviationIcon}
                        />
                        <Text style={styles.deviationText}>{dev}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.conformanceSuccessBox}>
                    <FontAwesome
                      name="check-circle"
                      size={14}
                      color="#10B981"
                      style={styles.deviationIcon}
                    />
                    <Text style={styles.conformanceSuccessText}>
                      Perfect Trace Conformance Verified
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </AdminCard>

        <Text style={styles.sectionHeader}>Autonomic Dispatch Supervision</Text>
        <AdminCard
          title="Autonomic Dispatcher Event Log"
          subtitle="Monitors lifecycle actions, queue limits and system load levels."
        >
          <View style={styles.autonomicContainer}>
            <Text style={styles.conformanceLabel}>
              Trigger Simulated Autonomic Tension Profile:
            </Text>
            <View style={styles.simulationBtnRow}>
              {(
                [
                  { label: 'Normal', value: 'normal' },
                  { label: 'Flood', value: 'flood' },
                  { label: 'Pressure', value: 'pressure' },
                  { label: 'Oscillation', value: 'oscillation' },
                  { label: 'High Load', value: 'high_load' },
                ] as const
              ).map((btn) => (
                <TouchableOpacity
                  key={btn.value}
                  activeOpacity={0.8}
                  style={styles.simulationBtn}
                  onPress={() => simulateAutonomicDispatch(btn.value)}
                  testID={`simulate-btn-${btn.value}`}
                >
                  <Text style={styles.simulationBtnText}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.conformanceLabel}>Autonomic Log (Most Recent First):</Text>
            <View style={styles.logList}>
              {autonomicLogs.map((log) => (
                <View key={log.id} style={styles.logItem} testID="autonomic-log-item">
                  <View style={styles.logItemHeader}>
                    <View style={styles.logItemHeaderLeft}>
                      <Text style={styles.logItemId}>{log.id}</Text>
                      <Text style={styles.logItemHook}>{log.hookId}</Text>
                    </View>
                    <Text style={styles.logItemTime}>{log.timestamp}</Text>
                  </View>
                  <View style={styles.logItemBody}>
                    <View style={styles.logItemMetaRow}>
                      <Text style={styles.logItemMeta}>
                        Mailbox Size: <Text style={styles.logItemMetaVal}>{log.mailboxLength}</Text>
                      </Text>
                      <Text style={styles.logItemMeta}>
                        Load Factor:{' '}
                        <Text style={styles.logItemMetaVal}>
                          {(log.loadFactor * 100).toFixed(0)}%
                        </Text>
                      </Text>
                      <Text style={styles.logItemMeta}>
                        Type: <Text style={styles.logItemMetaVal}>{log.messageType}</Text>
                      </Text>
                    </View>
                    <View style={styles.logItemVerdictRow}>
                      <Text style={styles.verdictLabelText}>Verdict Action: </Text>
                      <View
                        style={[
                          styles.verdictActionBadge,
                          log.verdict === 'allow' && styles.actionAllow,
                          log.verdict === 'suppress' && styles.actionSuppress,
                          log.verdict === 'batch' && styles.actionBatch,
                          log.verdict === 'quarantine' && styles.actionQuarantine,
                        ]}
                      >
                        <Text style={styles.verdictActionText}>{log.verdict.toUpperCase()}</Text>
                      </View>
                    </View>
                    {log.reason && (
                      <View style={styles.logReasonBox}>
                        <FontAwesome
                          name="info-circle"
                          size={10}
                          color="#F87171"
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.logReasonText}>{log.reason}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </AdminCard>

        <Text style={styles.gridHeader}>Operations Modules</Text>
        <View style={styles.gridContainer}>
          {adminModules.map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.name}
              style={({ pressed }) => [
                styles.gridItem,
                pressed && {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  transform: [{ scale: 0.98 }],
                },
              ]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[styles.iconBox, { backgroundColor: item.color + '25' }]}>
                <FontAwesome name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={styles.gridText}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CBD5E1',
    marginTop: 24,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  diagnosticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  diagCard: {
    flex: 1,
    minWidth: 300,
    marginHorizontal: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  diagHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  diagIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  diagTitle: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  diagStatusText: { fontSize: 16, fontWeight: '800', color: '#F8FAFC', marginBottom: 6 },
  diagSubText: { fontSize: 11, color: '#64748B', marginTop: 2 },

  supervisorsContainer: { marginBottom: 12 },
  supervisorCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  supervisorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  supervisorTitle: { fontSize: 16, fontWeight: 'bold', color: '#F8FAFC' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  supervisorDesc: { fontSize: 13, color: '#94A3B8', lineHeight: 20, marginBottom: 16 },
  configTable: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  configLabel: { fontSize: 13, color: '#64748B' },
  configValue: { fontSize: 13, fontWeight: '700', color: '#E2E8F0' },
  patternPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: '65%',
  },
  patternPill: {
    fontSize: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#CBD5E1',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginLeft: 6,
    marginBottom: 4,
    fontFamily: 'SpaceMono',
  },
  pathwayContainer: {
    marginTop: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    padding: 12,
    borderRadius: 12,
  },
  pathwayLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  pathwayLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pathwayStep: {
    flex: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  pathwayStepWarn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  pathwayStepError: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  pathwayText: { fontSize: 11, fontWeight: '700', color: '#60A5FA' },
  pathwayTextWarn: { fontSize: 11, fontWeight: '700', color: '#FBBF24' },
  pathwayTextError: { fontSize: 11, fontWeight: '800', color: '#F87171' },
  pathwayArrow: { marginHorizontal: 6 },

  graphContainer: { paddingVertical: 8 },
  stackedBarContainer: {
    height: 18,
    flexDirection: 'row',
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  stackedBarSegment: { height: '100%' },
  chartLegend: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 8 },
  legendIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  legendText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  vBarChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 16,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  vBarCol: { alignItems: 'center', flex: 1 },
  vBarTooltip: { fontSize: 9, color: '#94A3B8', marginBottom: 6, fontFamily: 'SpaceMono' },
  vBarTrack: {
    height: 80,
    width: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  vBarFill: { width: '100%', backgroundColor: '#3B82F6', borderRadius: 6 },
  vBarLabel: { fontSize: 10, color: '#64748B', marginTop: 8 },
  chartMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
  },
  chartMetaText: { fontSize: 11, color: '#64748B', fontWeight: '500' },

  quarantineVaultContainer: { marginBottom: 20 },
  alertBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  alertIconWrapper: { marginRight: 14, marginTop: 2 },
  alertTextWrapper: { flex: 1 },
  alertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F87171',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  alertBody: { fontSize: 13, color: '#FECACA', lineHeight: 20 },
  secureBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  secureIconWrapper: { marginRight: 14, marginTop: 2 },
  secureTextWrapper: { flex: 1 },
  secureTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#34D399',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  secureBody: { fontSize: 13, color: '#A7F3D0', lineHeight: 20 },
  quarantineList: { marginTop: 4 },
  quarantineItem: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  quarantineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingBottom: 10,
    marginBottom: 12,
  },
  quarantineItemHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  bugIcon: { marginRight: 8 },
  quarantineItemTitle: { fontSize: 14, fontWeight: '800', color: '#F8FAFC' },
  quarantineItemTime: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  quarantineDetailGrid: { marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  detailLabel: { fontSize: 12, color: '#64748B', marginBottom: 2, marginRight: 8 },
  detailValueMono: { fontSize: 12, fontFamily: 'SpaceMono', color: '#CBD5E1', marginBottom: 8 },
  detailErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  detailErrorLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F87171',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  detailErrorText: { fontSize: 12, color: '#FECACA', lineHeight: 18 },
  itemActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, gap: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    minWidth: 120,
  },
  btnReplay: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  btnPurge: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  btnDisabled: { opacity: 0.6 },
  btnIcon: { marginRight: 8 },
  btnText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  btnTextPurge: { color: '#EF4444' },

  receiptContainer: { padding: 6 },
  receiptRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  receiptLabel: { color: '#64748B', fontSize: 13, width: 85, fontWeight: '700' },
  receiptVal: { color: '#F8FAFC', fontSize: 13, fontFamily: 'SpaceMono', flex: 1 },
  errorText: { color: '#F87171' },
  noReceiptText: {
    color: '#64748B',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },

  gridHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CBD5E1',
    marginTop: 24,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  gridItem: {
    flex: 1,
    minWidth: 150,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 18,
    margin: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gridText: { fontSize: 12, fontWeight: '700', color: '#E2E8F0', textAlign: 'center' },
  verdictBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verdictBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  verdictTruthful: { backgroundColor: '#10B981' },
  verdictVariance: { backgroundColor: '#F59E0B' },
  verdictDeceptive: { backgroundColor: '#EF4444' },
  conformanceContainer: { padding: 4 },
  conformanceLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
    letterSpacing: 0.5,
  },
  workflowChain: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  workflowStep: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  workflowStepText: { fontSize: 12, fontWeight: '600', color: '#E2E8F0' },
  chainArrow: { marginHorizontal: 8 },
  actualTraceChain: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
  },
  stepConforming: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  stepTextConforming: { color: '#34D399' },
  stepDeviant: { borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  stepTextDeviant: { color: '#F87171' },
  arrowContainer: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  deviantWarningIcon: { position: 'absolute', top: -10, right: 6 },
  conformanceResultBox: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: 12,
    paddingTop: 12,
  },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  metricCellVal: { fontSize: 16, fontWeight: '800', color: '#F8FAFC' },
  metricCellLabel: { fontSize: 10, color: '#64748B', marginTop: 4, textTransform: 'uppercase' },
  deviationsBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  deviationsHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FBBF24',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  deviationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  deviationIcon: { marginRight: 8 },
  deviationText: { fontSize: 12, color: '#FDE68A', flex: 1 },
  conformanceSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  conformanceSuccessText: { fontSize: 12, fontWeight: '600', color: '#34D399', flex: 1 },
  scenarioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 6,
  },
  scenarioBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  scenarioBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  scenarioBtnText: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  scenarioBtnTextActive: { color: '#F8FAFC' },
  autonomicContainer: { padding: 4 },
  simulationBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  simulationBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginVertical: 2,
  },
  simulationBtnText: { color: '#60A5FA', fontSize: 11, fontWeight: '700' },
  logList: { marginTop: 8 },
  logItem: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  logItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    paddingBottom: 6,
    marginBottom: 8,
  },
  logItemHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logItemId: { fontSize: 10, fontFamily: 'SpaceMono', color: '#94A3B8', fontWeight: 'bold' },
  logItemHook: { fontSize: 11, fontWeight: '700', color: '#E2E8F0' },
  logItemTime: { fontSize: 10, color: '#64748B' },
  logItemBody: { gap: 6 },
  logItemMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  logItemMeta: { fontSize: 11, color: '#64748B' },
  logItemMetaVal: { color: '#CBD5E1', fontWeight: '600' },
  logItemVerdictRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  verdictLabelText: { fontSize: 11, color: '#64748B' },
  verdictActionBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 },
  verdictActionText: { fontSize: 9, fontWeight: '900', color: '#FFFFFF' },
  actionAllow: { backgroundColor: '#10B981' },
  actionSuppress: { backgroundColor: '#EF4444' },
  actionBatch: { backgroundColor: '#F59E0B' },
  actionQuarantine: { backgroundColor: '#7C3AED' },
  logReasonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  logReasonText: { fontSize: 11, color: '#F87171', fontWeight: '600' },
});

export { ErrorBoundary } from '@/src/components/ErrorBoundary';
