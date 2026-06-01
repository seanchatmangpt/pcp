import { AccessibilityInfo, findNodeHandle } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { useFocusTrap } from '../hooks/useFocusTrap';

// Standard mock for react-native
jest.mock('react-native', () => {
  return {
    AccessibilityInfo: {
      setAccessibilityFocus: jest.fn(),
    },
    findNodeHandle: jest.fn(() => 123),
    Platform: { OS: 'ios' },
  };
});

describe('useFocusTrap', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls AccessibilityInfo.setAccessibilityFocus when active', () => {
    const ref = { current: {} };
    renderHook(() => useFocusTrap(ref as any, true, { delay: 10 }));

    jest.runAllTimers();

    expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith(123);
  });

  it('does not call AccessibilityInfo.setAccessibilityFocus when inactive', () => {
    const ref = { current: {} };
    renderHook(() => useFocusTrap(ref as any, false, { delay: 10 }));

    jest.runAllTimers();

    expect(AccessibilityInfo.setAccessibilityFocus).not.toHaveBeenCalled();
  });
});
