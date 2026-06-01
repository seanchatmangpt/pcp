import { renderHook } from '@testing-library/react-native';
import { createRouteAdmissionHook, RouteAdmissionConfig } from '../auth/createRouteAdmissionHook';
type RouteDefinition = any;
type ParticipantBasis = any;
type IdentityBoundary = any;

describe('createRouteAdmissionHook', () => {
  const mockRoute: RouteDefinition = {
    path: '/secret',
    visibility: 'private',
    states: {
      must_be_active: true,
      roles_allowed: ['admin'],
    },
  } as any;

  const mockDefaultResolveParticipant = jest.fn();
  const mockAdmitRoute = jest.fn();
  const mockDefaultHierarchy: IdentityBoundary[] = [];

  const createConfig = (sessionReturn: any): RouteAdmissionConfig => ({
    useSession: jest.fn().mockReturnValue(sessionReturn),
    defaultResolveParticipant: mockDefaultResolveParticipant,
    defaultHierarchy: mockDefaultHierarchy,
    admitRoute: mockAdmitRoute,
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns loading state if session is loading and no explicit participant provided', () => {
    const config = createConfig({ session: null, loading: true });
    const useMyRouteAdmission = createRouteAdmissionHook(config);

    const { result } = renderHook(() => useMyRouteAdmission(mockRoute));

    expect(result.current.loading).toBe(true);
    expect(result.current.admitted).toBe(false);
    expect(mockAdmitRoute).not.toHaveBeenCalled();
  });

  it('returns loading state if session is transitioning and no explicit participant provided', () => {
    const config = createConfig({ session: null, loading: false, isTransitioning: true });
    const useMyRouteAdmission = createRouteAdmissionHook(config);

    const { result } = renderHook(() => useMyRouteAdmission(mockRoute));

    expect(result.current.loading).toBe(true);
    expect(result.current.admitted).toBe(false);
    expect(mockAdmitRoute).not.toHaveBeenCalled();
  });

  it('evaluates admission if session is loaded', () => {
    const mockSession = { user: 'test' };
    const mockParticipant: ParticipantBasis = { auth_state: 'authenticated' } as any;

    const config = createConfig({ session: mockSession, loading: false });
    mockDefaultResolveParticipant.mockReturnValue(mockParticipant);
    mockAdmitRoute.mockReturnValue({ admitted: true });

    const useMyRouteAdmission = createRouteAdmissionHook(config);
    const { result } = renderHook(() => useMyRouteAdmission(mockRoute));

    expect(result.current.loading).toBe(false);
    expect(result.current.admitted).toBe(true);
    expect(result.current.refusal).toBeUndefined();

    expect(mockDefaultResolveParticipant).toHaveBeenCalledWith(mockSession);
    expect(mockAdmitRoute).toHaveBeenCalledWith(mockParticipant, mockRoute, mockDefaultHierarchy);
  });

  it('uses explicit participant if provided, bypassing loading state', () => {
    const config = createConfig({ session: null, loading: true }); // even if loading
    const useMyRouteAdmission = createRouteAdmissionHook(config);

    const explicitParticipant: ParticipantBasis = { auth_state: 'authenticated' } as any;
    mockAdmitRoute.mockReturnValue({
      admitted: false,
      refusal: { code: 'FORBIDDEN', label: 'Forbidden' },
    });

    const { result } = renderHook(() =>
      useMyRouteAdmission(mockRoute, { participant: explicitParticipant })
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.admitted).toBe(false);
    expect(result.current.refusal).toEqual({ code: 'FORBIDDEN', label: 'Forbidden' });

    expect(mockDefaultResolveParticipant).not.toHaveBeenCalled();
    expect(mockAdmitRoute).toHaveBeenCalledWith(
      explicitParticipant,
      mockRoute,
      mockDefaultHierarchy
    );
  });

  it('uses custom options if provided', () => {
    const mockSession = { user: 'test' };
    const config = createConfig({ session: mockSession, loading: false });

    const customResolver = jest.fn().mockReturnValue({ auth_state: 'authenticated' });
    const customHierarchy: IdentityBoundary[] = [{ type: 'custom' } as any];
    mockAdmitRoute.mockReturnValue({ admitted: true });

    const useMyRouteAdmission = createRouteAdmissionHook(config);
    renderHook(() =>
      useMyRouteAdmission(mockRoute, {
        resolveParticipant: customResolver,
        hierarchy: customHierarchy,
      })
    );

    expect(customResolver).toHaveBeenCalledWith(mockSession);
    expect(mockDefaultResolveParticipant).not.toHaveBeenCalled();
    expect(mockAdmitRoute).toHaveBeenCalledWith(
      { auth_state: 'authenticated' },
      mockRoute,
      customHierarchy
    );
  });
});
