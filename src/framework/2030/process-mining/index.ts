/**
 * Barrel file exporting the Pcp 2030 Process Mining components.
 * Resolves naming conflicts (e.g. PetriNet, Arc, ReplayResult) across submodules.
 *
 * Ref: [conformance.test.ts](file:///Users/sac/pcpapp/src/framework/2030/process-mining/__tests__/conformance.test.ts)
 */

// 1. Petri Net Core
export { TokenReplayEngine } from './petri-net';

// 2. OCEL 2.0 (Object-Centric Event Log)
export {
  Ocel2Attribute,
  Ocel2AttributeValue,
  Ocel2Relationship,
  Ocel2Event as SchemaOcel2Event,
  Ocel2Object as SchemaOcel2Object,
  Ocel2LogData,
  Ocel2Log,
  createOCEL2Event,
  createOCEL2Object,
  emitOCEL2Log,
  parseOCEL2Log,
} from './ocel';

// 3. Conformance Checking
export {
  Place,
  Transition,
  Ocel2Event as ConformanceOcel2Event,
  Ocel2Object as ConformanceOcel2Object,
  Ocel2Log as ConformanceOcel2Log,
  ConformanceReport,
  Ocel2LogBuilder as ConformanceOcel2LogBuilder,
  parseOcel2Log,
  extractTracesFromOcel2,
  replayTrace as conformanceReplayTrace,
  checkConformance,
  fuzzTrace as conformanceFuzzTrace,
  fuzzOcelLog as conformanceFuzzOcelLog,
} from './conformance';

// 4. Fuzzer
export {
  fuzzTraceSkip,
  fuzzTraceSwap,
  fuzzTraceInsert,
  fuzzTraceDuplicate,
  generateFuzzedDeviations,
} from './fuzzer';

// 5. Concept Drift Detection (Dr. Wil van der Aalst AGI Doctrine)
export {
  OCEL2Event,
  OCEL2Object,
  OCEL2Log,
  PetriNetPlace,
  PetriNetTransition,
  PetriNetArc,
  PetriNet as DriftDetectorPetriNet,
  Marking as DriftDetectorMarking,
  createAgentNativePetriNet,
  DEFAULT_ACTIVITY_TO_TRANSITION_MAP,
  TokenReplayChecker,
  RunningStats,
  ConceptDriftDetector,
  DriftAlert,
} from './drift-detector';

// 6. OCEL 2.0 Logger
export {
  OcelObject as Ocel2LoggerObject,
  OcelEvent as Ocel2LoggerEvent,
  OcelLog as Ocel2LoggerLog,
  PetriNetTransitionSchema,
  AGENT_PETRI_NET as LOGGER_AGENT_PETRI_NET,
  AgentExecutionTrace,
  generateLog,
  parseOcelLog,
  CaseConformanceResult as LoggerCaseConformanceResult,
  ConformanceReport as LoggerConformanceReport,
  checkConformance as loggerCheckConformance,
  MutationType,
  fuzzLog,
} from './ocel2-logger';

// 7. Profiler
export { ConformanceChecker, OcelFuzzer, runBenchmark } from './profiler';

// 8. Safety Constraints
export {
  PetriNetReplayer as SafetyPetriNetReplayer,
  TemporalSafetyChecker,
  LogFuzzer as SafetyLogFuzzer,
  OCEL2Serializer as SafetyOCEL2Serializer,
} from './safety-constraints';

// 9. Adversarial Fuzzer
export {
  Deviation as AdversarialDeviation,
  CaseConformanceResult as AdversarialCaseConformanceResult,
  ConformanceReport as AdversarialConformanceReport,
  checkConformance as adversarialCheckConformance,
  replayTrace as adversarialReplayTrace,
  extractTraces as adversarialExtractTraces,
  FUZZ_SCENARIOS,
  generateFuzzedOcelLog,
} from './adversarial-fuzzer';
