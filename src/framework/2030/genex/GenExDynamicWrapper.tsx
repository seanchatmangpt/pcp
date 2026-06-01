import React from 'react';
import { useGenEx } from './GenExProvider';

interface GenExDynamicWrapperProps {
  children: React.ReactNode;
}

/**
 * A wrapper that injects GenEx aesthetic variables into the CSS custom properties
 * and provides layout-specific context.
 */
export const GenExDynamicWrapper: React.FC<GenExDynamicWrapperProps> = ({ children }) => {
  const { currentVariant } = useGenEx();
  const { aesthetic, layoutType } = currentVariant;

  const style = {
    '--genex-primary-color': aesthetic.primaryColor,
    '--genex-background-color': aesthetic.backgroundColor,
    '--genex-spacing-scale': aesthetic.spacingScale.toString(),
    '--genex-border-radius': `${aesthetic.borderRadius}px`,
    // Derived spacing
    '--genex-spacing-unit': `${8 * aesthetic.spacingScale}px`,
  } as React.CSSProperties;

  return (
    <div className={`genex-wrapper genex-layout-${layoutType}`} style={style}>
      {children}
    </div>
  );
};
