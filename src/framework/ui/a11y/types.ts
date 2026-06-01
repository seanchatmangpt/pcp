import { AccessibilityRole, AccessibilityState, AccessibilityValue } from 'react-native';

export interface A11yProps {
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityValue?: AccessibilityValue;
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
  accessibilityElementsHidden?: boolean;
  accessibilityViewIsModal?: boolean;
  onAccessibilityTap?: () => void;
  accessibilityLanguage?: string;
}

export interface AutoA11yOptions {
  label?: string;
  hint?: string;
  role?: AccessibilityRole;
  busy?: boolean;
  disabled?: boolean;
  selected?: boolean;
  expanded?: boolean;
  checked?: boolean | 'mixed';
  hidden?: boolean;
  modal?: boolean;
  live?: 'none' | 'polite' | 'assertive';
  value?: {
    min?: number;
    max?: number;
    now?: number;
    text?: string;
  };
}
