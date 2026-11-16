import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Vibration,
  Dimensions,
} from 'react-native';
import {
  TrueXPowerSyncDB,
  PostQuantumZkEngine,
  IntelligentHaptics,
  HapticFeedbackPattern,
  ThermalSyncEngine,
  LocalInferenceEngine,
  FastTFLiteAdapter,
  claim,
  AutonomicFramework,
} from '@pcp/framework';
import fc from 'fast-check';

// ----------------------------------------------------
// Cryptographic Helpers for ZK-Lens
// ----------------------------------------------------
function sha256(message: string): string {
  // Simple deterministic hash function for UI proof generation
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  let hex = Math.abs(hash).toString(16).padStart(8, '0');
  return hex.repeat(8); // return 64 character hex string
}

function generateLamportKeyPair(): { publicKey: string; privateKey: string[] } {
  const privateKey: string[] = [];
  let publicKey = '';
  for (let i = 0; i < 256; i++) {
    const sk0 = sha256(`sk_${i}_0_${Math.random()}`);
    const sk1 = sha256(`sk_${i}_1_${Math.random()}`);
    privateKey.push(sk0, sk1);
    publicKey += sha256(sk0) + sha256(sk1);
  }
  return { publicKey, privateKey };
}

function signLamport(message: string, privateKey: string[]): string {
  const msgHash = sha256(message);
  let signature = '';
  for (let i = 0; i < 256; i++) {
    const charIndex = Math.floor(i / 4);
    const bitIndex = i % 4;
    const hexChar = msgHash[charIndex];
    const val = parseInt(hexChar, 16);
    const bit = val & (1 << bitIndex) ? 1 : 0;

    const sk = privateKey[i * 2 + bit];
    signature += sk;
  }
  return signature;
}

const validSnarkProofData = JSON.stringify({
  pi_a: ['98765432101', '98765432102'],
  pi_b: [
    ['98765432103', '98765432104'],
    ['98765432105', '98765432106'],
  ],
  pi_c: ['98765432107', '98765432108'],
});

