import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppSwarmManager, AgentInfo, AgentStatus } from '@pcp/framework/v30/autonomous-swarm/AppSwarmManager';
import { AutonomicQAEngine, QACycleReport, QAViolation } from '@pcp/framework/auto/AutonomicQAEngine';
import { TelemetryManager } from '@pcp/framework/membrane/managers/telemetry';
import { LieDetector } from '@pcp/framework/auto/LieDetector';
import { ProtectedRoute } from '@/src/route-law/ProtectedRoute';
import { useHaptics } from '../../framework/ui/haptics/useHaptics';
import { HapticFeedbackPattern } from '../../framework/ui/haptics/IntelligentHaptics';

export default function AuditScreen() {
  const haptics = useHaptics();
  // Swarm and engine instance refs
  const swarmRef = useRef<AppSwarmManager | null>(null);
  const telemetryRef = useRef<TelemetryManager | null>(null);
  const engineRef = useRef<AutonomicQAEngine | null>(null);

  // Component states
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [lastReport, setLastReport] = useState<QACycleReport | null>(null);
  const [simulationLogs, setSimulationLogs] = useState<
    {
      id: string;
      timestamp: string;
      message: string;
      type: 'info' | 'success' | 'warning' | 'error' | 'heal';
    }[]
  >([]);
  const [chainHead, setChainHead] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Initialize swarm and engine
  useEffect(() => {
    const sManager = new AppSwarmManager(10);
    const tManager = new TelemetryManager();
    const qEngine = new AutonomicQAEngine(
      sManager,
      {
        maxAgentRefactorEntropy: 100,
        maxCheckpointAgeEpochs: 10,
        applyStatePatches: true,
      },
      tManager
    );

    // Seed stateMap so agents can do simulated work
    sManager.registerStateMap({
      'ui-button': { name: 'Button', version: 1 },
      'data-grid': { name: 'DataGrid', version: 1 },
      'auth-provider': { name: 'AuthProvider', version: 1 },
    });

    swarmRef.current = sManager;
    telemetryRef.current = tManager;
    engineRef.current = qEngine;

    // Run baseline check to establish initial points
    qEngine.runQACycle().then((report) => {
      setLastReport(report);
      setChainHead(qEngine.getChainHead());
      setAgents([...sManager.getAgents()]);

      addLog(
        'System initialized: 10/10 agents spawned. Healthy baseline checkpoints established.',
        'success'
      );
    });

    // Hook telemetry events into visualizer logs
    tManager.register((event) => {
      if (event.error) {
        addLog(`[TELEMETRY SPAN ERROR] ${event.error}`, 'error');
      } else {
        addLog(
          `[TELEMETRY SPAN] Flow: ${event.flowName} (Trace: ${event.traceId?.slice(0, 12)}...)`,
          'info'
        );
      }
    });

    // Start Lie Detector to aggressively enforce truth
    const detector = new LieDetector(sManager, qEngine);
    detector.start(3000);
    addLog(
      'LIE DETECTOR ACTIVATED. Continuously scanning for deviations from Autonomic Invariants...',
      'success'
    );

    return () => {
      detector.stop();
    };
  }, []);

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' | 'heal') => {
    const id = Math.random().toString(36).substring(7);
    const timestamp = new Date().toLocaleTimeString();
    setSimulationLogs((prev) => [{ id, timestamp, message, type }, ...prev].slice(0, 100));
  };

  // Run a cycle to inspect and self-heal
  const runCycle = async (actionDesc: string) => {
    if (!engineRef.current || !swarmRef.current) return;

    addLog(`Running QA check cycle... (${actionDesc})`, 'info');
    const report = await engineRef.current.runQACycle();
    setLastReport(report);
    setChainHead(engineRef.current.getChainHead());
    setAgents([...swarmRef.current.getAgents()]);

    // Parse violations and repairs in the report
    let violationCount = 0;
    report.agentResults.forEach((result) => {
      result.violations.forEach((violation) => {
        violationCount++;
        addLog(
          `[BREACH] Agent: ${violation.agentId} | Violation: ${violation.kind} | Repair Strategy: ${violation.repairStrategy}`,
          'warning'
        );

        if (violation.repairOutcome.success) {
          addLog(
            `[HEALED] Autonomously recovered ${violation.agentId} via ${violation.repairStrategy}. State restored!`,
            'heal'
          );
        } else {
          addLog(
            `[ESCALATED] Automated repair failed or escalated. Alarm raised! (OTel trace submitted)`,
            'error'
          );
        }
      });
    });

    if (violationCount === 0) {
      addLog('QA check complete: All invariants satisfied. Swarm is healthy.', 'success');
    }
  };

  // ── 1. Inject Chatman Breach ──────────────────────────────────
  const injectChatmanBreach = () => {
    if (!swarmRef.current) return;
    haptics.trigger(HapticFeedbackPattern.WARNING);
    addLog('Injecting Chatman Invariant Breach on Agent #3...', 'warning');
    const agent3 = swarmRef.current.getAgent('agent-3')!;
    agent3.status = 'refactoring';
    agent3.memoryAnalyzed = 0;
    agent3.componentsRefactored = 0;
    setAgents([...swarmRef.current.getAgents()]);

    setTimeout(() => runCycle('Chatman Breach Validation'), 1000);
  };

  // ── 2. Inject Transition Breach ───────────────────────────────
  const injectTransitionBreach = () => {
    if (!swarmRef.current) return;
    haptics.trigger(HapticFeedbackPattern.WARNING);
    addLog('Injecting illegal Status Transition on Agent #5...', 'warning');
    const agent5 = swarmRef.current.getAgent('agent-5')!;
    agent5.status = 'unknown' as AgentStatus;
    setAgents([...swarmRef.current.getAgents()]);

    setTimeout(() => runCycle('Status Transition Validation'), 1000);
  };

  // ── 3. Inject Entropy Overflow ────────────────────────────────
  const injectEntropyOverflow = () => {
    if (!swarmRef.current) return;
    haptics.trigger(HapticFeedbackPattern.WARNING);
    addLog('Injecting State Entropy Overflow on Agent #0...', 'warning');
    const agent0 = swarmRef.current.getAgent('agent-0')!;
    agent0.componentsRefactored = 120; // safe limit is 100
    setAgents([...swarmRef.current.getAgents()]);

    setTimeout(() => runCycle('Entropy Limit Validation'), 1000);
  };

  // ── 4. Inject Checkpoint Staleness ────────────────────────────
  const injectStaleCheckpoint = () => {
    if (!engineRef.current || !swarmRef.current) return;
    haptics.trigger(HapticFeedbackPattern.WARNING);
    addLog(
      'Injecting Checkpoint Staleness (artificially aging historical epochs) on Agent #7...',
      'warning'
    );

    const checkpointsMap = (engineRef.current as any).checkpoints;
    const agent7Cps = checkpointsMap.get('agent-7') || [];
    if (agent7Cps.length > 0) {
      agent7Cps.forEach((cp: any) => {
        cp.epoch = 0; // artificially backdate checkpoint to cycle 0
      });
    }
    // Set max age limit to 2 epochs to trigger staleness quickly
    (engineRef.current as any).config.maxCheckpointAgeEpochs = 2;

    setTimeout(() => runCycle('Checkpoint Age Validation'), 1000);
  };

  // ── 5. Inject Checkpoint Corruption (Re-hydration fallback) ────
  const injectCheckpointCorruption = () => {
    if (!engineRef.current || !swarmRef.current) return;
    haptics.trigger(HapticFeedbackPattern.WARNING);
    addLog('Corrupting checkpoint integrity on Agent #2 (hash mismatch)...', 'warning');

    const checkpointsMap = (engineRef.current as any).checkpoints;
    const agent2Cps = checkpointsMap.get('agent-2') || [];

    // Ensure we have multiple checkpoints for historical fallback
    const agent2 = swarmRef.current.getAgent('agent-2')!;
    agent2.status = 'analyzing';
    agent2.memoryAnalyzed = 512;
    (engineRef.current as any)._captureCheckpoint(agent2); // capture second checkpoint

    if (agent2Cps.length > 1) {
      const latest = agent2Cps[agent2Cps.length - 1];
      (latest.snapshot as any).status = 'refactoring'; // corrupt the data to cause BLAKE3 verification failure
    }

    // Now inject a Chatman breach to trigger rollback. Rollback will see corrupted latest checkpoint,
    // causing fallback to rehydrate from older, uncorrupted history!
    agent2.status = 'refactoring';
    agent2.memoryAnalyzed = 0;
    agent2.componentsRefactored = 0;
    setAgents([...swarmRef.current.getAgents()]);

    setTimeout(() => runCycle('Integrity Rehydration Validation'), 1000);
  };

  // Run a standard swarm simulation tick (standard work progression)
  const simulateSwarmTick = () => {
    if (!swarmRef.current) return;
    addLog('Simulating swarm tick (agents running workflow)...', 'info');
    swarmRef.current.start();
    swarmRef.current.tick();
    swarmRef.current.stop();
    setAgents([...swarmRef.current.getAgents()]);

    setTimeout(() => runCycle('Swarm Tick Progress'), 800);
  };

  // Reset the swarm to a completely clean slate
  const resetSwarm = () => {
    const sManager = new AppSwarmManager(10);
    const tManager = new TelemetryManager();
    const qEngine = new AutonomicQAEngine(
      sManager,
      {
        maxAgentRefactorEntropy: 100,
        maxCheckpointAgeEpochs: 10,
        applyStatePatches: true,
      },
      tManager
    );

    sManager.registerStateMap({
      'ui-button': { name: 'Button', version: 1 },
      'data-grid': { name: 'DataGrid', version: 1 },
      'auth-provider': { name: 'AuthProvider', version: 1 },
    });

    swarmRef.current = sManager;
    telemetryRef.current = tManager;
    engineRef.current = qEngine;

    setSimulationLogs([]);
    setSelectedAgent(null);

    qEngine.runQACycle().then((report) => {
      setLastReport(report);
      setChainHead(qEngine.getChainHead());
      setAgents([...sManager.getAgents()]);
      addLog('Dashboard reset. Healthy baseline established.', 'success');
    });
  };

  const getHealthColor = () => {
    if (!lastReport) return '#10b981';
    if (lastReport.overallHealth === 'HEALTHY') return '#10b981';
    if (lastReport.overallHealth === 'DEGRADED') return '#f59e0b';
    return '#ef4444';
  };

  return (
    <ProtectedRoute route={{ requiredIdentityBoundary: 'mfa_verified', requiredReceiptCommandId: 'cmd_audit_access' }}>
      <View style={styles.container}>
      {/* Header with health state */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>AUTONOMIC QA SYSTEM</Text>
          <Text style={styles.subtitle}>10-AGENT RESILIENCY SIMULATOR</Text>
        </View>
        <View
          style={[
            styles.healthBadge,
            { backgroundColor: getHealthColor() + '20', borderColor: getHealthColor() },
          ]}
        >
          <View style={[styles.pulseDot, { backgroundColor: getHealthColor() }]} />
          <Text style={[styles.healthText, { color: getHealthColor() }]}>
            {lastReport?.overallHealth || 'HEALTHY'}
          </Text>
        </View>
      </View>

      {/* Main dashboard view */}
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* System parameters */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>ENGINE EPOCH</Text>
            <Text style={styles.statVal}>{lastReport?.engineEpoch || 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>VIOLATIONS HEALED</Text>
            <Text style={[styles.statVal, { color: '#10b981' }]}>
              {lastReport?.totalRepairsSucceeded || 0}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>ESCALATED ALARMS</Text>
            <Text
              style={[
                styles.statVal,
                {
                  color:
                    lastReport?.totalViolations &&
                    lastReport.totalViolations > lastReport.totalRepairsSucceeded
                      ? '#ef4444'
                      : '#64748b',
                },
              ]}
            >
              {lastReport ? lastReport.totalViolations - lastReport.totalRepairsSucceeded : 0}
            </Text>
          </View>
        </View>

        {/* Chain head receipt info */}
        <View style={styles.receiptContainer}>
          <Ionicons name="shield-checkmark" size={16} color="#06b6d4" />
          <Text style={styles.receiptText} numberOfLines={1}>
            BLAKE3 CHAIN HEAD: <Text style={styles.mono}>{chainHead || 'GENESIS_HASH'}</Text>
          </Text>
        </View>

        {/* Swarm grid (10 agents) */}
        <Text style={styles.sectionTitle}>SWARM MAP (10 AGENTS ACTIVE)</Text>
        <View style={styles.grid}>
          {agents.map((agent) => {
            const isAgentHealthy =
              lastReport?.agentResults.find((r) => r.agentId === agent.id)?.healthy ?? true;
            return (
              <TouchableOpacity
                key={agent.id}
                style={[
                  styles.agentCard,
                  { borderColor: isAgentHealthy ? '#1e293b' : '#ef4444' },
                  selectedAgent === agent.id && styles.agentCardSelected,
                ]}
                onPress={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Agent ${agent.id.split('-')[1]}, status ${agent.status}, health ${isAgentHealthy ? 'healthy' : 'unhealthy'}`}
                accessibilityState={{ selected: selectedAgent === agent.id }}
              >
                <View style={styles.agentCardHeader}>
                  <Text style={styles.agentName}># {agent.id.split('-')[1]}</Text>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          agent.status === 'idle'
                            ? '#64748b'
                            : agent.status === 'analyzing'
                              ? '#06b6d4'
                              : '#8b5cf6',
                      },
                    ]}
                  />
                </View>

                <Text style={styles.agentStatus}>{agent.status.toUpperCase()}</Text>

                <View style={styles.agentMiniStats}>
                  <Text style={styles.miniLabel}>MEM: {agent.memoryAnalyzed}</Text>
                  <Text style={styles.miniLabel}>ENT: {agent.componentsRefactored}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected agent detail view */}
        {selectedAgent && (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Agent Detail: {selectedAgent.toUpperCase()}</Text>
            {agents.find((a) => a.id === selectedAgent) && (
              <View style={styles.detailGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Current State Status</Text>
                  <Text style={styles.detailVal}>
                    {agents.find((a) => a.id === selectedAgent)!.status}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Memory Blocks Analyzed</Text>
                  <Text style={styles.detailVal}>
                    {agents.find((a) => a.id === selectedAgent)!.memoryAnalyzed}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Refactor Invariant Entropy</Text>
                  <Text style={styles.detailVal}>
                    {agents.find((a) => a.id === selectedAgent)!.componentsRefactored} / 100
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Latest BLAKE3 Checkpoint</Text>
                  <Text style={styles.detailValHex}>
                    {engineRef.current
                      ?.getLatestCheckpoint(selectedAgent)
                      ?.blake3Hash.slice(0, 24) || 'None'}
                    ...
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Controls list */}
        <Text style={styles.sectionTitle}>SIMULATOR INJECTION HARNESS</Text>
        <View style={styles.controlButtonsGrid}>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.btn, styles.btnBreach]}
            onPress={injectChatmanBreach}
          >
            <Ionicons name="pulse" size={18} color="white" />
            <Text style={styles.btnText}>1. Chatman Breach</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.btn, styles.btnBreach]}
            onPress={injectTransitionBreach}
          >
            <Ionicons name="shuffle" size={18} color="white" />
            <Text style={styles.btnText}>2. Transition Breach</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.btn, styles.btnBreach]}
            onPress={injectEntropyOverflow}
          >
            <Ionicons name="flame" size={18} color="white" />
            <Text style={styles.btnText}>3. Entropy Overflow</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.btn, styles.btnBreach]}
            onPress={injectStaleCheckpoint}
          >
            <Ionicons name="time" size={18} color="white" />
            <Text style={styles.btnText}>4. Checkpoint Staleness</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.btn, styles.btnBreach]}
            onPress={injectCheckpointCorruption}
          >
            <Ionicons name="git-pull-request" size={18} color="white" />
            <Text style={styles.btnText}>5. Corrupt & Rehydrate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.btn, styles.btnTick]}
            onPress={simulateSwarmTick}
          >
            <Ionicons name="play" size={18} color="white" />
            <Text style={styles.btnText}>Simulate Tick</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity accessibilityRole="button" style={styles.btnReset} onPress={resetSwarm}>
          <Ionicons name="refresh" size={18} color="#94a3b8" />
          <Text style={styles.resetText}>RESET SIMULATION ENGINE</Text>
        </TouchableOpacity>

        {/* Live log visualizer console */}
        <View style={styles.consoleHeader}>
          <Text style={styles.sectionTitle}>LIVE ACTIVITY LEDGER</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Clear activity logs"
            onPress={() => setSimulationLogs([])}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.console}>
          {simulationLogs.length === 0 ? (
            <Text style={styles.emptyConsole}>
              Visualizer log output will render here during checks...
            </Text>
          ) : (
            simulationLogs.map((log) => {
              let logColor = '#cbd5e1';
              if (log.type === 'success') logColor = '#10b981';
              if (log.type === 'warning') logColor = '#f59e0b';
              if (log.type === 'error') logColor = '#ef4444';
              if (log.type === 'heal') logColor = '#06b6d4';
              return (
                <View key={log.id} style={styles.consoleLine}>
                  <Text style={styles.consoleTime}>[{log.timestamp}]</Text>
                  <Text style={[styles.consoleMessage, { color: logColor }]}>{log.message}</Text>
                </View>
              );
            })
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 44,
    marginBottom: 16,
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#06b6d4',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  healthText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scrollArea: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 3,
    alignItems: 'center',
  },
  statLabel: {
    color: '#9ca3af',
    fontSize: 8,
    fontWeight: '700',
    marginBottom: 4,
  },
  statVal: {
    color: '#f3f4f6',
    fontSize: 16,
    fontWeight: '800',
  },
  receiptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b50',
    borderWidth: 1,
    borderColor: '#33415530',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  receiptText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '600',
    marginLeft: 6,
  },
  mono: {
    fontFamily: 'Courier',
    color: '#06b6d4',
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  agentCard: {
    width: '48%',
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  agentCardSelected: {
    borderColor: '#06b6d4',
    backgroundColor: '#1e293b50',
  },
  agentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  agentName: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  agentStatus: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 8,
  },
  agentMiniStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderColor: '#334155',
    paddingTop: 6,
  },
  miniLabel: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '600',
  },
  detailCard: {
    backgroundColor: '#1e1b4b30',
    borderColor: '#312e81',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  detailTitle: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailItem: {
    width: '48%',
    marginBottom: 8,
  },
  detailLabel: {
    color: '#6366f1',
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailVal: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
  },
  detailValHex: {
    color: '#38bdf8',
    fontSize: 9,
    fontFamily: 'Courier',
  },
  controlButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  btn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  btnBreach: {
    backgroundColor: '#ef444420',
    borderWidth: 1,
    borderColor: '#ef444450',
  },
  btnTick: {
    backgroundColor: '#06b6d420',
    borderWidth: 1,
    borderColor: '#06b6d4',
  },
  btnText: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 6,
  },
  btnReset: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b30',
    borderWidth: 0.5,
    borderColor: '#475569',
    borderRadius: 10,
    paddingVertical: 13,
    marginBottom: 20,
  },
  resetText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  consoleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  clearText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
  },
  console: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    minHeight: 180,
    maxHeight: 250,
  },
  emptyConsole: {
    color: '#475569',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 80,
  },
  consoleLine: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  consoleTime: {
    color: '#475569',
    fontSize: 9,
    fontFamily: 'Courier',
    marginRight: 6,
    width: 60,
  },
  consoleMessage: {
    flex: 1,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '600',
  },
});
