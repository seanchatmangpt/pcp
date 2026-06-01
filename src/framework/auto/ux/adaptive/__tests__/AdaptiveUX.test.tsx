import React from 'react';
import { render, renderHook, fireEvent } from '@testing-library/react-native';
import { AdaptiveInteractionWrapper, useAdaptiveInteraction } from '../AdaptiveInteractionWrapper';
import { AdaptivePressable } from '../AdaptivePressable';
import { useAdaptiveAnimation } from '../AdaptiveAnimation';
import { useBehavioralAuth } from '../../../../auth/behavioral/useBehavioralAuth';
import { useAppVitals } from '../../../../admin/metrics/useAppVitals';
import { useHaptics } from '../../../../ui/haptics/useHaptics';
import { HapticFeedbackPattern } from '../../../../ui/haptics/IntelligentHaptics';
import { Text } from 'react-native';

// Mock the hooks
jest.mock('../../../../auth/behavioral/useBehavioralAuth');
jest.mock('../../../../admin/metrics/useAppVitals');
jest.mock('../../../../ui/haptics/useHaptics');

const mockUseBehavioralAuth = useBehavioralAuth as jest.Mock;
const mockUseAppVitals = useAppVitals as jest.Mock;
const mockUseHaptics = useHaptics as jest.Mock;

describe('AdaptiveInteraction (AutoUX)', () => {
  const mockTrigger = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseHaptics.mockReturnValue({ trigger: mockTrigger });
  });

  it('should provide default values when trust is high and FPS is optimal', () => {
    mockUseBehavioralAuth.mockReturnValue({ trustScore: 1.0 });
    mockUseAppVitals.mockReturnValue({ jsFps: 60, uiFps: 60 });

    const { result } = renderHook(() => useAdaptiveInteraction(), {
      wrapper: ({ children }) => (
        <AdaptiveInteractionWrapper>{children}</AdaptiveInteractionWrapper>
      ),
    });

    expect(result.current.trustScore).toBe(1.0);
    expect(result.current.fps).toBe(60);
    expect(result.current.hitSlop).toBe(10); // baseHitSlop * 1.0 * 1.0
    expect(result.current.hapticProfile).toBe(HapticFeedbackPattern.SELECTION);
    expect(result.current.animationSpeedScale).toBe(1.0);
  });

  it('should increase hitSlop and slow animations when FPS is low', () => {
    mockUseBehavioralAuth.mockReturnValue({ trustScore: 1.0 });
    mockUseAppVitals.mockReturnValue({ jsFps: 20, uiFps: 20 });

    const { result } = renderHook(() => useAdaptiveInteraction(), {
      wrapper: ({ children }) => (
        <AdaptiveInteractionWrapper>{children}</AdaptiveInteractionWrapper>
      ),
    });

    expect(result.current.fps).toBe(20);
    expect(result.current.hitSlop).toBe(25); // baseHitSlop(10) * trust(1.0) * fps(2.5)
    expect(result.current.animationSpeedScale).toBe(1.5);
    expect(result.current.hapticProfile).toBe(HapticFeedbackPattern.MEDIUM);
  });

  it('should decrease hitSlop and use heavy haptics when trust is low', () => {
    mockUseBehavioralAuth.mockReturnValue({ trustScore: 0.2 });
    mockUseAppVitals.mockReturnValue({ jsFps: 60, uiFps: 60 });

    const { result } = renderHook(() => useAdaptiveInteraction(), {
      wrapper: ({ children }) => (
        <AdaptiveInteractionWrapper>{children}</AdaptiveInteractionWrapper>
      ),
    });

    expect(result.current.trustScore).toBe(0.2);
    // trustModifier = 0.5 + (0.2 * 0.5) = 0.6
    // hitSlop = 10 * 0.6 * 1.0 = 6
    expect(result.current.hitSlop).toBe(6);
    expect(result.current.hapticProfile).toBe(HapticFeedbackPattern.HEAVY);
  });

  it('should compound adjustments when both trust and FPS are low', () => {
    mockUseBehavioralAuth.mockReturnValue({ trustScore: 0.2 });
    mockUseAppVitals.mockReturnValue({ jsFps: 20, uiFps: 20 });

    const { result } = renderHook(() => useAdaptiveInteraction(), {
      wrapper: ({ children }) => (
        <AdaptiveInteractionWrapper>{children}</AdaptiveInteractionWrapper>
      ),
    });

    // trustModifier = 0.6
    // fpsModifier = 2.5
    // hitSlop = 10 * 0.6 * 2.5 = 15
    expect(result.current.hitSlop).toBe(15);
    expect(result.current.hapticProfile).toBe(HapticFeedbackPattern.HEAVY);
    expect(result.current.animationSpeedScale).toBe(1.5);
  });

  it('AdaptivePressable should apply adaptive hitSlop and trigger haptics', () => {
    mockUseBehavioralAuth.mockReturnValue({ trustScore: 0.5 });
    mockUseAppVitals.mockReturnValue({ jsFps: 60, uiFps: 60 });

    const { getByTestId } = render(
      <AdaptiveInteractionWrapper>
        <AdaptivePressable testID="pressable" onPress={() => {}}>
          <Text>Press Me</Text>
        </AdaptivePressable>
      </AdaptiveInteractionWrapper>
    );

    const pressable = getByTestId('pressable');

    // trustScore 0.5 -> trustModifier 0.75 -> hitSlop 7.5 -> rounded 8
    expect(pressable.props.hitSlop).toEqual({ top: 8, bottom: 8, left: 8, right: 8 });

    // Simulate press
    fireEvent(pressable, 'pressIn');
    expect(mockTrigger).toHaveBeenCalledWith(HapticFeedbackPattern.LIGHT); // trustScore 0.5 < 0.8
  });

  it('useAdaptiveAnimation should return scaled animation functions', () => {
    mockUseBehavioralAuth.mockReturnValue({ trustScore: 1.0 });
    mockUseAppVitals.mockReturnValue({ jsFps: 20, uiFps: 20 }); // Low FPS -> 1.5x scale

    const { result } = renderHook(() => useAdaptiveAnimation(), {
      wrapper: ({ children }) => (
        <AdaptiveInteractionWrapper>{children}</AdaptiveInteractionWrapper>
      ),
    });

    expect(result.current.animationSpeedScale).toBe(1.5);

    // We can't easily test withSpring/withTiming directly as they are worklets/native calls,
    // but we've verified the scale factor is correct.
  });
});
