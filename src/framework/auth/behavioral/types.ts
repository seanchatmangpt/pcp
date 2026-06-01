/**
 * @fileoverview Type definitions for Continuous Behavioral Biometrics.
 */

export interface BehavioralMetrics {
  /**
   * Average time between keystrokes in milliseconds.
   */
  typingSpeed: number;

  /**
   * Average touch pressure (0.0 to 1.0). Stubbed for now.
   */
  touchPressure: number;

  /**
   * Navigation events per minute.
   */
  navigationRhythm: number;

  /**
   * Timestamp of the last metric update.
   */
  lastUpdated: number;
}

export interface BehavioralAuthState {
  /**
   * Trust score between 0.0 and 1.0.
   * 1.0 represents high confidence that the user is who they claim to be.
   */
  trustScore: number;

  /**
   * The raw metrics used to calculate the trust score.
   */
  metrics: BehavioralMetrics;

  /**
   * Whether the behavioral analysis is currently active.
   */
  isActive: boolean;

  /**
   * Manually record a keystroke event.
   */
  recordKeystroke: () => void;

  /**
   * Manually record an interaction event.
   */
  recordInteraction: () => void;
}

export interface BehavioralAuthOptions {
  /**
   * How often to re-calculate the trust score in milliseconds.
   * @default 5000
   */
  updateInterval?: number;

  /**
   * Sensitivity of the trust score calculation.
   * Higher values make the score more volatile.
   * @default 0.5
   */
  sensitivity?: number;
}
