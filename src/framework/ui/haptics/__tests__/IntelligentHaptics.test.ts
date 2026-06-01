import { Vibration } from 'react-native';
import { IntelligentHaptics, HapticFeedbackPattern } from '../IntelligentHaptics';

jest.mock('react-native', () => ({
  Vibration: {
    vibrate: jest.fn(),
  },
  Platform: {
    OS: 'ios',
  },
}));

describe('IntelligentHaptics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    IntelligentHaptics.setEnabled(true);
  });

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

  it('should trigger LIGHT haptics', () => {
    IntelligentHaptics.trigger(HapticFeedbackPattern.LIGHT);
    expect(Vibration.vibrate).toHaveBeenCalledWith(10);
  });

  it('should trigger MEDIUM haptics', () => {
    IntelligentHaptics.trigger(HapticFeedbackPattern.MEDIUM);
    expect(Vibration.vibrate).toHaveBeenCalledWith(20);
  });

  it('should trigger HEAVY haptics', () => {
    IntelligentHaptics.trigger(HapticFeedbackPattern.HEAVY);
    expect(Vibration.vibrate).toHaveBeenCalledWith(40);
  });

  it('should trigger SELECTION haptics', () => {
    IntelligentHaptics.trigger(HapticFeedbackPattern.SELECTION);
    expect(Vibration.vibrate).toHaveBeenCalledWith(5);
  });

  it('should not trigger haptics when disabled', () => {
    IntelligentHaptics.setEnabled(false);
    IntelligentHaptics.trigger(HapticFeedbackPattern.SUCCESS);
    expect(Vibration.vibrate).not.toHaveBeenCalled();
  });

  describe('impact', () => {
    it('should trigger HEAVY impact for tension > 0.9', () => {
      IntelligentHaptics.impact(0.95);
      expect(Vibration.vibrate).toHaveBeenCalledWith(40);
    });

    it('should trigger MEDIUM impact for tension > 0.5', () => {
      IntelligentHaptics.impact(0.6);
      expect(Vibration.vibrate).toHaveBeenCalledWith(20);
    });

    it('should trigger LIGHT impact for tension > 0.1', () => {
      IntelligentHaptics.impact(0.2);
      expect(Vibration.vibrate).toHaveBeenCalledWith(10);
    });

    it('should trigger nothing for tension <= 0.1', () => {
      IntelligentHaptics.impact(0.05);
      expect(Vibration.vibrate).not.toHaveBeenCalled();
    });

    it('should clamp tension values', () => {
      IntelligentHaptics.impact(1.5);
      expect(Vibration.vibrate).toHaveBeenCalledWith(40);

      jest.clearAllMocks();
      IntelligentHaptics.impact(-0.5);
      expect(Vibration.vibrate).not.toHaveBeenCalled();
    });
  });
});
