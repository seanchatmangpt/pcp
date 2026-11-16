import React, {
  ComponentType,
  forwardRef,
  useRef,
  ReactNode,
  Children,
  isValidElement,
  cloneElement,
} from 'react';
import { View } from 'react-native';
import { useTranslation } from '../../../core/i18n/useTranslation';
import { useFocusTrap } from '../../../ui/a11y/hooks/useFocusTrap';

export interface AutoInclusiveOptions {
  /**
   * Whether to automatically translate string children.
   * @default true
   */
  autoTranslate?: boolean;
  /**
   * Voice-to-Intent label. Injects a specific intent for voice controllers.
   * This will be prepended to the accessibilityLabel.
   */
  voiceIntent?: string;
  /**
   * Whether to enable focus trap behavior for this component.
   * @default false
   */
  focusTrap?: boolean;
  /**
   * Accessibility label override.
   */
  accessibilityLabel?: string;
}

export interface WithAutoInclusiveProps extends AutoInclusiveOptions {
  children?: ReactNode;
}

/**
 * Recursively traverses children and translates any string values found.
 */
function translateChildren(children: ReactNode, t: (key: string) => string): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === 'string') {
      return t(child);
    }
    if (isValidElement(child) && (child.props as any)?.children) {
      return cloneElement(child, {
        children: translateChildren((child.props as any).children, t),
      } as any);
    }
    return child;
  });
}

/**
 * AutoInclusiveWrapper HOC
 *
 * Automatically intercepts text for translation, injects Voice-to-Intent
 * accessibility labels, and manages focus traps dynamically.
 */
export function withAutoInclusive<P extends object>(
  Component: ComponentType<P>
): ComponentType<P & WithAutoInclusiveProps> {
  const WrappedComponent = forwardRef<any, P & WithAutoInclusiveProps>((props, ref) => {
    const {
      autoTranslate = true,
      voiceIntent,
      focusTrap = false,
      accessibilityLabel,
      children,
      ...restProps
    } = props;

    const { t } = useTranslation();
    const internalRef = useRef<any>(null);
    const resolvedRef = ref || internalRef;

    // Manage focus trap dynamically
    useFocusTrap(resolvedRef as any, focusTrap);

    // Process children for auto-translation
    const processedChildren = autoTranslate ? translateChildren(children, t) : children;

    // Inject Voice-to-Intent accessibility labels
    // We construct a comprehensive label that includes the intent and the content
    let finalA11yLabel = accessibilityLabel;

    if (!finalA11yLabel && typeof children === 'string') {
      finalA11yLabel = t(children);
    }

    if (voiceIntent) {
      finalA11yLabel = finalA11yLabel
        ? `Intent: ${voiceIntent}. ${finalA11yLabel}`
        : `Intent: ${voiceIntent}`;
    }

    const a11yProps = {
      accessibilityLabel: finalA11yLabel,
      accessibilityViewIsModal: focusTrap,
      importantForAccessibility: focusTrap ? ('yes' as const) : ('auto' as const),
    };

    return (
      <Component ref={resolvedRef} {...(restProps as P)} {...a11yProps}>
        {processedChildren}
      </Component>
    );
  });

  const displayName = Component.displayName || Component.name || 'Component';
  WrappedComponent.displayName = `withAutoInclusive(${displayName})`;

  return WrappedComponent as unknown as ComponentType<P & WithAutoInclusiveProps>;
}
