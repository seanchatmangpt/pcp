import React from 'react';
import { View, ViewProps, StyleProp, ViewStyle } from 'react-native';
import { SpatialTransform } from './types';

export interface SpatialViewProps extends ViewProps {
  /**
   * The 3D transformation to apply to this view.
   */
  transform?: SpatialTransform;
  /**
   * If true, the view will be treated as a volumetric container.
   */
  isVolumetric?: boolean;
  /**
   * Optional z-index for spatial layering.
   */
  depth?: number;
}

/**
 * A primitive component for spatial positioning in XR environments.
 * In a standard React Native environment, this maps to a View with flattened 2D projections.
 * In a VisionOS or other XR-enabled environment, this provides the metadata for 3D placement.
 *
 * @example
 * ```tsx
 * <SpatialView
 *   transform={{
 *     position: { x: 0, y: 1.5, z: -2 },
 *     rotation: { x: 0, y: 0, z: 0 },
 *     scale: { x: 1, y: 1, z: 1 }
 *   }}
 * >
 *   <Text>Floating Spatial Content</Text>
 * </SpatialView>
 * ```
 */
export const SpatialView: React.FC<SpatialViewProps> = ({
  transform,
  isVolumetric = false,
  depth = 0,
  style,
  children,
  ...rest
}) => {
  // Map 3D transform to 2D styles as a fallback/stub for standard React Native
  const spatialStyle: StyleProp<ViewStyle> = {
    ...(transform
      ? {
          transform: [
            { translateX: transform.position.x },
            { translateY: transform.position.y },
            { scale: transform.scale.x }, // Simplified scale mapping
            { rotateX: `${transform.rotation.x}rad` },
            { rotateY: `${transform.rotation.y}rad` },
            { rotateZ: `${transform.rotation.z}rad` },
          ],
        }
      : {}),
    zIndex: depth,
  };

  return (
    <View
      style={[style, spatialStyle]}
      {...rest}
      // @ts-ignore - Custom props for XR runtimes
      isVolumetric={isVolumetric}
      spatialTransform={transform}>
      {children}
    </View>
  );
};
