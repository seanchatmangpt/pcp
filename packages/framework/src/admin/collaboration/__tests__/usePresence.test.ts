import { renderHook, act } from '@testing-library/react-native';
import { usePresence } from '../usePresence';

describe('usePresence', () => {
  const mockUser = { id: 'user-1', name: 'Test User' };
  const mockChannelId = 'test-channel';

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize and log a warning', () => {
    const { result } = renderHook(() => usePresence({ channelId: mockChannelId, user: mockUser }));

    expect(console.warn).toHaveBeenCalledWith(
      'usePresence is stubbed and requires a real implementation'
    );
  });

  it('should simulate setting local user presence', () => {
    const onSync = jest.fn();
    const { result } = renderHook(() =>
      usePresence({ channelId: mockChannelId, user: mockUser, onSync })
    );

    expect(result.current.users.length).toBe(1);
    expect(result.current.users[0]).toEqual(mockUser);

    // onSync is called synchronously in the stub
    expect(onSync).toHaveBeenCalledWith({ [mockUser.id]: [mockUser] });
  });
});
