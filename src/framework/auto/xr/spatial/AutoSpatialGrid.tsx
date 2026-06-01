import React, { useMemo } from 'react';
import { Platform, View, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import { SpatialView } from '@/src/framework/xr/spatial/SpatialView';
import { Vector3, Euler } from '@/src/framework/xr/spatial/types';
import Animated, { FadeIn as ReanimatedFadeIn } from 'react-native-reanimated';
import { Stagger } from '@/src/framework/ui/animations/Stagger';
import { FadeIn } from '@/src/framework/ui/animations/FadeIn';

export interface AutoSpatialGridProps {
  children: React.ReactNode[];
  /**
   * Force spatial mode. If undefined, it will be detected based on Platform.
   */
  isSpatial?: boolean;
  /**
   * Radius of the 3D carousel in meters (XR units).
   * @default 2
   */
  radius?: number;
  /**
   * Spacing between items in 2D mode.
   * @default 16
   */
  gap?: number;
  /**
   * Number of columns in 2D grid mode.
   * @default 3
   */
  columns?: number;
  /**
   * Stagger delay between items in milliseconds.
   * @default 50
   */
  stagger?: number;
  /**
   * Optional style for the container.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Optional style for each item wrapper.
   */
  itemStyle?: StyleProp<ViewStyle>;
}

/**
 * AutoSpatialGrid
 *
 * Automatically converts a flat array of children into an immersive 3D carousel
 * in XR environments (VisionOS), or a standard 2D flexbox grid on other platforms.
 *
 * This component seamlessly integrates Pcp's XR spatial primitives with
 * the unified animation system.
 *
 * @example
 * ```tsx
 * <AutoSpatialGrid columns={3} radius={2.5}>
 *   {items.map(item => <Card key={item.id} {...item} />)}
 * </AutoSpatialGrid>
 * ```
 */
export const AutoSpatialGrid: React.FC<AutoSpatialGridProps> = ({
  children,
  isSpatial,
  radius = 2,
  gap = 16,
  columns = 3,
  stagger = 50,
  style,
  itemStyle,
}) => {
  // Detection logic for VisionOS/XR
  const activeIsSpatial = useMemo(() => {
    if (isSpatial !== undefined) return isSpatial;
    // @ts-ignore - VisionOS support in some RN versions/forks
    return Platform.OS === 'visionos' || Platform.OS === 'xr';
  }, [isSpatial]);

  if (!activeIsSpatial) {
    return (
      <View style={[styles.grid, style]}>
        <Stagger stagger={stagger}>
          {children.map((child, index) => (
            <FadeIn
              key={`grid-item-${index}`}
              style={[
                styles.gridItem,
                {
                  width: `${100 / columns}%`,
                  padding: gap / 2,
                },
                itemStyle,
              ]}>
              {child}
            </FadeIn>
          ))}
        </Stagger>
      </View>
    );
  }

  // 3D Immersive Carousel Logic
  const totalItems = children.length;
  const angleStep = (2 * Math.PI) / (totalItems || 1);

  return (
    <View style={[styles.spatialContainer, style]}>
      {children.map((child, index) => {
        const angle = index * angleStep;

        // Position on a cylinder (y=0 is eye level by default in many XR setups)
        const position: Vector3 = {
          x: Math.sin(angle) * radius,
          y: 0,
          z: -Math.cos(angle) * radius,
        };

        // Rotate to face the origin (0,0,0)
        const rotation: Euler = {
          x: 0,
          y: -angle,
          z: 0,
        };

        return (
          <SpatialView
            key={`spatial-item-${index}`}
            transform={{
              position,
              rotation,
              scale: { x: 1, y: 1, z: 1 },
            }}
            depth={Math.round(-position.z * 100)} // Depth-based sorting fallback
          >
            <Animated.View
              entering={ReanimatedFadeIn.delay(index * stagger).duration(600)}
              style={itemStyle}>
              {child}
            </Animated.View>
          </SpatialView>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  gridItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spatialContainer: {
    // The container acts as the anchor point in 3D space
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
});
