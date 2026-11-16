import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { AlertManager as Alert } from '../../framework/ui/dialog/AlertManager';
import { AdminShell } from '../../components/admin/AdminShell';
import { AdminCard } from '../../components/admin/AdminCard';
import { CommandButton } from '../../components/admin/CommandButton';
import { ReceiptBadge } from '../../components/admin/ReceiptBadge';
import { IntelligenceRunner } from '../../lib/v2030/intelligence/runner';
import { IntelligenceRegistry } from '../../lib/v2030/intelligence/registry';
import {
  truexVerificationFixture,
  jtbdConformanceFixture,
  conceptDriftFixture,
  rlOrchestratorFixture,
  complianceGuardFixture,
} from '../../lib/v2030/intelligence/examples';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function AdminIntelligence() {
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [selectedCapId, setSelectedCapId] = useState<string | null>(null);
  const [selectedFixtureType, setSelectedFixtureType] = useState<string>('truthful'); // truthful vs deviant
  const [running, setRunning] = useState(false);
  const [latestReceipt, setLatestReceipt] = useState<any>(null);
  const [replayArtifact, setReplayArtifact] = useState<any>(null);
  const [replaysList, setReplaysList] = useState<any[]>([]);

  useEffect(() => {
    const list = Array.from(IntelligenceRegistry.values());
    setCapabilities(list);
    if (list.length > 0) {
      setSelectedCapId(list[0].id);
    }
    loadReplays();
  }, []);

  const loadReplays = () => {
    try {
      const items = IntelligenceRunner.listReplays();
      setReplaysList(items.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    } catch (e) {}
  };

  const getFixtureInput = (capId: string) => {
    switch (capId) {
      case 'truex-receipt-verifier':
        return truexVerificationFixture;
      case 'jtbd-conformance-auditor':
        return {
          declaredWorkflow: jtbdConformanceFixture.declaredWorkflow,
          actualEvents:
            selectedFixtureType === 'truthful'
              ? jtbdConformanceFixture.truthfulTrace
              : jtbdConformanceFixture.deviantTrace,
        };
      case 'concept-drift-detector':
        return {
          activities:
            selectedFixtureType === 'truthful'
              ? conceptDriftFixture.stableActivities
              : conceptDriftFixture.driftingActivities,
          windowSize: 3,
          threshold: 0.4,
        };
      case 'rl-orchestrator-monitor':
        return rlOrchestratorFixture;
      case 'compliance-safety-guard':
        return {
          traceCommands:
            selectedFixtureType === 'truthful'
              ? complianceGuardFixture.compliantTrace
              : complianceGuardFixture.nonCompliantTrace,
        };
      default:
        return {};
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setLatestReceipt(null);
    setReplayArtifact(null);

    try {
      const input = getFixtureInput(selectedCapId as string);
      const receipt = await IntelligenceRunner.run(selectedCapId as string, input);
      setLatestReceipt(receipt);

      const artifact = IntelligenceRunner.getReplayArtifact(receipt.id);
      setReplayArtifact(artifact);

      Alert.alert('Intelligence Audit Run', `Execution complete. Success: ${receipt.success}`);
      loadReplays();
    } catch (e: any) {
      Alert.alert('Execution Error', e.message);
    } finally {
      setRunning(false);
    }
  };

  const handleSelectReplay = (replay: any) => {
    setLatestReceipt({
      id: replay.receiptId,
      capabilityId: replay.capabilityId,
      timestamp: replay.timestamp,
      success: replay.output ? true : false,
      deltaHash: 'Chain verified',
      logs: replay.logs,
    });
    setReplayArtifact(replay);
  };

  const selectedCap = capabilities.find((c) => c.id === selectedCapId);

  return (
    <AdminShell
      title="Process Intelligence"
      subtitle="wasm4pm Deterministic Substrate Operator Console"
      scrollable={true}
    >
      {/* Capability Selector */}
      <AdminCard
        title="Select Process Capability"
        subtitle="Active wasm4pm algorithms in substrate"
      >
        <View style={styles.capList}>
          {capabilities.map((cap) => (
            <TouchableOpacity
              key={cap.id}
              activeOpacity={0.8}
              style={[styles.capItem, selectedCapId === cap.id && styles.capItemActive]}
              onPress={() => {
                setSelectedCapId(cap.id);
                setLatestReceipt(null);
                setReplayArtifact(null);
              }}
            >
              <Text
                style={[styles.capItemText, selectedCapId === cap.id && styles.capItemTextActive]}
              >
                {cap.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedCap && (
          <View style={styles.capDetail}>
            <Text style={styles.capDesc}>{selectedCap.description}</Text>

            {/* Fixture Scenarios */}
            {(selectedCap.id === 'jtbd-conformance-auditor' ||
              selectedCap.id === 'concept-drift-detector' ||
              selectedCap.id === 'compliance-safety-guard') && (
              <View style={styles.scenarioRow}>
                <Text style={styles.scenarioLabel}>Scenario:</Text>
                <TouchableOpacity
                  style={[
                    styles.scenarioBtn,
                    selectedFixtureType === 'truthful' && styles.scenarioBtnActive,
                  ]}
                  onPress={() => setSelectedFixtureType('truthful')}
                >
                  <Text
                    style={[
                      styles.scenarioBtnText,
                      selectedFixtureType === 'truthful' && styles.scenarioBtnTextActive,
                    ]}
                  >
                    Conforming / Stable
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.scenarioBtn,
                    selectedFixtureType === 'deviant' && styles.scenarioBtnActive,
                  ]}
                  onPress={() => setSelectedFixtureType('deviant')}
                >
                  <Text
                    style={[
                      styles.scenarioBtnText,
                      selectedFixtureType === 'deviant' && styles.scenarioBtnTextActive,
                    ]}
                  >
                    Deviant / Drifted
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <CommandButton
              title={running ? 'Executing...' : 'Run Capability Audit'}
              onPress={handleRun}
              disabled={running}
              testID={`run-intel-${selectedCap.id}`}
              style={styles.runBtn}
            />
          </View>
        )}
      </AdminCard>

      {/* Active Run Results */}
      {latestReceipt && (
        <AdminCard
          title="Audit Run Receipt"
          subtitle={`ID: ${latestReceipt.id}`}
          headerRight={
            <ReceiptBadge status={latestReceipt.success ? 'applied_remote' : 'quarantined'} />
          }
        >
          <View style={styles.receiptGrid}>
            <View style={styles.receiptField}>
              <Text style={styles.fieldLabel}>Capability ID:</Text>
              <Text style={styles.fieldValMono}>{latestReceipt.capabilityId}</Text>
            </View>
            <View style={styles.receiptField}>
              <Text style={styles.fieldLabel}>Hash Chain Checksum:</Text>
              <Text style={styles.fieldValMono} numberOfLines={1}>
                {latestReceipt.deltaHash}
              </Text>
            </View>
            <View style={styles.receiptField}>
              <Text style={styles.fieldLabel}>Timestamp:</Text>
              <Text style={styles.fieldValMono}>{latestReceipt.timestamp}</Text>
            </View>
          </View>

          {/* Special Visualizations based on capability */}
          {replayArtifact && replayArtifact.capabilityId === 'concept-drift-detector' && (
            <View style={styles.visualizerBox}>
              <Text style={styles.visualizerHeader}>EWMA Concept Drift Visualizer</Text>
              {replayArtifact.output?.snapshots?.map((s: any, idx: number) => {
                const pct = s.smoothedDistance;
                const barsCount = Math.max(0, Math.round(pct * 20));
                const bars = '█'.repeat(barsCount).padEnd(20, '░');
                return (
                  <View key={idx} style={styles.driftRow}>
                    <Text style={styles.driftLabel}>W{s.windowIndex}</Text>
                    <Text style={styles.driftBars}>{bars}</Text>
                    <Text style={styles.driftVal}>EWMA: {pct.toFixed(2)}</Text>
                    {s.alert && (
                      <FontAwesome
                        name="warning"
                        size={12}
                        color="#EF4444"
                        style={styles.alertIcon}
                      />
                    )}
                  </View>
                );
              })}
              <Text style={styles.driftSummary}>
                Status: {replayArtifact.output?.stable ? 'Stable (No Drift)' : 'Drift Detected!'}
              </Text>
            </View>
          )}

          {replayArtifact && replayArtifact.capabilityId === 'jtbd-conformance-auditor' && (
            <View style={styles.visualizerBox}>
              <Text style={styles.visualizerHeader}>JTBD Conformance Verdict</Text>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Process Fitness:</Text>
                <Text style={styles.metricValue}>
                  {(replayArtifact.output?.fitness * 100).toFixed(0)}%
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Precision Score:</Text>
                <Text style={styles.metricValue}>
                  {(replayArtifact.output?.precision * 100).toFixed(0)}%
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Verdict status:</Text>
                <Text
                  style={[
                    styles.metricValue,
                    {
                      color: replayArtifact.output?.verdict === 'TRUTHFUL' ? '#10B981' : '#F59E0B',
                    },
                  ]}
                >
                  {replayArtifact.output?.verdict}
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.logsHeader}>Execution Console Logs</Text>
          <View style={styles.logsConsole}>
            {latestReceipt.logs.map((log: string, i: number) => (
              <Text key={i} style={styles.logLine}>
                {log}
              </Text>
            ))}
          </View>
        </AdminCard>
      )}

      {/* Replays History */}
      <AdminCard
        title="Audit Replay Artifacts History"
        subtitle="List of persistent local-first verification files"
      >
        {replaysList.length === 0 ? (
          <Text style={styles.emptyText}>No local audit logs generated yet.</Text>
        ) : (
          replaysList.map((item) => (
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.8}
              key={item.receiptId}
              style={styles.replayItem}
              onPress={() => handleSelectReplay(item)}
            >
              <View style={styles.replayMeta}>
                <Text style={styles.replayCap}>{item.capabilityId}</Text>
                <Text style={styles.replayTime}>
                  {new Date(item.timestamp).toLocaleTimeString()}
                </Text>
              </View>
              <Text style={styles.replayId} numberOfLines={1}>
                {item.receiptId}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </AdminCard>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  capList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  capItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  capItemActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3B82F6',
  },
  capItemText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  capItemTextActive: {
    color: '#F8FAFC',
  },
  capDetail: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 12,
  },
  capDesc: {
    color: '#E2E8F0',
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  scenarioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  scenarioLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 10,
  },
  scenarioBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  scenarioBtnActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderWidth: 1,
    borderColor: '#A855F7',
  },
  scenarioBtnText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  scenarioBtnTextActive: {
    color: '#F8FAFC',
  },
  runBtn: {
    backgroundColor: '#3B82F6',
  },
  receiptGrid: {
    marginBottom: 12,
  },
  receiptField: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 12,
    width: 140,
    fontWeight: '600',
  },
  fieldValMono: {
    color: '#E2E8F0',
    fontSize: 12,
    fontFamily: 'SpaceMono',
    flex: 1,
  },
  logsHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  logsConsole: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  logLine: {
    color: '#34D399', // emerald-400
    fontFamily: 'SpaceMono',
    fontSize: 10,
    marginBottom: 4,
  },
  visualizerBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    marginVertical: 12,
  },
  visualizerHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  driftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  driftLabel: {
    color: '#94A3B8',
    fontFamily: 'SpaceMono',
    fontSize: 11,
    width: 30,
  },
  driftBars: {
    color: '#EAB308', // Amber
    fontFamily: 'SpaceMono',
    fontSize: 12,
    flex: 1,
  },
  driftVal: {
    color: '#E2E8F0',
    fontFamily: 'SpaceMono',
    fontSize: 11,
    width: 80,
    textAlign: 'right',
  },
  alertIcon: {
    marginLeft: 6,
  },
  driftSummary: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  metricItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  metricValue: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  replayItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  replayMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  replayCap: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: 'bold',
  },
  replayTime: {
    color: '#64748B',
    fontSize: 10,
  },
  replayId: {
    color: '#94A3B8',
    fontFamily: 'SpaceMono',
    fontSize: 10,
  },
});
