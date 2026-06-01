import React from 'react';
import { render, act } from '@testing-library/react-native';
import { TransitionOverlay } from '../TransitionOverlay';

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return {
    ...Reanimated,
    useSharedValue: jest.fn(() => ({ value: 0 })),
    useAnimatedStyle: jest.fn((cb) => cb()),
    withTiming: jest.fn((val, config, cb) => {
      if (cb) cb(true);
      return val;
    }),
    withSpring: jest.fn((val) => val),
    runOnJS: jest.fn((fn) => fn),
    cancelAnimation: jest.fn(),
  };
});

describe('TransitionOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when not visible', () => {
    const { toJSON } = render(
      <TransitionOverlay isTransitioning={false} transitionType={null} colorScheme="light" />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders correctly when transitioning to signin in light mode', () => {
    const { getByText } = render(
      <TransitionOverlay isTransitioning={true} transitionType="signin" colorScheme="light" />
    );
    expect(getByText('Welcome back!')).toBeTruthy();
    expect(getByText('Securing session & preparing your workspace')).toBeTruthy();
  });

  it('renders correctly when transitioning to signout in dark mode', () => {
    const { getByText } = render(
      <TransitionOverlay isTransitioning={true} transitionType="signout" colorScheme="dark" />
    );
    expect(getByText('Signing out...')).toBeTruthy();
    expect(getByText('Clearing session cache & returning to login')).toBeTruthy();
  });

  it('handles transition state change from true to false', () => {
    const { getByText, rerender } = render(
      <TransitionOverlay isTransitioning={true} transitionType="signin" colorScheme="light" />
    );
    expect(getByText('Welcome back!')).toBeTruthy();

    rerender(
      <TransitionOverlay isTransitioning={false} transitionType="signin" colorScheme="light" />
    );

    // In our mock withTiming, callback is called immediately so visible becomes false.
    // wait for JS queue
    act(() => {});
  });
});