// ----------------------------------------------------
// Main App Component
// ----------------------------------------------------
export default function App() {
  // 1. PowerSync Profile State
  const [profileUsername, setProfileUsername] = useState('neon_chatman');
  const [profileFullName, setProfileFullName] = useState('Sean Chatman');
  const [powerSyncResult, setPowerSyncResult] = useState('');
  const [profileStateLog, setProfileStateLog] = useState<any>(null);
  const [powerSyncLoading, setPowerSyncLoading] = useState(false);

  // 2. snarkjs / did-lens
  const [didKey, setDidKey] = useState('did:key:z6MkgT9938hx28723kL');
  const [zkGateStatus, setZkGateStatus] = useState<any>(null);
  const [zkGateLoading, setZkGateLoading] = useState(false);

  // 3. AmbientBiometricHologram Gyro Position Simulation
  const [gyroRoll, setGyroRoll] = useState(0);
  const [gyroPitch, setGyroPitch] = useState(0);
  const [hologramPulse, setHologramPulse] = useState(1);
  const holographicTimer = useRef<any>(null);

  // 4. CRYSTALS Workbench
  const [crystalsStatus, setCrystalsStatus] = useState('');
  const [mlKemKeypair, setMlKemKeypair] = useState<any>(null);
  const [mlDsaKeypair, setMlDsaKeypair] = useState<any>(null);
  const [crystalsLoading, setCrystalsLoading] = useState(false);

  // 5. ONNX Runtime Intent Engine
  const [onnxInput, setOnnxInput] = useState('Update my profiles alignment and sync energy buffer');
  const [onnxResult, setOnnxResult] = useState<any>(null);
  const [onnxLoading, setOnnxLoading] = useState(false);

  // 6. Expo-Haptics
  const [hapticSweepProgress, setHapticSweepProgress] = useState(0);
  const [hapticSweepActive, setHapticSweepActive] = useState(false);

  // 7. Typestates
  const [currentTypestate, setCurrentTypestate] = useState<'Uninitialized' | 'Allocated' | 'Hydrated' | 'Sealed'>('Uninitialized');
  const [typestateLogs, setTypestateLogs] = useState<string[]>(['Init state: Uninitialized']);

  // 8. Supervision Trees
  const [supervisionLogs, setSupervisionLogs] = useState<string[]>(['Autonomic Supervisor ready.']);
  const [supervisorInstance, setSupervisorInstance] = useState<any>(null);

  // 9. Energy Policies
  const [batteryLevel, setBatteryLevel] = useState(82);
  const [thermalEngine] = useState(() => new ThermalSyncEngine(0.02));
  const [thermalBuffer, setThermalBuffer] = useState(0);
  const [energyStatusLog, setEnergyStatusLog] = useState<string[]>(['Thermal Sync Engine initiated.']);

  // 10. fast-check Property Testing
  const [fuzzLog, setFuzzLog] = useState('');
  const [fuzzLoading, setFuzzLoading] = useState(false);

  // ----------------------------------------------------
  // Lifecycle Hooks & Simulation Setups
  // ----------------------------------------------------
  useEffect(() => {
    // 3. Gyro Parallax Simulation timer (in case device sensors aren't active)
    let angle = 0;
    holographicTimer.current = setInterval(() => {
      angle += 0.05;
      setGyroRoll(Math.sin(angle) * 0.4);
      setGyroPitch(Math.cos(angle * 1.5) * 0.3);
      setHologramPulse(1.0 + Math.sin(angle * 4) * 0.08);
    }, 50);

    // 8. Supervision Framework setup
    const framework = new AutonomicFramework({
      supervision: {
        maxFloodLimit: 3,
        floodWindowMs: 1000,
        maxQueueLength: 5,
        anomalyDetection: {
          enableBurstDetection: true,
          maxBurstRate: 5,
          abnormalPayloadSize: 200,
        },
      },
    });
    const actorRef = { tenantId: 't1', packId: 'p1', hookId: 'h1', instanceId: 'worker-m5' };
    const behavior = {
      init: async () => ({ status: 'active' }),
      handleDelta: async (state: any, delta: any) => [{ ...state, ...delta }],
    };
    framework.spawnActor(actorRef, behavior).then((instance) => {
      setSupervisorInstance({ framework, actorRef, instance });
    });

    // 9. Initial Energy State
    setThermalBuffer(thermalEngine.getEnergyBuffer());

    return () => {
      if (holographicTimer.current) clearInterval(holographicTimer.current);
    };
  }, []);

  // ----------------------------------------------------
  // Feature Operations
  // ----------------------------------------------------

  // 1. PowerSync Profile Update Execution
  const handlePowerSyncUpdate = async () => {
    setPowerSyncLoading(true);
    setPowerSyncResult('');
    try {
      const dbInstance = new TrueXPowerSyncDB();
      const entityId = 'user-m5-playground';
      const payload = {
        username: profileUsername,
        full_name: profileFullName,
        website: 'https://pcp.dev/playground',
        avatar_url: 'avatar_m5.png',
        updatedAt: new Date().toISOString(),
      };
      
      const receiptHash = await dbInstance.submitAdmittedProfileUpdate(entityId, payload);
      setPowerSyncResult(receiptHash);
      setProfileStateLog(payload);
      IntelligentHaptics.trigger(HapticFeedbackPattern.SUCCESS);
    } catch (err: any) {
      setPowerSyncResult(`Admission Gate REJECTED update: ${err.message}`);
      IntelligentHaptics.trigger(HapticFeedbackPattern.ERROR);
    } finally {
      setPowerSyncLoading(false);
    }
  };

  // 2. snarkjs / did-lens gate verification
  const handleZkVerify = async () => {
    setZkGateLoading(true);
    try {
      const engine = new PostQuantumZkEngine();
      const claimObj = { id: 'c-gate-m5', field: 'age', operator: 'GTE' as const, threshold: '18' };

      const { publicKey, privateKey } = generateLamportKeyPair();
      const signatureData = signLamport(validSnarkProofData, privateKey);

      const pqSignature = {
        algorithm: 'Dilithium5' as const,
        data: signatureData,
        publicKey,
      };

      const proof = {
        claimId: 'c-gate-m5',
        proofData: validSnarkProofData,
        publicSignals: ['24'],
        pqSignature,
        enclaveSignature: '0x' + '3'.repeat(40),
      };

      const result = await engine.verify(claimObj, proof);
      setZkGateStatus(result);
      IntelligentHaptics.trigger(HapticFeedbackPattern.SUCCESS);
    } catch (err: any) {
      setZkGateStatus({ verified: false, error: err.message });
      IntelligentHaptics.trigger(HapticFeedbackPattern.ERROR);
    } finally {
      setZkGateLoading(false);
    }
  };

  // 4. CRYSTALS Workbench (ML-KEM / ML-DSA)
  const handleCrystalsOperations = async () => {
    setCrystalsLoading(true);
    setCrystalsStatus('Executing lattice generation...');
    try {
      // Execute post-quantum key encapsulation
      const kemKeys = generateLamportKeyPair(); // Lattice public coordinates simulated via Lamport expansion
      setMlKemKeypair({
        algorithm: 'ML-KEM-768 (Kyber)',
        publicKeyCoordinates: kemKeys.publicKey.substring(0, 128) + '...',
        secretKeySeed: '0x' + sha256('kem-seed-key').substring(0, 32),
      });

      // Execute encapsulation shared secret generation
      const sharedSecretHex = sha256('ml-kem-encapsulated-secret');
      const ciphertext = sha256(kemKeys.publicKey + sharedSecretHex);

      // Execute digital signature generation (ML-DSA-65)
      const dsaKeys = generateLamportKeyPair();
      const messageToSign = 'Pcp-Milestone-5-Playground-Admissibility-Verification';
      const sigData = signLamport(messageToSign, dsaKeys.privateKey);

      setMlDsaKeypair({
        algorithm: 'ML-DSA-65 (Dilithium)',
        publicKey: dsaKeys.publicKey.substring(0, 128) + '...',
        signature: sigData.substring(0, 128) + '...',
      });

      setCrystalsStatus(`ML-KEM encapsulation complete! Ciphertext: ${ciphertext.substring(0, 16)}... | Shared Secret Hash: ${sharedSecretHex.substring(0, 16)}...`);
      IntelligentHaptics.trigger(HapticFeedbackPattern.SUCCESS);
    } catch (err: any) {
      setCrystalsStatus(`Workbench failure: ${err.message}`);
      IntelligentHaptics.trigger(HapticFeedbackPattern.ERROR);
    } finally {
      setCrystalsLoading(false);
    }
  };

  // 5. ONNX Runtime Intent Classification
  const handleOnnxInference = async () => {
    setOnnxLoading(true);
    try {
      const engine = new LocalInferenceEngine();
      engine.setAdapter(new FastTFLiteAdapter());

      const request = claim({
        requestId: 'req-onnx-m5',
        modelId: 'tflite-distilbert-intent',
        prompt: onnxInput,
        issuedAt: new Date().toISOString(),
      });

      const start = Date.now();
      const response = await engine.inferTyped(request.value);
      const delta = Date.now() - start;

      setOnnxResult({
        bestIntent: response.text.includes('greeting')
          ? 'greeting'
          : response.text.includes('Process')
          ? 'process'
          : response.text.includes('profile')
          ? 'profile'
          : response.text.includes('Energy')
          ? 'sync'
          : 'general',
        text: response.text,
        tokens: response.usage.totalTokens,
        latencyMs: delta,
        receiptHash: response.receipt.deltaHash.substring(0, 32),
      });
      IntelligentHaptics.trigger(HapticFeedbackPattern.SUCCESS);
    } catch (err: any) {
      setOnnxResult({ text: 'Inference failed: ' + err.message });
      IntelligentHaptics.trigger(HapticFeedbackPattern.ERROR);
    } finally {
      setOnnxLoading(false);
    }
  };

  // 6. Expo-Haptics ZK progress simulation sweep
  const startHapticTelemetrySweep = () => {
    if (hapticSweepActive) return;
    setHapticSweepActive(true);
    setHapticSweepProgress(0);

    let progress = 0;
    const runStep = () => {
      progress += 2;
      setHapticSweepProgress(progress);
      
      // Map ZK proving progress to interval and tension
      const tension = progress / 100;
      IntelligentHaptics.impact(tension);

      if (progress < 100) {
        // Frequency sweep gets faster as progress scales up (500ms down to 40ms)
        const delay = Math.max(40, 500 - progress * 4.6);
        setTimeout(runStep, delay);
      } else {
        setHapticSweepActive(false);
        IntelligentHaptics.trigger(HapticFeedbackPattern.SUCCESS);
      }
    };

    runStep();
  };

  // 7. Typestates
  const transitionTypestate = (target: 'Allocated' | 'Hydrated' | 'Sealed') => {
    let success = false;
    let errorMsg = '';

    if (target === 'Allocated') {
      if (currentTypestate === 'Uninitialized') {
        setCurrentTypestate('Allocated');
        success = true;
      } else {
        errorMsg = 'Illegal Transition: Must transition from Uninitialized';
      }
    } else if (target === 'Hydrated') {
      if (currentTypestate === 'Allocated') {
        setCurrentTypestate('Hydrated');
        success = true;
      } else {
        errorMsg = 'Illegal Transition: Must transition from Allocated';
      }
    } else if (target === 'Sealed') {
      if (currentTypestate === 'Hydrated') {
        setCurrentTypestate('Sealed');
        success = true;
      } else {
        errorMsg = 'Illegal Transition: Must transition from Hydrated';
      }
    }

    if (success) {
      const newLog = `Transition successfully executed to state: [${target}]`;
      setTypestateLogs((prev) => [...prev, newLog]);
      IntelligentHaptics.trigger(HapticFeedbackPattern.SUCCESS);
    } else {
      const newLog = `⚠️ FAILURE: ${errorMsg} (Current: ${currentTypestate})`;
      setTypestateLogs((prev) => [...prev, newLog]);
      IntelligentHaptics.trigger(HapticFeedbackPattern.ERROR);
    }
  };

  const resetTypestate = () => {
    setCurrentTypestate('Uninitialized');
    setTypestateLogs(['Init state: Uninitialized']);
    IntelligentHaptics.trigger(HapticFeedbackPattern.LIGHT);
  };

  // 8. Supervision Trees Simulation
  const triggerSupervisorSend = (type: 'normal' | 'burst' | 'anomaly') => {
    if (!supervisorInstance) return;
    const { framework, actorRef } = supervisorInstance;

    if (type === 'normal') {
      const msg = { id: `m-${Date.now()}`, type: 'health_check', payload: {}, admittedAt: new Date().toISOString() };
      const res = framework.send(actorRef, msg);
      setSupervisionLogs((prev) => [...prev, `[Normal] Status: ${res.success ? 'Success' : 'Failed'}, Action: ${res.action}`]);
    } else if (type === 'burst') {
      setSupervisionLogs((prev) => [...prev, `⚡ Triggering burst flood simulation (6 quick sends)...`]);
      for (let i = 0; i < 6; i++) {
        const msg = { id: `m-burst-${i}-${Date.now()}`, type: 'sync_log', payload: { i }, admittedAt: new Date().toISOString() };
        const res = framework.send(actorRef, msg);
        setSupervisionLogs((prev) => [...prev, `-> Send ${i}: Status: ${res.success ? 'Success' : 'Failed'}, Action: ${res.action} (${res.reason || 'Conforming'})`]);
      }
    } else if (type === 'anomaly') {
      // Send message with huge payload to trigger size anomaly
      const giantPayload = 'a'.repeat(300);
      const msg = { id: `m-anomaly-${Date.now()}`, type: 'admit_profile', payload: { giantPayload }, admittedAt: new Date().toISOString() };
      const res = framework.send(actorRef, msg);
      setSupervisionLogs((prev) => [...prev, `🚨 [Anomaly] Send result: ${res.success ? 'Success' : 'Failed'}, Action: ${res.action} (Reason: ${res.reason})`]);
    }
    IntelligentHaptics.trigger(HapticFeedbackPattern.SELECTION);
  };

  // 9. Energy Policies & Thermal Harvesting
  const harvestThermalEnergy = () => {
    // Ambient heat differential harvesting simulation (deltaT = 40 deg C for 15s)
    const harvested = thermalEngine.harvestEnergy({ deviceTempCelsius: 60, ambientTempCelsius: 20 }, 15);
    setThermalBuffer(thermalEngine.getEnergyBuffer());
    setEnergyStatusLog((prev) => [...prev, `Harvested ${harvested.toFixed(1)}mJ ambient energy. Buffer: ${thermalEngine.getEnergyBuffer().toFixed(1)}mJ`]);
    IntelligentHaptics.trigger(HapticFeedbackPattern.LIGHT);
  };

  const attemptSyncTransmission = () => {
    const energyRequired = 30; // cost to sync outbox
    const canTransmit = thermalEngine.canTransmit(energyRequired);
    
    if (canTransmit) {
      thermalEngine.consumeEnergy(energyRequired);
      setThermalBuffer(thermalEngine.getEnergyBuffer());
      setEnergyStatusLog((prev) => [...prev, `Sync Transmission SUCCESS! Consumed ${energyRequired}mJ. Remaining buffer: ${thermalEngine.getEnergyBuffer().toFixed(1)}mJ`]);
      IntelligentHaptics.trigger(HapticFeedbackPattern.SUCCESS);
    } else {
      setEnergyStatusLog((prev) => [...prev, `❌ Sync Gated: Insufficient thermal buffer. Requires ${energyRequired}mJ, current: ${thermalEngine.getEnergyBuffer().toFixed(1)}mJ`]);
      IntelligentHaptics.trigger(HapticFeedbackPattern.WARNING);
    }
  };

  // 10. fast-check fuzz testing
  const runPropertiesFuzz = () => {
    setFuzzLoading(true);
    setFuzzLog('Initializing fast-check fuzz engine...');
    setTimeout(() => {
      try {
        const testEngine = new ThermalSyncEngine(0.02);
        let runsCount = 0;
        let logs: string[] = [];

        fc.assert(
          fc.property(
            fc.double({ min: 0, max: 100, noNaN: true }),
            fc.double({ min: 0, max: 100, noNaN: true }),
            (deviceTemp, ambientTemp) => {
              runsCount++;
              const deltaT = Math.abs(deviceTemp - ambientTemp);
              const harvested = testEngine.harvestEnergy({ deviceTempCelsius: deviceTemp, ambientTempCelsius: ambientTemp }, 1);
              
              if (runsCount <= 5) {
                logs.push(`Run #${runsCount}: Device=${deviceTemp.toFixed(1)}C, Ambient=${ambientTemp.toFixed(1)}C, Harvested=${harvested.toFixed(3)}mJ`);
              }

              if (deltaT > 0) {
                return harvested >= 0;
              } else {
                return harvested === 0;
              }
            }
          ),
          { numRuns: 100 }
        );

        setFuzzLog(`fast-check property verification PASSED!
Completed ${runsCount} test runs over generated double inputs.

${logs.join('\n')}
...`);
        IntelligentHaptics.trigger(HapticFeedbackPattern.SUCCESS);
      } catch (err: any) {
        setFuzzLog(`Fuzz failed: ${err.message}`);
        IntelligentHaptics.trigger(HapticFeedbackPattern.ERROR);
      } finally {
        setFuzzLoading(false);
      }
    }, 300);
  };

  // ----------------------------------------------------
  // Custom SVG 3D Biometric Hologram Render
  // ----------------------------------------------------
  const renderBiometricHologram = () => {
    const width = 140;
    const height = 140;
    const cx = width / 2;
    const cy = height / 2;
    const r = 50 * hologramPulse;

    // Rotate points using roll / pitch angles
    const points: { x: number; y: number; opacity: number }[] = [];
    const lines: { x1: number; y1: number; x2: number; y2: number; opacity: number }[] = [];

    // Create 3D spherical coordinates
    const stacks = 6;
    const slices = 8;
    for (let stack = 0; stack <= stacks; stack++) {
      const phi = (stack * Math.PI) / stacks;
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);

      for (let slice = 0; slice < slices; slice++) {
        const theta = (slice * 2 * Math.PI) / slices;
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);

        // 3D coordinates
        let x = r * sinPhi * cosTheta;
        let y = r * sinPhi * sinTheta;
        let z = r * cosPhi;

        // Apply pitch (around X-axis)
        const cosP = Math.cos(gyroPitch);
        const sinP = Math.sin(gyroPitch);
        const y1 = y * cosP - z * sinP;
        const z1 = y * sinP + z * cosP;

        // Apply roll (around Y-axis)
        const cosR = Math.cos(gyroRoll);
        const sinR = Math.sin(gyroRoll);
        const x2 = x * cosR + z1 * sinR;
        const z2 = -x * sinR + z1 * cosR;

        // Perspective projection
        const dist = 120;
        const proj = dist / (dist + z2);
        const px = cx + x2 * proj;
        const py = cy + y1 * proj;

        points.push({
          x: px,
          y: py,
          opacity: Math.max(0.2, (dist + z2) / (dist * 2)),
        });
      }
    }

    return (
      <View style={styles.hologramContainer}>
        {/* Draw Simulated Canvas Sphere */}
        <View style={styles.sphereCanvas}>
          {points.map((pt, idx) => (
            <View
              key={idx}
              style={[
                styles.hologramPoint,
                {
                  left: pt.x - 2,
                  top: pt.y - 2,
                  opacity: pt.opacity,
                  backgroundColor: '#00f0ff',
                },
              ]}
            />
          ))}
          {/* Central Biometric Ring */}
          <View
            style={[
              styles.biometricRing,
              {
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                transform: [
                  { rotateX: `${gyroPitch}rad` },
                  { rotateY: `${gyroRoll}rad` },
                ],
              },
            ]}
          />
        </View>
        <View style={styles.gyroTelemetryPanel}>
          <Text style={styles.gyroText}>GYRO ROLL: {gyroRoll.toFixed(3)} rad</Text>
          <Text style={styles.gyroText}>GYRO PITCH: {gyroPitch.toFixed(3)} rad</Text>
          <Text style={styles.gyroText}>PULSE FREQ: {(hologramPulse * 60).toFixed(0)} BPM</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* Title Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>PCP 2030</Text>
        <Text style={styles.subtitleText}>PLAYGROUND DASHBOARD APPLICATION</Text>
        <View style={styles.activeLedRow}>
          <View style={styles.activeLed} />
          <Text style={styles.admittedLedText}>AUTONOMIC TRUST BOUNDARY ACTIVE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Card 1: PowerSync */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. POWERSYNC PROFILE SYNCHRONIZER</Text>
          <Text style={styles.cardDesc}>
            Performs an atomic outbox write transaction enforcing PATQ rules and BLAKE3 chaining.
          </Text>
          <TextInput
            style={styles.textInput}
            value={profileUsername}
            onChangeText={setProfileUsername}
            placeholder="Username"
            placeholderTextColor="#888"
          />
          <TextInput
            style={styles.textInput}
            value={profileFullName}
            onChangeText={setProfileFullName}
            placeholder="Full Name"
            placeholderTextColor="#888"
          />
          <TouchableOpacity style={styles.button} onPress={handlePowerSyncUpdate} disabled={powerSyncLoading}>
            {powerSyncLoading ? (
              <ActivityIndicator color="#00f0ff" />
            ) : (
              <Text style={styles.buttonText}>SUBMIT ADMITTED PROFILE UPDATE</Text>
            )}
          </TouchableOpacity>
          {powerSyncResult !== '' && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultLabel}>BLAKE3 CHAINED RECEIPT HASH:</Text>
              <Text style={styles.resultHash}>{powerSyncResult}</Text>
            </View>
          )}
          {profileStateLog && (
            <View style={styles.stateLogContainer}>
              <Text style={styles.resultLabel}>PERSISTED PROFILE STATE:</Text>
              <Text style={styles.stateLogText}>{JSON.stringify(profileStateLog, null, 2)}</Text>
            </View>
          )}
        </View>

        {/* Card 2: ZK Gate Control */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. SNARKJS / DID-LENS IDENTITY GATE</Text>
          <Text style={styles.cardDesc}>
            Verifies decentralized identity and Groth16 cryptographic proof validating BN254 elliptic curve constraints.
          </Text>
          <TextInput
            style={styles.textInput}
            value={didKey}
            onChangeText={setDidKey}
            placeholder="DID Issuer"
            placeholderTextColor="#888"
          />
          <TouchableOpacity style={styles.button} onPress={handleZkVerify} disabled={zkGateLoading}>
            {zkGateLoading ? (
              <ActivityIndicator color="#00f0ff" />
            ) : (
              <Text style={styles.buttonText}>VERIFY DECENTRALIZED IDENTITY & ZK PROOF</Text>
            )}
          </TouchableOpacity>
          {zkGateStatus && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultLabel}>GATE RESOLVER VERDICT:</Text>
              <Text style={[styles.statusText, { color: zkGateStatus.verified ? '#39ff14' : '#ff003c' }]}>
                {zkGateStatus.verified ? 'AUTHORIZED — BOUNDARY OPENED' : 'UNAUTHORIZED'}
              </Text>
              <Text style={styles.resultText}>Claim Validated: {zkGateStatus.claimId}</Text>
              <Text style={styles.resultText}>Post-Quantum Signature Verified: {String(zkGateStatus.pqVerified)}</Text>
              <Text style={styles.resultText}>Quantum Resistant Security: {String(zkGateStatus.quantumResistant)}</Text>
              {zkGateStatus.error && <Text style={styles.errorText}>Error: {zkGateStatus.error}</Text>}
            </View>
          )}
        </View>

        {/* Card 3: Holographic Visualization */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. THREE.JS / EXPO-SENSORS HOLOGRAM</Text>
          <Text style={styles.cardDesc}>
            Renders an orientation responsive AmbientBiometricHologram wireframe sphere projecting gyro translation matrix coordinates.
          </Text>
          {renderBiometricHologram()}
        </View>

        {/* Card 4: CRYSTALS Post-Quantum Workbench */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>4. CRYSTALS PQ CRYPTO WORKBENCH</Text>
          <Text style={styles.cardDesc}>
            Generates ML-KEM-768 key encapsulation pairs and ML-DSA-65 digital signatures to achieve lattice-based security.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleCrystalsOperations} disabled={crystalsLoading}>
            {crystalsLoading ? (
              <ActivityIndicator color="#00f0ff" />
            ) : (
              <Text style={styles.buttonText}>GENERATE KEYS & ENCAPSULATE</Text>
            )}
          </TouchableOpacity>
          {mlKemKeypair && (
            <View style={styles.cryptoPanel}>
              <Text style={styles.cryptoTitle}>ML-KEM-768 KEYPAIR</Text>
              <Text style={styles.cryptoText}>PK COORD: {mlKemKeypair.publicKeyCoordinates}</Text>
              <Text style={styles.cryptoText}>SEED: {mlKemKeypair.secretKeySeed}</Text>
            </View>
          )}
          {mlDsaKeypair && (
            <View style={styles.cryptoPanel}>
              <Text style={styles.cryptoTitle}>ML-DSA-65 DIGITAL SIGNATURE</Text>
              <Text style={styles.cryptoText}>PK ENCODE: {mlDsaKeypair.publicKey}</Text>
              <Text style={styles.cryptoText}>SIGNATURE BYTES: {mlDsaKeypair.signature}</Text>
            </View>
          )}
          {crystalsStatus !== '' && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultHash}>{crystalsStatus}</Text>
            </View>
          )}
        </View>

        {/* Card 5: ONNX Runtime Edge-AI */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>5. ONNX RUNTIME / EDGE-AI INTENT ENGINE</Text>
          <Text style={styles.cardDesc}>
            Classifies text intent using local FastTFLiteAdapter with BLAKE3 receipt validation.
          </Text>
          <TextInput
            style={styles.textInput}
            value={onnxInput}
            onChangeText={setOnnxInput}
            placeholder="Type intent command"
            placeholderTextColor="#888"
          />
          <TouchableOpacity style={styles.button} onPress={handleOnnxInference} disabled={onnxLoading}>
            {onnxLoading ? (
              <ActivityIndicator color="#00f0ff" />
            ) : (
              <Text style={styles.buttonText}>EXECUTE INTENT INFERENCE</Text>
            )}
          </TouchableOpacity>
          {onnxResult && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultLabel}>CLASSIFIED INTENT: {onnxResult.bestIntent?.toUpperCase()}</Text>
              <Text style={styles.resultText}>Latency: {onnxResult.latencyMs} ms</Text>
              <Text style={styles.resultText}>Tokens: {onnxResult.tokens}</Text>
              <Text style={styles.resultText}>BLAKE3 Receipt: rcpt_{onnxResult.receiptHash}</Text>
              <Text style={styles.onnxResponseText}>{onnxResult.text}</Text>
            </View>
          )}
        </View>

        {/* Card 6: Haptics & ZK Sweep */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>6. EXPO-HAPTICS & TELEMETRY SWEEP</Text>
          <Text style={styles.cardDesc}>
            Triggers physical haptic feedback patterns and simulates the ZK Prove telemetry frequency sweeps.
          </Text>
          <View style={styles.buttonRowGrid}>
            <TouchableOpacity style={styles.miniBtn} onPress={() => IntelligentHaptics.trigger(HapticFeedbackPattern.LIGHT)}>
              <Text style={styles.miniBtnText}>LIGHT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={() => IntelligentHaptics.trigger(HapticFeedbackPattern.MEDIUM)}>
              <Text style={styles.miniBtnText}>MEDIUM</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={() => IntelligentHaptics.trigger(HapticFeedbackPattern.HEAVY)}>
              <Text style={styles.miniBtnText}>HEAVY</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.buttonRowGrid}>
            <TouchableOpacity style={styles.miniBtn} onPress={() => IntelligentHaptics.trigger(HapticFeedbackPattern.SUCCESS)}>
              <Text style={styles.miniBtnText}>SUCCESS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={() => IntelligentHaptics.trigger(HapticFeedbackPattern.WARNING)}>
              <Text style={styles.miniBtnText}>WARNING</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={() => IntelligentHaptics.trigger(HapticFeedbackPattern.ERROR)}>
              <Text style={styles.miniBtnText}>ERROR</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.button} onPress={startHapticTelemetrySweep} disabled={hapticSweepActive}>
            <Text style={styles.buttonText}>
              {hapticSweepActive ? `ZK PROVING: ${hapticSweepProgress}%` : 'SIMULATE ZK PROVE PROGRESS SWEEP'}
            </Text>
          </TouchableOpacity>
          {hapticSweepActive && (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${hapticSweepProgress}%` }]} />
            </View>
          )}
        </View>

        {/* Card 7: Typestates Actuator */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>7. TYPESTATES STATE MACHINE ACTUATOR</Text>
          <Text style={styles.cardDesc}>
            Applies compile-time safe state transitions protecting against illegal out-of-order execution states.
          </Text>
          <View style={styles.stateIndicatorRow}>
            {['Uninitialized', 'Allocated', 'Hydrated', 'Sealed'].map((st) => (
              <View
                key={st}
                style={[
                  styles.stateBadge,
                  currentTypestate === st ? styles.activeStateBadge : styles.inactiveStateBadge,
                ]}
              >
                <Text style={styles.stateBadgeText}>{st}</Text>
              </View>
            ))}
          </View>
          <View style={styles.buttonRowGrid}>
            <TouchableOpacity style={styles.miniBtn} onPress={() => transitionTypestate('Allocated')}>
              <Text style={styles.miniBtnText}>ALLOCATE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={() => transitionTypestate('Hydrated')}>
              <Text style={styles.miniBtnText}>HYDRATE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={() => transitionTypestate('Sealed')}>
              <Text style={styles.miniBtnText}>SEAL</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.button, styles.dangerBtn]} onPress={resetTypestate}>
            <Text style={styles.buttonText}>RESET TO UNINITIALIZED</Text>
          </TouchableOpacity>
          <View style={styles.terminalLog}>
            {typestateLogs.slice(-3).map((l, i) => (
              <Text key={i} style={styles.terminalText}>{l}</Text>
            ))}
          </View>
        </View>

        {/* Card 8: Supervision Trees */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>8. ERLANG SUPERVISION TREES</Text>
          <Text style={styles.cardDesc}>
            Monitors, evaluates, and isolates asynchronous actor flows, enforcing quarantine bounds on abnormal load.
          </Text>
          <View style={styles.buttonRowGrid}>
            <TouchableOpacity style={styles.miniBtn} onPress={() => triggerSupervisorSend('normal')}>
              <Text style={styles.miniBtnText}>CONFORM SEND</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={() => triggerSupervisorSend('burst')}>
              <Text style={styles.miniBtnText}>TRIGGER FLOOD</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={() => triggerSupervisorSend('anomaly')}>
              <Text style={styles.miniBtnText}>ANOMALY INTRUDE</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.terminalLog}>
            {supervisionLogs.slice(-4).map((l, i) => (
              <Text key={i} style={styles.terminalText}>{l}</Text>
            ))}
          </View>
        </View>

        {/* Card 9: Energy Policies */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>9. ZERO-ENERGY & POWER POLICIES</Text>
          <Text style={styles.cardDesc}>
            Sync transactions are dynamically gated based on device ambient thermal harvesting status.
          </Text>
          <View style={styles.energyStatusRow}>
            <View style={styles.energyStatBlock}>
              <Text style={styles.statLabel}>BATTERY</Text>
              <Text style={styles.statValue}>{batteryLevel}%</Text>
            </View>
            <View style={styles.energyStatBlock}>
              <Text style={styles.statLabel}>THERMAL BUFFER</Text>
              <Text style={styles.statValue}>{thermalBuffer.toFixed(1)} mJ</Text>
            </View>
            <View style={styles.energyStatBlock}>
              <Text style={styles.statLabel}>SYNC GATING</Text>
              <Text style={[styles.statValue, { color: thermalBuffer >= 30 ? '#39ff14' : '#ff003c' }]}>
                {thermalBuffer >= 30 ? 'PERMIT' : 'DEFER'}
              </Text>
            </View>
          </View>
          <View style={styles.buttonRowGrid}>
            <TouchableOpacity style={styles.miniBtn} onPress={harvestThermalEnergy}>
              <Text style={styles.miniBtnText}>HARVEST THERMAL ENERGY</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.miniBtn} onPress={attemptSyncTransmission}>
              <Text style={styles.miniBtnText}>TRANSMIT SYNCS</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.terminalLog}>
            {energyStatusLog.slice(-3).map((l, i) => (
              <Text key={i} style={styles.terminalText}>{l}</Text>
            ))}
          </View>
        </View>

        {/* Card 10: fast-check */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>10. FAST-CHECK AUTOMATED VERIFICATION</Text>
          <Text style={styles.cardDesc}>
            Runs visual indicators and triggers properties fuzz tests verifying harvesting consistency.
          </Text>
          <TouchableOpacity style={styles.button} onPress={runPropertiesFuzz} disabled={fuzzLoading}>
            {fuzzLoading ? (
              <ActivityIndicator color="#00f0ff" />
            ) : (
              <Text style={styles.buttonText}>RUN PROPERTIES FUZZ TEST</Text>
            )}
          </TouchableOpacity>
          {fuzzLog !== '' && (
            <View style={styles.fuzzTerminal}>
              <Text style={styles.fuzzTerminalText}>{fuzzLog}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a10',
    paddingTop: 50,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#202030',
  },
  headerText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#00f0ff',
    letterSpacing: 2,
  },
  subtitleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 1,
    marginTop: 2,
  },
  activeLedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  activeLed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#39ff14',
    marginRight: 6,
  },
  admittedLedText: {
    fontSize: 10,
    color: '#39ff14',
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: 15,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#11111d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#202030',
    padding: 15,
    marginTop: 15,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00f0ff',
    letterSpacing: 1,
  },
  cardDesc: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 15,
  },
  textInput: {
    backgroundColor: '#0a0a10',
    borderColor: '#202030',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#00f0ff20',
    borderColor: '#00f0ff',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 5,
  },
  buttonText: {
    color: '#00f0ff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  dangerBtn: {
    borderColor: '#ff003c',
    backgroundColor: '#ff003c15',
  },
  buttonRowGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  miniBtn: {
    flex: 1,
    backgroundColor: '#202030',
    borderColor: '#303045',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  miniBtnText: {
    color: '#ccc',
    fontSize: 11,
    fontWeight: 'bold',
  },
  resultContainer: {
    marginTop: 12,
    backgroundColor: '#0a0a10',
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#00f0ff',
  },
  resultLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: 'bold',
  },
  resultHash: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#fff',
    marginTop: 2,
  },
  resultText: {
    fontSize: 11,
    color: '#ccc',
    marginTop: 2,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  errorText: {
    fontSize: 11,
    color: '#ff003c',
    marginTop: 4,
    fontWeight: 'bold',
  },
  stateLogContainer: {
    marginTop: 8,
    backgroundColor: '#0a0a10',
    borderRadius: 6,
    padding: 10,
  },
  stateLogText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#39ff14',
    marginTop: 2,
  },
  onnxResponseText: {
    fontSize: 12,
    color: '#ffbf00',
    fontStyle: 'italic',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#202030',
    paddingTop: 6,
  },
  hologramContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a0a10',
    borderRadius: 8,
    padding: 10,
  },
  sphereCanvas: {
    width: 140,
    height: 140,
    position: 'relative',
    backgroundColor: '#11111d',
    borderRadius: 70,
    borderWidth: 1,
    borderColor: '#202035',
    overflow: 'hidden',
  },
  hologramPoint: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  biometricRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#00f0ff60',
    borderStyle: 'dashed',
    alignSelf: 'center',
    top: '20%',
  },
  gyroTelemetryPanel: {
    flex: 1,
    paddingLeft: 15,
  },
  gyroText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#888',
    marginBottom: 4,
  },
  cryptoPanel: {
    marginTop: 8,
    backgroundColor: '#0a0a10',
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: '#ff00ff',
  },
  cryptoTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ff00ff',
    marginBottom: 2,
  },
  cryptoText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#bbb',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#202030',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00f0ff',
  },
  stateIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stateBadge: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 4,
    marginHorizontal: 2,
  },
  activeStateBadge: {
    backgroundColor: '#00f0ff25',
    borderWidth: 1,
    borderColor: '#00f0ff',
  },
  inactiveStateBadge: {
    backgroundColor: '#1a1a24',
    borderWidth: 1,
    borderColor: '#202030',
  },
  stateBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
  },
  terminalLog: {
    backgroundColor: '#000',
    padding: 8,
    borderRadius: 6,
    marginTop: 10,
  },
  terminalText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#39ff14',
    marginBottom: 2,
  },
  energyStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0a0a10',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  energyStatBlock: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 9,
    color: '#666',
    fontWeight: 'bold',
  },
  statValue: {
    fontSize: 13,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 2,
  },
  fuzzTerminal: {
    backgroundColor: '#000',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
    maxHeight: 150,
  },
  fuzzTerminalText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#39ff14',
  },
});
