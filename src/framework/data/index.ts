/**
 * @fileoverview Data Framework API
 * Contains abstractions for declarative data fetching, Semantic Node bindings,
 * and routing admission control.
 */

// VKG / Semantic Hooks
export * from './vkg/useSemanticNode';
export * from './vkg/createSemanticHook';
export * from './vkg/usePaginatedSemanticNode';

// Fetching / Data Utilities
export * from './fetching/useOptimisticMutation';
export * from './fetching/useSuspenseQuery';

// Auth / Route Admission
export * from './auth/createRouteAdmissionHook';
