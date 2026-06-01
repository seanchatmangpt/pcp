import React from 'react';
import { View, Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { SwipeToDismiss } from '../SwipeToDismiss';

// Mock gesture handler to capture callbacks
let panUpdateCallback: (event: any) => void;
let panEndCallback: (event: any) => void;

jest.mock('react-native-gesture-handler', () => {
  const mockPan = {
    enabled: jest.fn().mockReturnThis(),
    onUpdate: jest.fn().mockImplementation((cb) => {
      panUpdateCallback = cb;
      return mockPan;
    }),
    onEnd: jest.fn().mockImplementation((cb) => {
      panEndCallback = cb;
      return mockPan;
    }),
    runOnJS: jest.fn().mockReturnThis(),
  };

  return {
    Gesture: {
      Pan: jest.fn(() => mockPan),
      Pinch: jest.fn().mockReturnValue({
        onUpdate: jest.fn().mockReturnThis(),
        onEnd: jest.fn().mockReturnThis(),
      }),
      Tap: jest.fn().mockReturnValue({
        numberOfTaps: jest.fn().mockReturnThis(),
        enabled: jest.fn().mockReturnThis(),
        onStart: jest.fn().mockReturnThis(),
      }),
      Simultaneous: jest.fn().mockImplementation((...args) => args),
    },
    GestureDetector: ({ children }: any) => children,
    GestureHandlerRootView: ({ children }: any) => children,
  };
});

// Mock reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return {
    ...Reanimated,
    useSharedValue: jest.fn((val) => ({ value: val })),
    useAnimatedStyle: jest.fn((cb) => cb()),
    withSpring: jest.fn((val) => val),
    withTiming: jest.fn((val, config, cb) => {
      if (cb) cb(true);
      return val;
    }),
    runOnJS: jest.fn((fn) => fn),
  };
});

describe('SwipeToDismiss', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children correctly', () => {
    const { getByText } = render(
      <SwipeToDismiss>
        <Text>Swipe Me</Text>
      </SwipeToDismiss>
    );
    expect(getByText('Swipe Me')).toBeTruthy();
  });

  it('handles horizontal swipe update', () => {
    render(
      <SwipeToDismiss directions={['right']}>
        <Text>Swipe Me</Text>
      </SwipeToDismiss>
    );

    act(() => {
      panUpdateCallback({ translationX: 100, translationY: 0 });
    });
  });

  it('handles vertical swipe update', () => {
    render(
      <SwipeToDismiss directions={['down']}>
        <Text>Swipe Me</Text>
      </SwipeToDismiss>
    );

    act(() => {
      panUpdateCallback({ translationX: 0, translationY: 100 });
    });
  });

  it('triggers onDismiss when threshold is met (right)', () => {
    const onDismissMock = jest.fn();
    render(
      <SwipeToDismiss directions={['right']} onDismiss={onDismissMock} threshold={0.1}>
        <Text>Swipe Me</Text>
      </SwipeToDismiss>
    );

    act(() => {
      panEndCallback({ translationX: 1000, translationY: 0 });
    });

    expect(onDismissMock).toHaveBeenCalled();
  });

  it('triggers onSwipeCancel when threshold is NOT met', () => {
    const onSwipeCancelMock = jest.fn();
    render(
      <SwipeToDismiss onSwipeCancel={onSwipeCancelMock} threshold={0.5}>
        <Text>Swipe Me</Text>
      </SwipeToDismiss>
    );

    act(() => {
      panEndCallback({ translationX: 10, translationY: 0 });
    });

    expect(onSwipeCancelMock).toHaveBeenCalled();
  });

  it('handles resistance for unauthorized directions', () => {
    render(
      <SwipeToDismiss directions={['right']}>
        <Text>Swipe Me</Text>
      </SwipeToDismiss>
    );

    act(() => {
      panUpdateCallback({ translationX: -100, translationY: 100 });
    });
  });
});
