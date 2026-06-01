type RouteDefinition = any;
type RefusalReason = any;
type ParticipantBasis = any;
type IdentityBoundary = any;

export interface UseRouteAdmissionOptions {
  /** Optional custom resolver to convert the raw session to a ParticipantBasis */
  resolveParticipant?: (session: any) => ParticipantBasis;
  /** Optional custom identity hierarchy list */
  hierarchy?: readonly IdentityBoundary[];
  /** Optional explicit participant basis to bypass default useSession resolution */
  participant?: ParticipantBasis;
}

export interface UseRouteAdmissionResult {
  /** True if the user meets all gating conditions of the route */
  admitted: boolean;
  /** Detailed reason why admission was denied, if applicable */
  refusal?: RefusalReason;
  /** True if the underlying session check is still loading */
  loading: boolean;
}

export interface RouteAdmissionConfig {
  useSession: () => { session: any; loading: boolean; isTransitioning?: boolean };
  defaultResolveParticipant: (session: any) => ParticipantBasis;
  defaultHierarchy: readonly IdentityBoundary[];
  admitRoute: (
    participant: ParticipantBasis,
    route: RouteDefinition,
    hierarchy: readonly IdentityBoundary[]
  ) => { admitted: boolean; refusal?: RefusalReason };
}

/**
 * Factory to create a specialized useRouteAdmission hook injected with
 * application-specific session contexts and route law logic.
 */
export function createRouteAdmissionHook(config: RouteAdmissionConfig) {
  return function useRouteAdmission(
    route: RouteDefinition,
    options?: UseRouteAdmissionOptions
  ): UseRouteAdmissionResult {
    const { session, loading, isTransitioning = false } = config.useSession();

    const hierarchy = options?.hierarchy ?? config.defaultHierarchy;
    const resolver = options?.resolveParticipant ?? config.defaultResolveParticipant;

    // Use explicit participant if provided, otherwise resolve from session context
    const activeParticipant = options?.participant ?? resolver(session);

    // If session state is still loading or transitioning and no explicit participant override is present, defer check
    if ((loading || isTransitioning) && !options?.participant) {
      return {
        admitted: false,
        loading: true,
      };
    }

    const checkResult = config.admitRoute(activeParticipant, route, hierarchy);

    return {
      admitted: checkResult.admitted,
      refusal: checkResult.refusal,
      loading: false,
    };
  };
}
