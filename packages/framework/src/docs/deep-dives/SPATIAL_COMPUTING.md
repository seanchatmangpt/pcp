# Spatial Computing & Holographic UI

## Overview

The Pcp Framework provides a unified abstraction for **Spatial Computing**, bridging the gap between traditional 2D glassmorphism and fully immersive 3D XR environments (such as VisionOS). By utilizing the `xr/spatial` and `ui-holographic` modules, developers can build interfaces that feel "physical" on flat screens and "volumetric" in XR.

Pcp's philosophy follows a **Spatial-First, Mobile-Graceful** approach:

1.  **3D-Native**: Components are defined with 3D metadata (position, rotation, scale).
2.  **Holographic Simulation**: On 2D devices, motion sensors simulate depth via parallax and dynamic glare.
3.  **Graceful Degradation**: If sensors or XR runtimes are unavailable, the UI falls back to elegant 2D glassmorphism.

---

## Spatial Abstractions (`src/framework/xr/spatial`)

The spatial module handles the mathematical and structural representation of objects in 3D space.

### `SpatialView`

The `SpatialView` is the primary primitive for 3D placement.

- **XR Runtime**: On VisionOS or Meta Quest, `SpatialView` emits volumetric metadata (`isVolumetric`, `spatialTransform`) to the native XR compositor.
- **2D Fallback**: In standard React Native, it translates 3D coordinates into 2D `transform` styles and `zIndex` for depth layering.

```tsx
import { SpatialView } from '@pcp/framework/xr/spatial';

export const FloatingWindow = () => (
  <SpatialView
    transform={{
      position: { x: 0, y: 1.5, z: -2 }, // 1.5m up, 2m in front
      rotation: { x: 0, y: 0.1, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    }}
    isVolumetric>
    <MyContent />
  </SpatialView>
);
```

### `useSpatialPosition`

A hook for managing 3D transformations with built-in support for smoothing and haptic feedback.

```tsx
import { useSpatialPosition } from '@pcp/framework/xr/spatial';

const { transform, setPosition } = useSpatialPosition({
  position: { x: 0, y: 0, z: 0 },
});

// Move object 1 meter to the right
setPosition({ x: transform.position.x + 1 });
```

### `SpatialProvider`

The `SpatialProvider` defines the global or regional 3D coordinate system. It allows nested components to calculate their "World Space" transform relative to a root anchor.

- **`unitScale`**: Defines the relationship between framework units and physical meters (Default: 1 unit = 1 meter).
- **`worldTransform`**: The absolute position of the spatial root in the environment.

```tsx
import { SpatialProvider } from '@pcp/framework/xr/spatial';

<SpatialProvider value={{ unitScale: 1 }}>
  <FloatingWindow />
</SpatialProvider>;
```

---

## Holographic UI (`src/framework/2030/ui-holographic`)

Holographic components bring "Glassmorphism v2" to Pcp, adding dynamic depth effects that respond to device orientation.

### `HolographicContainer`

The root provider that manages sensor subscriptions (Gyroscope/Rotation). It ensures high performance by sharing a single `AnimatedSensor` from Reanimated across all child components.

```tsx
import { HolographicContainer } from '@pcp/framework/2030/ui-holographic';

const App = () => (
  <HolographicContainer isEnabled={true}>
    <MyHolographicStack />
  </HolographicContainer>
);
```

### `HolographicGlassCard`

An advanced UI primitive that enhances the standard `GlassCard` with:

- **Parallax Layering**: Internal content moves opposite to device tilt.
- **Dynamic Glare**: A simulated light sheen that "sweeps" across the card as it moves.
- **Tilt Physics**: Subtle 3D rotation based on pitch and roll.

---

## VisionOS & XR Integration

Pcp is designed to be **VisionOS-ready**. The abstractions in `src/framework/xr` are compatible with Apple's RealityKit and SwiftUI-based spatial views.

| Concept         | 2D Implementation    | 3D (VisionOS) Implementation    |
| :-------------- | :------------------- | :------------------------------ |
| **Positioning** | `translateX/Y`       | `RealityKit Entity.position`    |
| **Depth**       | `zIndex` + Parallax  | `z-axis` offset                 |
| **Lighting**    | Static Gradients     | Environment-aware PBR materials |
| **Materials**   | Glassmorphism (Blur) | `RealityKit.Material` (Frosted) |

---

## Implementation Examples

### Advanced Spatial Hook Usage

Using `useSpatialPosition` with a tracking configuration for a smooth "follow" effect.

```tsx
import { useSpatialPosition } from '@pcp/framework/xr/spatial';

export const useOrbitalControl = () => {
  return useSpatialPosition(
    { position: { x: 0, y: 0, z: -5 } },
    {
      smoothingFactor: 0.1, // Smooth interpolation
      enableHaptics: true, // Trigger haptics on boundary collision
      coordinateSpace: 'world',
    }
  );
};
```

### Creating a Holographic Dashboard

Combining container and cards for a physical-feeling mobile dashboard.

```tsx
import { HolographicContainer, HolographicGlassCard } from '@pcp/framework/2030/ui-holographic';

export const Dashboard = () => (
  <HolographicContainer style={{ padding: 20 }}>
    <HolographicGlassCard parallaxIntensity={20} glareIntensity={0.8} className="p-6 rounded-3xl">
      <Text className="text-white text-2xl font-bold">Spatial Balance</Text>
      <Text className="text-white/60">Ξ 1,420.69</Text>
    </HolographicGlassCard>
  </HolographicContainer>
);
```

## Best Practices (2030 Standards)

1.  **Prefer Local Coordinate Spaces**: Always anchor spatial transforms to the nearest `SpatialView` parent to avoid "coordinate drift" in large XR scenes.
2.  **Optimize Sensor Frequency**: Use the default 16ms (60fps) interval in `HolographicContainer` for smooth movement, but disable it (`isEnabled={false}`) when views are not visible to save battery.
3.  **Depth Hierarchy**: Keep `parallaxIntensity` between 5 and 25. Values higher than 30 can cause motion sickness in some users on mobile devices.
4.  **Semantic Depth**: Use the `depth` prop on `SpatialView` to communicate semantic hierarchy to assistive XR technologies.
