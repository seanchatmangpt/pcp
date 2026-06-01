import React, { useMemo } from 'react';
import {
  Platform,
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { SpatialView } from '../../xr/spatial/SpatialView';
import { GlassCard } from '../../ui/glassmorphism/GlassCard';
import { GlassIntensity, GlassTint } from '../../ui/glassmorphism/types';
import { Vector3, Euler } from '../../xr/spatial/types';
import { Stagger } from '../../ui/animations/Stagger';
import { FadeIn } from '../../ui/animations/FadeIn';

export interface FusionSpatialSceneProps {
  children: React.ReactNode[];
  /**
   * Scene layout mode.
   * - 'grid': Standard 2D grid (fallback) or 3D panel grid.
   * - 'carousel': 3D immersive carousel surrounding the user.
   * - 'dashboards': Multiple spatial dashboard panels at eye level.
   * @default 'grid'
   */
  layout?: 'grid' | 'carousel' | 'dashboards';
  /**
   * Glassmorphism intensity for the scene elements.
   * @default 'medium'
   */
  intensity?: GlassIntensity;
  /**
   * Glassmorphism tint.
   * @default 'default'
   */
  tint?: GlassTint;
  /**
   * Force spatial mode. If undefined, it will be detected based on Platform.
   */
  isSpatial?: boolean;
  /**
   * Radius for 'carousel' or distance for 'dashboards' in meters.
   * @default 2
   */
  radius?: number;
  /**
   * Columns for 'grid' layout in 2D mode.
   * @default 3
   */
  columns?: number;
  /**
   * Gap between items in pixels (2D) or decimeters (3D).
   * @default 16
   */
  gap?: number;
  /**
   * Stagger delay between items in milliseconds.
   * @default 60
   */
  stagger?: number;
  /**
   * Optional style for the scene container.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Optional style for each item's glass card.
   */
  itemStyle?: StyleProp<ViewStyle>;
}

/**
 * FusionSpatialScene
 *
 * A high-level fusion component that bridges 2D generative UI with 3D XR environments.
 * It automatically adapts content layouts based on device capabilities, transforming
 * flat grids into immersive glassmorphism scenes.
 *
 * It combines spatial primitives, auto-layout logic, and premium glassmorphism
 * into a single cohesive experience.
 *
 * @example
 * ```tsx
 * <FusionSpatialScene layout="carousel" intensity="high">
 *   {data.map(item => <QuickAction key={item.id} {...item} />)}
 * </FusionSpatialScene>
 * ```
 */
export const FusionSpatialScene: React.FC<FusionSpatialSceneProps> = ({
  children,
  layout = 'grid',
  intensity = 'medium',
  tint = 'default',
  isSpatial,
  radius = 2,
  columns = 3,
  gap = 16,
  stagger = 60,
  style,
  itemStyle,
}) => {
  const { width } = useWindowDimensions();

  // Detection logic for XR environments
  const activeIsSpatial = useMemo(() => {
    if (isSpatial !== undefined) return isSpatial;
    // @ts-ignore - VisionOS/XR platform detection
    return Platform.OS === 'visionos' || Platform.OS === 'xr';
  }, [isSpatial]);

  // --- 2D Generative Grid Fallback ---
  if (!activeIsSpatial) {
    return (
      <View style={[styles.container2D, style]}>
        <Stagger stagger={stagger}>
          {children.map((child, index) => (
            <FadeIn
              key={`fusion-item-2d-${index}`}
              style={[
                styles.gridItem,
                {
                  width: `${100 / columns}%`,
                  padding: gap / 2,
                },
              ]}>
              <GlassCard intensity={intensity} tint={tint} style={[styles.glassBase, itemStyle]}>
                {child}
              </GlassCard>
            </FadeIn>
          ))}
        </Stagger>
      </View>
    );
  }

  // --- 3D Glassmorphism Scene ---
  return (
    <View style={[styles.container3D, style]}>
      {children.map((child, index) => {
        let position: Vector3 = { x: 0, y: 0, z: -radius };
        let rotation: Euler = { x: 0, y: 0, z: 0 };

        if (layout === 'carousel') {
          const angleStep = (2 * Math.PI) / (children.length || 1);
          const angle = index * angleStep;
          position = {
            x: Math.sin(angle) * radius,
            y: 0,
            z: -Math.cos(angle) * radius,
          };
          rotation = { x: 0, y: -angle, z: 0 };
        } else if (layout === 'dashboards') {
          // Arrange in a slight arc in front of the user
          const spread = Math.PI / 3; // 60 degree spread
          const angle =
            (index - (children.length - 1) / 2) * (spread / Math.max(children.length - 1, 1));
          position = {
            x: Math.sin(angle) * radius,
            y: 0,
            z: -Math.cos(angle) * radius,
          };
          rotation = { x: 0, y: -angle, z: 0 };
        } else {
          // Default: 3D Grid Panel
          const rows = Math.ceil(children.length / columns);
          const col = index % columns;
          const row = Math.floor(index / columns);
          const spacing = gap / 100; // Convert pixels to meters roughly for XR

          position = {
            x: (col - (columns - 1) / 2) * (1.2 + spacing),
            y: ((rows - 1) / 2 - row) * (1.0 + spacing),
            z: -radius,
          };
        }

        return (
          <SpatialView
            key={`fusion-item-3d-${index}`}
            transform={{
              position,
              rotation,
              scale: { x: 1, y: 1, z: 1 },
            }}
            depth={Math.round(-position.z * 100)}>
            <FadeIn delay={index * stagger} duration={800}>
              <GlassCard
                intensity={intensity}
                tint={tint}
                style={[styles.glassBase, styles.glass3D, itemStyle]}>
                {child}
              </GlassCard>
            </FadeIn>
          </SpatialView>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container2D: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  gridItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  container3D: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 500,
  },
  glassBase: {
    width: '100%',
    padding: 16,
  },
  glass3D: {
    minWidth: 300,
    minHeight: 200,
  },
});

FusionSpatialScene.displayName = 'FusionSpatialScene';
