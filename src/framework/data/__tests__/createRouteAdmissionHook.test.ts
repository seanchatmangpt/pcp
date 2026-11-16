import { renderHook } from '@testing-library/react-native';
import { createRouteAdmissionHook, RouteAdmissionConfig } from '../auth/createRouteAdmissionHook';
import { RouteDefinition, ParticipantBasis, IdentityBoundary } from '../../../route-law/types';

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
});
