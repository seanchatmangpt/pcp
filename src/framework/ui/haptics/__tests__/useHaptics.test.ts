import { renderHook, act } from '@testing-library/react-native';
import { useHaptics, useHapticEffect, useTensionHaptics } from '../useHaptics';
import { IntelligentHaptics, HapticFeedbackPattern } from '../IntelligentHaptics';

jest.mock('../IntelligentHaptics', () => ({
  IntelligentHaptics: {
    trigger: jest.fn(),
    impact: jest.fn(),
  },
  HapticFeedbackPattern: {
    SUCCESS: 'SUCCESS',
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    LIGHT: 'LIGHT',
    MEDIUM: 'MEDIUM',
    HEAVY: 'HEAVY',
    SELECTION: 'SELECTION',
  },
}));

describe('useHaptics hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useHaptics', () => {
    it('should provide trigger functions', () => {
      const { result } = renderHook(() => useHaptics());

      act(() => {
        result.current.success();
      });
      expect(IntelligentHaptics.trigger).toHaveBeenCalledWith(HapticFeedbackPattern.SUCCESS);

      act(() => {
        result.current.error();
      });
      expect(IntelligentHaptics.trigger).toHaveBeenCalledWith(HapticFeedbackPattern.ERROR);

      act(() => {
        result.current.warning();
      });
      expect(IntelligentHaptics.trigger).toHaveBeenCalledWith(HapticFeedbackPattern.WARNING);

      act(() => {
        result.current.light();
      });
      expect(IntelligentHaptics.trigger).toHaveBeenCalledWith(HapticFeedbackPattern.LIGHT);

      act(() => {
        result.current.medium();
      });
      expect(IntelligentHaptics.trigger).toHaveBeenCalledWith(HapticFeedbackPattern.MEDIUM);

      act(() => {
        result.current.heavy();
      });
      expect(IntelligentHaptics.trigger).toHaveBeenCalledWith(HapticFeedbackPattern.HEAVY);

      act(() => {
        result.current.selection();
      });
      expect(IntelligentHaptics.trigger).toHaveBeenCalledWith(HapticFeedbackPattern.SELECTION);

      act(() => {
        result.current.impact(0.5);
      });
      expect(IntelligentHaptics.impact).toHaveBeenCalledWith(0.5);
    });
  });

  describe('useHapticEffect', () => {
    it('should trigger haptics when dependency changes', () => {
      const { rerender } = renderHook(
        (props: any) =>
          useHapticEffect(props.dep, HapticFeedbackPattern.SUCCESS, { skipFirst: false }),
        { initialProps: { dep: 0 } }
      );

      expect(IntelligentHaptics.trigger).toHaveBeenCalledWith(HapticFeedbackPattern.SUCCESS);
      jest.clearAllMocks();

      rerender({ dep: 1 });
      expect(IntelligentHaptics.trigger).toHaveBeenCalledWith(HapticFeedbackPattern.SUCCESS);
    });

    it('should skip first trigger by default', () => {
      renderHook((props: any) => useHapticEffect(props.dep, HapticFeedbackPattern.SUCCESS), {
        initialProps: { dep: 0 },
      });

      expect(IntelligentHaptics.trigger).not.toHaveBeenCalled();
    });
  });

  describe('useTensionHaptics', () => {
    it('should trigger impact when crossing thresholds', () => {
      const { result } = renderHook(() => useTensionHaptics());

      act(() => {
        result.current(0.2); // Light threshold
      });
      expect(IntelligentHaptics.impact).toHaveBeenCalledWith(0.2);
      jest.clearAllMocks();

      act(() => {
        result.current(0.3); // Same threshold range
      });
      expect(IntelligentHaptics.impact).not.toHaveBeenCalled();

      act(() => {
        result.current(0.6); // Medium threshold
      });
      expect(IntelligentHaptics.impact).toHaveBeenCalledWith(0.6);
      jest.clearAllMocks();

      act(() => {
        result.current(0.95); // Heavy threshold
      });
      expect(IntelligentHaptics.impact).toHaveBeenCalledWith(0.95);
    });

    it('should not trigger impact when decreasing tension', () => {
      const { result } = renderHook(() => useTensionHaptics());

      act(() => {
        result.current(0.95);
      });
      expect(IntelligentHaptics.impact).toHaveBeenCalledTimes(1);
      jest.clearAllMocks();

      act(() => {
        result.current(0.6);
      });
      expect(IntelligentHaptics.impact).not.toHaveBeenCalled();
    });
  });
});
