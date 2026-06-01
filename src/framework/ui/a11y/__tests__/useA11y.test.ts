import { renderHook } from '@testing-library/react-native';
import { useA11y } from '../hooks/useA11y';
import { AutoA11yOptions } from '../types';

describe('useA11y', () => {
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

  it('maps state correctly', () => {
    const options: AutoA11yOptions = {
      busy: true,
      disabled: false,
      selected: true,
      expanded: false,
      checked: 'mixed',
    };
    const { result } = renderHook(() => useA11y(options));
    expect(result.current.accessibilityState).toEqual({
      busy: true,
      disabled: false,
      selected: true,
      expanded: false,
      checked: 'mixed',
    });
  });

  it('maps value correctly', () => {
    const options: AutoA11yOptions = {
      value: { min: 0, max: 100, now: 50, text: '50 percent' },
    };
    const { result } = renderHook(() => useA11y(options));
    expect(result.current.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 50,
      text: '50 percent',
    });
  });

  it('handles hidden option', () => {
    const options: AutoA11yOptions = {
      hidden: true,
    };
    const { result } = renderHook(() => useA11y(options));
    expect(result.current.accessibilityElementsHidden).toBe(true);
    expect(result.current.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('handles modal option', () => {
    const options: AutoA11yOptions = {
      modal: true,
    };
    const { result } = renderHook(() => useA11y(options));
    expect(result.current.accessibilityViewIsModal).toBe(true);
  });

  it('handles live option', () => {
    const options: AutoA11yOptions = {
      live: 'assertive',
    };
    const { result } = renderHook(() => useA11y(options));
    expect(result.current.accessibilityLiveRegion).toBe('assertive');
  });
});
