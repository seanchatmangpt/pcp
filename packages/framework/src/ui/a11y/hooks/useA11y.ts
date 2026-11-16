import { useMemo } from 'react';
import { A11yProps, AutoA11yOptions } from '../types';

/**
 * A hook that automatically computes React Native accessibility props based on high-level options.
 * This ensures consistency and simplifies the application of accessibility attributes.
 */
export const useA11y = (options: AutoA11yOptions): A11yProps => {
  return useMemo(() => {
    const {
      label,
      hint,
      role,
      busy,
      disabled,
      selected,
      expanded,
      checked,
      hidden,
      modal,
      live,
      value,
    } = options;

    const props: A11yProps = {};

    if (label) props.accessibilityLabel = label;
    if (hint) props.accessibilityHint = hint;
    if (role) props.accessibilityRole = role;

    const state: any = {};
    let hasState = false;

    if (busy !== undefined) {
      state.busy = busy;
      hasState = true;
    }
    if (disabled !== undefined) {
      state.disabled = disabled;
      hasState = true;
    }
    if (selected !== undefined) {
      state.selected = selected;
      hasState = true;
    }
    if (expanded !== undefined) {
      state.expanded = expanded;
      hasState = true;
    }
    if (checked !== undefined) {
      state.checked = checked;
      hasState = true;
    }

    if (hasState) {
      props.accessibilityState = state;
    }

    if (value) {
      props.accessibilityValue = value;
    }

    if (hidden) {
      props.accessibilityElementsHidden = true;
      props.importantForAccessibility = 'no-hide-descendants';
    }

    if (modal) {
      props.accessibilityViewIsModal = true;
    }

    if (live) {
      props.accessibilityLiveRegion = live;
    }

    return props;
  }, [options]);
};
