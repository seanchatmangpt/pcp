/* Generated compile-time TypeScript type definitions (WASM Boundary Law) */

/**
 * TypeScript projection for the core Evidence typestate wrapper.
 */
export type EvidenceTs<T, State, Witness> = { value: T; _state: State; _witness: Witness }

/**
 * TypeScript projection for the core EvidenceState lifecycle tokens.
 */
export type EvidenceState = "Raw" | "Parsed" | "Admitted" | "Refused" | "Projected" | "Exportable" | "Receipted"

/**
 * TypeScript projection for the Witness markers.
 */
export type WitnessKey = "Ocel20" | "Xes1849" | "WfNetSoundnessPaper" | "Dec20" | "Pmax24"

/**
 * TypeScript projection for the Admitted typestate boundary.
 */
export type AdmissionTs<T, Witness> = { value: T; admitted_at_ns: number; _witness: Witness }

/**
 * TypeScript projection for the Refused typestate boundary.
 */
export type RefusalTs<Reason, Witness> = { law_name: string; message: string; _reason: Reason; _witness: Witness }

/**
 * TypeScript projection for the LossPolicy options.
 */
export type LossPolicyTs = "RefuseLoss" | "AllowNamedProjection" | "AllowLossWithReport"

/**
 * TypeScript projection for the LossReport structure.
 */
export type LossReportTs<From, To, Items> = { projection_name: string; policy: LossPolicyTs; items_dropped: Items; _from: From; _to: To }

/**
 * TypeScript projection for the ReceiptShape.
 */
export type ReceiptShapeTs = { case_id: string; process_hash: string; parent_block_hash: string; block_hash: string; timestamp_ns: number; fitness: number }

/**
 * TypeScript projection for the GraduationCandidate.
 */
export type GraduationCandidateTs = { reason: string; subject: string; evidence_ref: string }

/**
 * Branding tag for OCEL logs in the TypeScript type court.
 */
export type OcelBrand = null

/**
 * Branding tag for XES logs in the TypeScript type court.
 */
export type XesBrand = null

/**
 * Branding tag for WF-Net soundness in the TypeScript type court.
 */
export type WfNetBrand = null

/**
 * TypeScript projection for OCEL attribute value.
 */
export type OcelAttributeValueTs = { type: "String"; value: string } | { type: "Integer"; value: BigInt } | { type: "Float"; value: number } | { type: "Boolean"; value: boolean } | { type: "TimestampNs"; value: BigInt } | { type: "List"; value: OcelAttributeValueTs[] } | { type: "Map"; value: ([string, OcelAttributeValueTs])[] }

/**
 * TypeScript projection for OCEL attribute.
 */
export type OcelAttributeTs = { key: string; value: OcelAttributeValueTs }

/**
 * TypeScript projection for OCEL object.
 */
export type OcelObjectTs = { id: string; object_type: string; attributes: OcelAttributeTs[] }

/**
 * TypeScript projection for OCEL event.
 */
export type OcelEventTs = { id: string; activity: string; timestamp_ns: BigInt | null; attributes: OcelAttributeTs[] }

/**
 * TypeScript projection for Event-Object link.
 */
export type EventObjectLinkTs = { event_id: string; object_id: string; qualifier: string | null }

/**
 * TypeScript projection for Object-Object link.
 */
export type ObjectObjectLinkTs = { source_id: string; target_id: string; qualifier: string | null }

/**
 * TypeScript projection for Object change.
 */
export type ObjectChangeTs = { object_id: string; attribute: string; value: string; timestamp_ns: BigInt | null }

/**
 * TypeScript projection for OcelLog.
 */
export type OcelLogTs = { objects: OcelObjectTs[]; events: OcelEventTs[]; e2o: EventObjectLinkTs[]; o2o: ObjectObjectLinkTs[]; changes: ObjectChangeTs[] }

/**
 * TypeScript projection for Case-centric Event.
 */
export type Event = { activity: string; timestamp_ns: BigInt | null; resource: string | null; lifecycle: string | null }

/**
 * TypeScript projection for Case-centric Trace.
 */
export type Trace = { case_id: string; events: Event[] }

/**
 * TypeScript projection for Case-centric EventLog.
 */
