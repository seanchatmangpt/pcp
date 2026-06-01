import React, { forwardRef, useRef } from 'react';
import { View, ViewProps } from 'react-native';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface FocusTrapViewProps extends ViewProps {
  active?: boolean;
  autoFocus?: boolean;
}

/**
 * A View component that automatically traps accessibility focus when active.
 * Uses `accessibilityViewIsModal` and `useFocusTrap` hook.
 */
export const FocusTrapView = forwardRef<View, FocusTrapViewProps>(
  ({ active = true, autoFocus = true, children, ...props }, ref) => {
    const internalRef = useRef<View>(null);
    const resolvedRef = (ref as React.RefObject<View>) || internalRef;

    useFocusTrap(resolvedRef, active && autoFocus);

    return (
      <View
        ref={resolvedRef}
        accessibilityViewIsModal={active}
        importantForAccessibility={active ? 'yes' : 'auto'}
        {...props}>
        {children}
      </View>
    );
  }
);

FocusTrapView.displayName = 'FocusTrapView';
