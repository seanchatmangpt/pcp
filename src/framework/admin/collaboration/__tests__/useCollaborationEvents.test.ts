import { renderHook, act } from '@testing-library/react-native';
import { useCollaborationEvents } from '../useCollaborationEvents';

describe('useCollaborationEvents', () => {
  const mockChannelId = 'test-channel';
  const mockEventType = 'cursor';

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize and log a warning', () => {
    renderHook(() =>
      useCollaborationEvents({
        channelId: mockChannelId,
        eventType: mockEventType,
      })
    );

    expect(console.warn).toHaveBeenCalledWith('useCollaborationEvents is stubbed');
  });

  it('should broadcast an event with a warning', () => {
    const { result } = renderHook(() =>
      useCollaborationEvents({
        channelId: mockChannelId,
        eventType: mockEventType,
      })
    );

    act(() => {
      result.current.broadcast('user-1', { x: 10, y: 20 });
    });

    expect(console.warn).toHaveBeenCalledWith('broadcast is stubbed', 'user-1', { x: 10, y: 20 });
  });
});
