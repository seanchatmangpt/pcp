import React from 'react';
import { Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { PinchToZoom } from '../PinchToZoom';

// Mock gesture handler to capture callbacks
let pinchUpdateCallback: (event: any) => void;
let pinchEndCallback: (event: any) => void;
let panUpdateCallback: (event: any) => void;
let panEndCallback: (event: any) => void;
let tapStartCallback: (event: any) => void;

jest.mock('react-native-gesture-handler', () => {
  return {
    Gesture: {
      Pan: jest.fn().mockImplementation(() => {
        const mockPan: any = {};
        mockPan.onUpdate = jest.fn().mockImplementation((cb) => {
          panUpdateCallback = cb;
          return mockPan;
        });
        mockPan.onEnd = jest.fn().mockImplementation((cb) => {
          panEndCallback = cb;
          return mockPan;
        });
        return mockPan;
      }),
      Pinch: jest.fn().mockImplementation(() => {
        const mockPinch: any = {};
        mockPinch.onUpdate = jest.fn().mockImplementation((cb) => {
          pinchUpdateCallback = cb;
          return mockPinch;
        });
        mockPinch.onEnd = jest.fn().mockImplementation((cb) => {
          pinchEndCallback = cb;
          return mockPinch;
        });
        return mockPinch;
      }),
      Tap: jest.fn().mockImplementation(() => {
        const mockTap: any = {};
        mockTap.numberOfTaps = jest.fn().mockReturnValue(mockTap);
        mockTap.enabled = jest.fn().mockReturnValue(mockTap);
        mockTap.onStart = jest.fn().mockImplementation((cb) => {
          tapStartCallback = cb;
          return mockTap;
        });
        return mockTap;
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

describe('PinchToZoom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children correctly', () => {
    const { getByText } = render(
      <PinchToZoom>
        <Text>Zoom Me</Text>
      </PinchToZoom>
    );
    expect(getByText('Zoom Me')).toBeTruthy();
  });

  it('handles pinch update', () => {
    render(
      <PinchToZoom>
        <Text>Zoom Me</Text>
      </PinchToZoom>
    );

    act(() => {
      pinchUpdateCallback({ scale: 2, focalX: 100, focalY: 100 });
    });
  });

  it('handles pinch end', () => {
    render(
      <PinchToZoom>
        <Text>Zoom Me</Text>
      </PinchToZoom>
    );

    act(() => {
      pinchEndCallback({});
    });
  });

  it('handles pan update when zoomed', () => {
    render(
      <PinchToZoom>
        <Text>Zoom Me</Text>
      </PinchToZoom>
    );

    // Simulate zoom first
    act(() => {
      pinchUpdateCallback({ scale: 2, focalX: 100, focalY: 100 });
    });

    act(() => {
      panUpdateCallback({ translationX: 50, translationY: 50 });
    });
  });

  it('handles double tap to reset zoom', () => {
    render(
      <PinchToZoom>
        <Text>Zoom Me</Text>
      </PinchToZoom>
    );

    // Zoom in
    act(() => {
      pinchUpdateCallback({ scale: 2, focalX: 100, focalY: 100 });
    });

    // Tap to reset
    act(() => {
      tapStartCallback({});
    });
  });

  it('handles double tap to zoom in when at min scale', () => {
    render(
      <PinchToZoom>
        <Text>Zoom Me</Text>
      </PinchToZoom>
    );

    // Tap to zoom in
    act(() => {
      tapStartCallback({});
    });
  });
});
