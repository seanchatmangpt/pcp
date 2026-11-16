import { useEffect, RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform } from 'react-native';

/**
 * A hook that attempts to trap accessibility focus within a specific element.
 * On mobile, this is primarily achieved by setting accessibility focus to the element
 * when it mounts or becomes active. For true modal behavior, use `accessibilityViewIsModal`
 * on the container.
 */
export const useFocusTrap = (
  ref: RefObject<any>,
  active: boolean = true,
  options: { delay?: number } = {}
) => {
  const { delay = 100 } = options;

  useEffect(() => {
    if (!active || !ref.current) return;

    const trapFocus = () => {
      if (ref.current) {
        try {
          const node = typeof findNodeHandle === 'function' ? findNodeHandle(ref.current) : null;
          if (node) {
            AccessibilityInfo.setAccessibilityFocus(node);
          }
        } catch (e) {
          // Ignore errors in test environments or if node handle is invalid
        }
      }
    };

    const timeoutId = setTimeout(trapFocus, delay);

    return () => clearTimeout(timeoutId);
  }, [active, ref, delay]);
};
