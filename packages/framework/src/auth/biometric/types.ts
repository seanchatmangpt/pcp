/**
 * @fileoverview Type definitions for biometric and passwordless authentication.
 */

export type BiometricType = 'FACE_ID' | 'TOUCH_ID' | 'IRIS' | 'UNKNOWN' | 'NONE';

export interface BiometricStatus {
  /** Whether the device has biometric hardware available. */
  hasHardware: boolean;
  /** Whether the user has enrolled at least one biometric credential. */
  isEnrolled: boolean;
  /** The types of biometrics supported by the device. */
  supportedTypes: BiometricType[];
}

export interface BiometricAuthOptions {
  /** Title for the biometric prompt. */
  promptMessage?: string;
  /** Label for the cancel button in the biometric prompt. */
  cancelLabel?: string;
  /** Label for the fallback button (e.g., "Use Passcode"). */
  fallbackLabel?: string;
  /** Whether to allow the user to fallback to device passcode. */
  disableDeviceFallback?: boolean;
}

export interface BiometricAuthResult {
  /** Whether the authentication was successful. */
  success: boolean;
  /** Error code if authentication failed. */
  error?: string;
  /** Error message if authentication failed. */
  warning?: string;
}

export interface UseBiometricAuthReturn extends BiometricStatus {
  /** Triggers the biometric authentication flow. */
  authenticate: (options?: BiometricAuthOptions) => Promise<BiometricAuthResult>;
  /** Refreshes the biometric availability status. */
  checkStatus: () => Promise<BiometricStatus>;
  /** Indicates if an authentication operation is currently in progress. */
  isAuthenticating: boolean;
}