export type EventLog = { traces: Trace[] }

/**
 * TypeScript projection for WitnessFamily.
 */
export type WitnessFamily = "Standard" | "Paper" | "ApiGrammar" | "RustLaw" | "InternalBridge"

/**
 * TypeScript projection for WitnessMetadata.
 */
export type WitnessMetadata = { key: string; family: WitnessFamily; title: string; year: number | null }

/**
 * TypeScript projection for EventLogRefusal.
 */
export type EventLogRefusal = "MissingCaseId" | "MissingActivity" | "MissingTimestamp" | "EmptyTrace" | "NonMonotonicTrace" | "DuplicateEvent" | "InvalidLifecycle"

/**
 * TypeScript projection for OcelRefusal.
 */
export type OcelRefusal = "MissingObject" | "MissingEvent" | "EmptyEventObjectLinks" | "DanglingEventObjectLink" | "DanglingObjectObjectLink" | "DuplicateObjectId" | "DuplicateEventId" | "FlatteningLoss" | "MissingObjectType" | "InvalidObjectChange"

/**
 * TypeScript projection for ConformanceRefusal.
 */
export type ConformanceRefusal = "MissingLog" | "MissingModel" | "MissingDeviationPath" | "FitnessUnavailable" | "PrecisionUnavailable" | "F1Unavailable" | "GeneralizationUnavailable" | "SimplicityUnavailable"

export type BpmnGatewayTs = "Exclusive" | "Parallel" | "Inclusive" | "EventBased" | "Complex"

export type BpmnEventTs = "Start" | "Intermediate" | "End" | "Boundary"

export type BpmnTaskTs = { name: string }

export type BpmnNodeKindTs = { type: "Task"; value: BpmnTaskTs } | { type: "Gateway"; value: BpmnGatewayTs } | { type: "Event"; value: BpmnEventTs }

export type BpmnNodeTs = { id: string; kind: BpmnNodeKindTs }

export type BpmnEdgeTs = { source: string; target: string }

export type BpmnProcessTs = { nodes: BpmnNodeTs[]; edges: BpmnEdgeTs[] }

export type BpmnRefusalTs = "EmptyProcess" | "DuplicateNodeId" | "MissingStartEvent" | "MissingEndEvent" | "DanglingEdge" | "MalformedGateway" | "DisconnectedNode" | "LaneNodeNotDeclared"

export type ProcessTreeOperatorTs = "Sequence" | "Xor" | "Parallel" | "Loop" | "Silent" | "Or"

export type ProcessTreeNodeIdTs = BigInt

export type ProcessTreeNodeTs = { type: "Activity"; value: string } | { type: "Operator"; value: { operator: ProcessTreeOperatorTs; children: ProcessTreeNodeIdTs[] } }

export type ProcessTreeTs = { nodes: ProcessTreeNodeTs[]; root: ProcessTreeNodeIdTs | null }

export type ProcessTreeRefusalTs = "InvalidArity" | "InvalidLoop" | "UnsupportedProjection" | "LanguageMismatch" | "TauLeafWithChildren" | "MissingRoot" | "DanglingNodeReference" | "BelowMinimumArity" | "CycleDetected"

export type ArcDirectionTs = "PlaceToTransition" | "TransitionToPlace"

export type PlaceTs = { id: string }

export type TransitionTs = { id: string; label: string }

export type ArcTs = { place_id: string; transition_id: string; direction: ArcDirectionTs; weight: number; object_type: string | null; variable: boolean }

export type MarkingTs = { tokens: ([string, number])[] }

export type InitialFinalMarkingPairTs = { initial: MarkingTs; final_marking: MarkingTs }

export type PetriNetTs = { places: PlaceTs[]; transitions: TransitionTs[]; arcs: ArcTs[]; initial: MarkingTs }

export type PetriRefusalTs = "MissingInitialMarking" | "MissingFinalMarking" | "DeadTransition" | "UnsafeNet" | "UnboundedNet" | "ObjectTypeNotPreserved" | "InvalidVariableArc" | "SoundnessNotWitnessed" | "InvalidCancellationRegion" | "InvalidInstanceBounds"

export type ActivityTs = string

