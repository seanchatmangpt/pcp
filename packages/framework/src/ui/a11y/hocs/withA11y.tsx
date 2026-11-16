import React, { ComponentType, forwardRef } from 'react';
import { AutoA11yOptions } from '../types';
import { useA11y } from '../hooks/useA11y';

export type WithA11yProps = AutoA11yOptions;

/**
 * A Higher-Order Component that injects accessibility props into a component.
 * It uses the useA11y hook internally to compute the correct props.
 */
export function withA11y<P extends object>(
  Component: ComponentType<P>
): ComponentType<P & WithA11yProps> {
  const ComponentWithA11y = forwardRef<any, P & WithA11yProps>((props, ref) => {
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
      ...restProps
    } = props;

    const a11yProps = useA11y({
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
    });

    return <Component ref={ref} {...(restProps as P)} {...a11yProps} />;
  });

  const displayName = Component.displayName || Component.name || 'Component';
  ComponentWithA11y.displayName = `withA11y(${displayName})`;

  return ComponentWithA11y as unknown as ComponentType<P & WithA11yProps>;
}
