import { Vibration, Platform } from 'react-native';

/**
 * Haptic Feedback Patterns supported by the IntelligentHaptics engine.
 */
export enum HapticFeedbackPattern {
  /** Successful operation completion */
  SUCCESS = 'SUCCESS',
  /** Warning or non-blocking issue */
  WARNING = 'WARNING',
  /** Critical error or failed operation */
  ERROR = 'ERROR',
  /** Subtle impact for light UI interactions */
  LIGHT = 'LIGHT',
  /** Moderate impact for standard interactions */
  MEDIUM = 'MEDIUM',
  /** Significant impact for heavy interactions */
  HEAVY = 'HEAVY',
  /** Discrete feedback for selection changes */
  SELECTION = 'SELECTION',
}

/**
 * IntelligentHaptics Engine
 *
 * Provides a contextual haptic feedback system that scales based on interaction intensity
 * and application state. Designed for 1000x DX with a clean, descriptive API.
 */
export class IntelligentHaptics {
  private static isEnabled: boolean = true;

  /**
   * Configures whether haptics are globally enabled.
   */
  static setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Triggers a specific haptic pattern.
   *
   * @param pattern - The pattern to trigger
   */
  static trigger(pattern: HapticFeedbackPattern): void {
    if (!this.isEnabled) return;

    switch (pattern) {
      case HapticFeedbackPattern.SUCCESS:
        this.vibrate([0, 10, 50, 10]);
        break;
      case HapticFeedbackPattern.WARNING:
        this.vibrate([0, 20, 100, 20]);
        break;
      case HapticFeedbackPattern.ERROR:
        this.vibrate([0, 50, 100, 50, 100, 60]);
        break;
      case HapticFeedbackPattern.LIGHT:
        this.vibrate(10);
        break;
      case HapticFeedbackPattern.MEDIUM:
        this.vibrate(20);
        break;
      case HapticFeedbackPattern.HEAVY:
        this.vibrate(40);
        break;
      case HapticFeedbackPattern.SELECTION:
        this.vibrate(5);
        break;
    }
  }

  /**
   * Triggers an impact based on a continuous "tension" or intensity value.
   * Useful for gesture-based interactions like pulling or dragging.
   *
   * @param tension - A value between 0 and 1 representing the interaction intensity.
   */
  static impact(tension: number): void {
    if (!this.isEnabled) return;

    const normalizedTension = Math.max(0, Math.min(1, tension));

    if (normalizedTension > 0.9) {
      this.trigger(HapticFeedbackPattern.HEAVY);
    } else if (normalizedTension > 0.5) {
      this.trigger(HapticFeedbackPattern.MEDIUM);
    } else if (normalizedTension > 0.1) {
      this.trigger(HapticFeedbackPattern.LIGHT);
    }
  }

  /**
   * Internal helper to handle cross-platform vibration.
   */
  private static vibrate(pattern: number | number[]): void {
    // On iOS, Vibration.vibrate is binary (on/off) and doesn't respect duration well
    // without specialized libraries. However, we provide the best possible fallback.
    Vibration.vibrate(pattern);
  }
}