export type DeclareTemplateTs = "Existence" | "Absence" | "Init" | "Existence2" | "Existence3" | "Absence2" | "Absence3" | "RespondedExistence" | "CoExistence" | "Response" | "Precedence" | "Succession" | "AlternateResponse" | "AlternatePrecedence" | "AlternateSuccession" | "ChainResponse" | "ChainPrecedence" | "ChainSuccession" | "NotCoExistence" | "NotSuccession" | "NotChainSuccession" | "ExclusiveChoice"

export type DeclareScopeTs = { SingleObjectScope: string } | { MultiObjectScope: string[] } | { SynchronizedObjectScope: string[] }

export type DeclareConstraintTs = { template: DeclareTemplateTs; activation: ActivityTs; target: ActivityTs | null; scope: DeclareScopeTs }

export type DeclareRefusalTs = "MissingActivation" | "MissingTarget" | "InvalidTemplateArity" | "EmptyObjectScope" | "SynchronizationViolation"

export type DfgNodeTs = { activity: string }

export type DfgEdgeTs = { from: string; to: string; weight: BigInt }

export type DfgTs = { nodes: DfgNodeTs[]; edges: DfgEdgeTs[] }

export type DfgRefusalTs = "MissingActivity" | "NegativeWeight" | "DanglingEdge" | "EmptyGraph" | "DiscoveryRequired" | "InconsistentObjectType"

export type PowlNodeIdTs = BigInt

export type OrderEdgeTs = { from: PowlNodeIdTs; to: PowlNodeIdTs }

export type ChoiceGraphEdgeTs = { from: PowlNodeIdTs; to: PowlNodeIdTs }

export type PowlNodeKindTs = { type: "Atom"; value: string } | { type: "Silent" } | { type: "Choice"; value: PowlNodeIdTs[] } | { type: "Loop"; value: { body: PowlNodeIdTs; redo: PowlNodeIdTs | null } } | { type: "PartialOrder"; value: PowlNodeIdTs[] } | { type: "ChoiceGraph"; value: { nodes: PowlNodeIdTs[]; edges: ChoiceGraphEdgeTs[] } }

export type PowlNodeTs = { id: PowlNodeIdTs; kind: PowlNodeKindTs }

export type PowlTs = { nodes: PowlNodeTs[]; edges: OrderEdgeTs[]; root: PowlNodeIdTs | null }

export type PowlRefusalTs = { type: "CyclicPartialOrder" } | { type: "InvalidChoice" } | { type: "InvalidChoiceArity"; value: { declared: BigInt; required_min: BigInt } } | { type: "InvalidLoop" } | { type: "LoopMissingDoBody" } | { type: "IrreducibleProjection" } | { type: "LanguageMismatch" } | { type: "ChoiceGraphDisconnected" }

export type CausalBindingTs = { source_tasks: string[]; target_tasks: string[] }

export type CausalNetTs = { nodes: string[]; dependency_measures: ([string, string, number])[]; inputs: CausalBindingTs[]; outputs: CausalBindingTs[] }

export type CausalNetRefusalTs = "MissingActivity" | "InvalidDependencyScore" | "DisconnectedGraph"

export type CausalLinkTs = { from_event_id: string; to_event_id: string; qualifier: string | null }

export type CausalChainTs = { links: CausalLinkTs[] }

export type CausalConsistencyTs = "Consistent" | "HasCycles" | "HasContradictions" | "Unknown"

export type CorrelationSchemaTs = "ByCase" | "ByObject" | "ByTimestamp" | "ByAttribute"

export type CorrelationKeyTs = { schema: CorrelationSchemaTs; attribute_name: string | null }

export type CorrelatedLogTs = { correlation_key: CorrelationKeyTs; matched_event_pairs: ([string, string])[] }

export type ProcessPerspectiveTs = "ControlFlow" | "Data" | "Resource" | "Time"

export type PerspectiveRefusalTs = "MissingDimension" | "PerspectiveNotSupported"

export type CubeDimensionKindTs = "Activity" | "Resource" | "Time" | "DataAttribute" | "ObjectType" | "CaseAttribute"

export type CubeSliceTs = { dimension: string; value: string }

