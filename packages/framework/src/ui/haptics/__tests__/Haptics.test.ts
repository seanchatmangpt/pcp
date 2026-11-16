import { Vibration } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { IntelligentHaptics, HapticFeedbackPattern } from '../IntelligentHaptics';
import { useHaptics, useHapticEffect } from '../useHaptics';

// Mock react-native Vibration
jest.mock('react-native', () => ({
  Vibration: {
    vibrate: jest.fn(),
  },
  Platform: {
    OS: 'ios',
  },
}));

describe('Consolidated Haptics Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    IntelligentHaptics.setEnabled(true);
  });

  describe('IntelligentHaptics Core', () => {
    it('should trigger SUCCESS haptics', () => {
      IntelligentHaptics.trigger(HapticFeedbackPattern.SUCCESS);
      expect(Vibration.vibrate).toHaveBeenCalledWith([0, 10, 50, 10]);
    });

    it('should trigger WARNING haptics', () => {
      IntelligentHaptics.trigger(HapticFeedbackPattern.WARNING);
      expect(Vibration.vibrate).toHaveBeenCalledWith([0, 20, 100, 20]);
    });

    it('should trigger ERROR haptics', () => {
      IntelligentHaptics.trigger(HapticFeedbackPattern.ERROR);
      expect(Vibration.vibrate).toHaveBeenCalledWith([0, 50, 100, 50, 100, 60]);
    });
  });

  describe('useHaptics hook', () => {
    it('should provide trigger functions', () => {
      const { result } = renderHook(() => useHaptics());

      act(() => {
        result.current.success();
      });
      expect(Vibration.vibrate).toHaveBeenCalledWith([0, 10, 50, 10]);

      act(() => {
        result.current.error();
      });
      expect(Vibration.vibrate).toHaveBeenCalledWith([0, 50, 100, 50, 100, 60]);

      act(() => {
        result.current.warning();
      });
      expect(Vibration.vibrate).toHaveBeenCalledWith([0, 20, 100, 20]);

      act(() => {
        result.current.light();
      });
      expect(Vibration.vibrate).toHaveBeenCalledWith(10);

      act(() => {
        result.current.medium();
      });
      expect(Vibration.vibrate).toHaveBeenCalledWith(20);

      act(() => {
        result.current.heavy();
      });
      expect(Vibration.vibrate).toHaveBeenCalledWith(40);

      act(() => {
        result.current.selection();
      });
      expect(Vibration.vibrate).toHaveBeenCalledWith(5);

      act(() => {
        result.current.impact(0.5);
      });
      expect(Vibration.vibrate).toHaveBeenCalledWith(10);
    });
  });

  describe('useHapticEffect hook', () => {
    it('should trigger haptics when dependency changes', () => {
      const { rerender } = renderHook(
        (props: any) =>
          useHapticEffect(props.dep, HapticFeedbackPattern.SUCCESS, { skipFirst: false }),
        { initialProps: { dep: 0 } }
      );

      expect(Vibration.vibrate).toHaveBeenCalledWith([0, 10, 50, 10]);
      jest.clearAllMocks();

      rerender({ dep: 1 });
      expect(Vibration.vibrate).toHaveBeenCalledWith([0, 10, 50, 10]);
    });

    it('should skip first trigger by default', () => {
      renderHook((props: any) => useHapticEffect(props.dep, HapticFeedbackPattern.SUCCESS), {
        initialProps: { dep: 0 },
      });

      expect(Vibration.vibrate).not.toHaveBeenCalled();
    });
  });
});
