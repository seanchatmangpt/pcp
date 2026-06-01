import React from 'react';
import { ViewProps, StyleProp, ViewStyle } from 'react-native';
import { SpatialView, SpatialViewProps } from '../../xr/spatial/SpatialView';
import { GlassCard } from '../../ui/glassmorphism/GlassCard';
import { GlassBaseProps } from '../../ui/glassmorphism/types';
import { SlideTransition } from '../../ui/animations/SlideTransition';
import { FadeIn } from '../../ui/animations/FadeIn';

export interface GlassSpatialContainerProps extends ViewProps, GlassBaseProps {
  /**
   * The 3D transformation to apply to this container.
   */
  transform?: SpatialViewProps['transform'];
  /**
   * Optional z-index for spatial layering.
   */
  depth?: number;
  /**
   * Animation delay in milliseconds.
   * @default 0
   */
  delay?: number;
  /**
   * Direction of the entry animation.
   * @default 'up'
   */
  entryDirection?: 'up' | 'down' | 'left' | 'right';
  /**
   * If true, uses a simple fade instead of a slide transition.
   * @default false
   */
  fadeOnly?: boolean;
}

/**
 * A high-level composition that places a Glassmorphism card into a 3D spatial context.
 * It combines spatial positioning, glass visual effects, and immersive entry animations.
 *
 * @example
 * ```tsx
 * <GlassSpatialContainer
 *   transform={{
 *     position: { x: 0, y: 1.2, z: -1 },
 *     rotation: { x: 0, y: 0, z: 0 },
 *     scale: { x: 1, y: 1, z: 1 }
 *   }}
 *   intensity="high"
 * >
 *   <Text>Spatial Dashboard Content</Text>
 * </GlassSpatialContainer>
 * ```
 */
export const GlassSpatialContainer: React.FC<GlassSpatialContainerProps> = ({
  children,
  transform,
  depth = 0,
  intensity = 'medium',
  tint = 'default',
  withBorder = true,
  delay = 0,
  entryDirection = 'up',
  fadeOnly = false,
  style,
  ...props
}) => {
  const content = (
    <GlassCard intensity={intensity} tint={tint} withBorder={withBorder} style={style} {...props}>
      {children}
    </GlassCard>
  );

  const animatedContent = fadeOnly ? (
    <FadeIn delay={delay}>{content}</FadeIn>
  ) : (
    <SlideTransition direction={entryDirection} delay={delay}>
      {content}
    </SlideTransition>
  );

  return (
    <SpatialView transform={transform} depth={depth}>
      {animatedContent}
    </SpatialView>
  );
};

GlassSpatialContainer.displayName = 'GlassSpatialContainer';