export type CubeCellTs = { slices: CubeSliceTs[] }

export type ProcessCubeTs = { dimensions: CubeDimensionKindTs[]; cells: CubeCellTs[] }

export type ProcessCubeRefusalTs = "DimensionMismatch" | "CellUnreachable"

export type EventWindowTs = { events: string[]; size: BigInt }

export type StreamingRefusalTs = "WindowOverflow" | "OutOfOrderArrival" | "SourceDisconnected"

export type TemporalOrderTs = "Before" | "After" | "Concurrent" | "Unknown"

export type TemporalProfileTs = { relations: ([string, string, TemporalOrderTs])[] }

export type TemporalRefusalTs = "ClockDriftDetected" | "NonMonotonicTimestamps"

export type WorkflowBranchStateTs = "Pending" | "Running" | "Completed" | "Canceled"

export type BranchTokenTs = { branch_id: string; state: WorkflowBranchStateTs }

export type ParallelWorkflowTs = { workflow_id: string; branches: BranchTokenTs[] }

export type WorkflowRefusalTs = "InvalidJoinPoint" | "MissingStartBranch" | "DuplicateBranchToken"

export type ObjectLifecyclePhaseTs = "Created" | "Active" | "Modified" | "Archived" | "Deleted"

export type ObjectStateTs = { object_id: string; phase: ObjectLifecyclePhaseTs }

export type ObjectLifecycleTs = { object_id: string; phase_history: ObjectStateTs[] }

export type LifecycleRefusalTs = "UnlawfulTransition" | "DuplicatePhaseEntry"

export type PredictionHorizonTs = "FullCase" | { Events: BigInt } | { TimeUnits: BigInt }

export type ComplianceKindTs = "Monitoring" | "Audit" | "Certification"

export type PredictionTargetTs = "NextActivity" | "OutcomeLabel" | "RemainingTime" | "DriftSignal" | "Risk" | "ComplianceConstraint"

export type PredictionProblemTs = { prefix: string[]; target: PredictionTargetTs; horizon: BigInt | null }

export type PredictionRefusalTs = "MissingPrefix" | "MissingTarget" | "EmptyPrefix" | "TargetUnsupported" | "NonPrefixTrace" | "ConstraintNotNamed"

export type DiagnosticSeverityTs = "Error" | "Warning" | "Info"

export type CompatDiagnosticTs = "MissingWitness" | "MissingRoundTripFixture" | "RawEvidenceExportedAsAdmitted" | "LossyProjectionWithoutPolicy" | "HiddenFlattening" | "MissingRefusalPath" | "MissingReceiptShape" | "UnreachablePrimitive" | "MigrationRecommended"

export type OcpqScopeKindTs = "Open" | "Closed" | "SingleType"

export type EventPredicateKindTs = "ActivityEquals" | "AttributeEquals" | "TimestampInRange"

export type ObjectPredicateKindTs = "AttributeEquals" | "TypeEquals"

export type RelationPredicateKindTs = "E2O" | "O2O" | "TimeBetweenEvents"

export type PredicateKindTs = { Event: string } | { Object: string } | { Relation: string } | { Temporal: string } | { Cardinality: { min: BigInt; max: BigInt } } | { Nested: BigInt } | { E2ORelation: { event_var: string; object_var: string; qualifier: string | null } } | { O2ORelation: { object_var1: string; object_var2: string; qualifier: string | null } } | { TimeBetweenEvents: { event_var1: string; event_var2: string; t_min: BigInt; t_max: BigInt } } | { ChildSetBound: { branch_label: string; min: BigInt; max: BigInt } }

export type ObjectScopeTs = { object_types: string[] }

export type PredicateTs = { kind: PredicateKindTs }

export type OcpqQueryTs = { scope: ObjectScopeTs; predicates: PredicateTs[]; sub_queries: OcpqQueryTs[] }

export type OcpqRefusalTs = "MissingObjectScope" | "UnknownObjectType" | "UnknownEventType" | "InvalidCardinality" | "UnsafeProjection" | "FlatteningRequired" | "InvalidChildSetBound" | "EmptyScopeType" | "ConflictingPredicateKinds" | "UnboundVariable"