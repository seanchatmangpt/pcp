import React from 'react';
import { AccessibilityInfo, findNodeHandle, View, Text } from 'react-native';
import { render, renderHook } from '@testing-library/react-native';
import { useA11y } from '../hooks/useA11y';
import { AutoA11yOptions } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { withA11y } from '../hocs/withA11y';

// Mock react-native dynamically using a Proxy to prevent eager TurboModule evaluation issues
jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  const mockAccessibilityInfo = {
    ...rn.AccessibilityInfo,
    setAccessibilityFocus: jest.fn(),
  };
  const mockFindNodeHandle = jest.fn(() => 123);

  return new Proxy(rn, {
    get(target, prop) {
      if (prop === 'AccessibilityInfo') {
        return mockAccessibilityInfo;
      }
      if (prop === 'findNodeHandle') {
        return mockFindNodeHandle;
      }
      return target[prop];
    },
  });
});

describe('Consolidated Accessibility Tests', () => {
  
  // --- useA11y ---
  describe('useA11y hook', () => {
    it('returns empty object when no options provided', () => {
      const { result } = renderHook(() => useA11y({}));
      expect(result.current).toEqual({});
    });

    it('maps label and hint correctly', () => {
      const options: AutoA11yOptions = {
        label: 'Submit Button',
        hint: 'Submits the form',
      };
      const { result } = renderHook(() => useA11y(options));
      expect(result.current.accessibilityLabel).toBe('Submit Button');
      expect(result.current.accessibilityHint).toBe('Submits the form');
    });

    it('maps role correctly', () => {
      const options: AutoA11yOptions = {
        role: 'button',
      };
      const { result } = renderHook(() => useA11y(options));
      expect(result.current.accessibilityRole).toBe('button');
    });
  });

  // --- useFocusTrap ---
  describe('useFocusTrap hook', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('calls AccessibilityInfo.setAccessibilityFocus when active', () => {
      const ref = { current: {} };
      renderHook(() => useFocusTrap(ref as any, true, { delay: 10 }));

      jest.runAllTimers();

      expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalledWith(123);
    });

    it('does not call AccessibilityInfo.setAccessibilityFocus when inactive', () => {
      const ref = { current: {} };
      renderHook(() => useFocusTrap(ref as any, false, { delay: 10 }));

      jest.runAllTimers();

      expect(AccessibilityInfo.setAccessibilityFocus).not.toHaveBeenCalled();
    });
  });

  // --- withA11y (HOC) ---
  describe('withA11y HOC', () => {
    const MockComponent = React.forwardRef<View, { testID?: string; children?: React.ReactNode }>(
      (props, ref) => (
        <View ref={ref} {...props}>
          {props.children}
        </View>
      )
    );

    const EnhancedComponent = withA11y(MockComponent);

    it('passes a11y props to the wrapped component', () => {
      const { getByTestId } = render(
        <EnhancedComponent testID="enhanced" label="Enhanced Label" role="header" busy={true} />
      );

      const component = getByTestId('enhanced');
      expect(component.props.accessibilityLabel).toBe('Enhanced Label');
      expect(component.props.accessibilityRole).toBe('header');
      expect(component.props.accessibilityState).toEqual({ busy: true });
    });

    it('preserves other props', () => {
      const { getByText } = render(
        <EnhancedComponent label="Test">
          <Text>Inner Text</Text>
        </EnhancedComponent>
      );

      expect(getByText('Inner Text')).toBeTruthy();
    });

    it('forwards the ref', () => {
      const ref = React.createRef<View>();
      render(<EnhancedComponent ref={ref} label="Test" />);
      expect(ref.current).toBeTruthy();
    });
  });

});
