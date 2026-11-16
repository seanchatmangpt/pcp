import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { VoiceCommandBoundary } from '../VoiceCommandBoundary';
import { useVoiceIntent } from '../useVoiceIntent';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <VoiceCommandBoundary>{children}</VoiceCommandBoundary>
);

describe('useVoiceIntent', () => {
  it('registers and unregisters intents', async () => {
    const { result, unmount } = renderHook(() => useVoiceIntent(), { wrapper });

    const action = jest.fn();
    const intent = { id: 'test', commands: ['hello'], action };

    act(() => {
      result.current.registerIntents([intent]);
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.triggerIntent('hello');
    });

    expect(success).toBe(true);
    expect(action).toHaveBeenCalled();

    unmount();
  });

  it('handles fuzzy matching', async () => {
    const { result } = renderHook(() => useVoiceIntent(), { wrapper });
    const action = jest.fn();

    act(() => {
      result.current.registerIntents([{ id: 'test', commands: ['Go home'], action }]);
    });

    await act(async () => {
      await result.current.triggerIntent('go home now');
    });

    expect(action).toHaveBeenCalled();
  });

  it('handles priority', async () => {
    const { result } = renderHook(() => useVoiceIntent(), { wrapper });
    const actionLow = jest.fn();
    const actionHigh = jest.fn();

    act(() => {
      result.current.registerIntents([
        { id: 'low', commands: ['test'], action: actionLow, priority: 0 },
        { id: 'high', commands: ['test'], action: actionHigh, priority: 10 },
      ]);
    });

    await act(async () => {
      await result.current.triggerIntent('test');
    });

    expect(actionHigh).toHaveBeenCalled();
    expect(actionLow).not.toHaveBeenCalled();
  });
});
