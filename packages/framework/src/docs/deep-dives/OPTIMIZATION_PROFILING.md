# Optimization & Profiling: Self-Optimizing UX

The Pcp Framework SDK implements a **Self-Optimizing UX** strategy designed for the year 2030, where applications must maintain peak performance while remaining conscious of device longevity, thermal health, and battery efficiency.

## Overview

Optimization in Pcp is handled by two primary modules:

1.  **`src/framework/admin/metrics`**: Low-level performance monitoring and vitals tracking.
2.  **`src/framework/2030/optimization`**: The intelligent engine that translates raw vitals into actionable optimization profiles.

---

## Self-Optimizing UX Engine

The `SelfOptimizingUXEngine` is a singleton that continuously monitors the device state and categorizes it into one of four optimization levels: `peak`, `balanced`, `power-saver`, or `critical`.

### Heuristics & Decision Logic

The engine uses a hierarchical heuristic model to determine the current `OptimizationProfile`:

| Profile         | Level         | Logic Trigger                                                          | Impact                                                                   |
| :-------------- | :------------ | :--------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| **Peak**        | `peak`        | Nominal thermal state, High battery, Stable FPS (>55)                  | Full animations, exhaustive ZKP depth, max sync frequency.               |
| **Balanced**    | `balanced`    | Fair thermal state or FPS dip (30-55)                                  | Reduced animation complexity, standard ZKP depth.                        |
| **Power Saver** | `power-saver` | Serious thermal state, Low battery (<20%), or Poor FPS (15-30)         | Minimal animations, fast ZKP depth, background sync disabled.            |
| **Critical**    | `critical`    | Critical thermal state, Critical battery (<10%), or Unstable FPS (<15) | No animations, minimal ZKP depth, background sync disabled, haptics off. |

#### Vitals Thresholds

- **FPS**: Stable (>55), Poor (<30), Critical (<15).
- **Battery**: Low (<20%), Critical (<10%).
- **Thermal**: `nominal`, `fair`, `serious`, `critical`.

---

## Performance Vitals Hooks

### `useAppVitals`

The `useAppVitals` hook provides real-time access to the JS thread FPS, UI thread FPS, and approximate memory usage. It is optimized for near-zero overhead using Reanimated shared values for native frame tracking.

```typescript
import { useAppVitals } from '@/src/framework/admin/metrics/useAppVitals';

function PerformanceDashboard() {
  const { jsFps, uiFps, memory } = useAppVitals({
    updateInterval: 1000,
    enabled: true
  });

  return (
    <View>
      <Text>JS FPS: {jsFps}</Text>
      <Text>UI FPS: {uiFps}</Text>
      <Text>Memory: {memory}MB</Text>
    </View>
  );
}
```

### `useOptimizationProfile`

This hook allows components to react to the current system-wide optimization profile.

```typescript
import { useOptimizationProfile } from '@/src/framework/2030/optimization/useOptimizationProfile';

function AdaptiveList() {
  const { profile } = useOptimizationProfile();

  return (
    <FlatList
      data={items}
      // Disable expensive interactions on power-saver or critical
      activeOpacity={profile.level === 'peak' ? 0.7 : 1}
      // Only render complex items in peak/balanced
      renderItem={({ item }) => (
        profile.animationComplexity === 'full'
          ? <ComplexComponent item={item} />
          : <SimpleComponent item={item} />
      )}
    />
  );
}
```

---

## Adaptive Logic Implementation

### Example: Throttling Network Sync based on Profile

The SDK uses the `syncFrequencyMs` property from the current profile to adjust the interval of background tasks dynamically.

```typescript
import { useEffect } from 'react';
import { useSyncFrequency } from '@/src/framework/2030/optimization/useOptimizationProfile';
import { uxOptimizer } from '@/src/framework/2030/optimization/SelfOptimizingUXEngine';

export function useAdaptiveSync() {
  const syncFrequency = useSyncFrequency();

  useEffect(() => {
    const interval = setInterval(() => {
      performSync();
    }, syncFrequency);

    return () => clearInterval(interval);
  }, [syncFrequency]);
}
```

### Manual Vital Injection

You can manually update the vitals if your application has custom sensors or specific performance requirements:

```typescript
import { uxOptimizer } from '@/src/framework/2030/optimization/SelfOptimizingUXEngine';

// Force a power-saver state for a specific high-load operation
function enterHighLoadMode() {
  uxOptimizer.updateVitals({ thermalState: 'serious' });
}

function exitHighLoadMode() {
  // Let the engine re-evaluate naturally
  uxOptimizer.updateVitals({ thermalState: 'nominal' });
}
```

## Best Practices (2030)

1.  **Prefer `useOptimizationProfile` over raw `useAppVitals`**: Components should react to the semantic "profile" rather than trying to calculate their own throttling logic based on raw FPS.
2.  **Zero-Bridge Overhead**: Use `useAppVitals` sparingly in production. It is designed for debugging and internal metrics collection.
3.  **Graceful Degradation**: Always design components to have a "minimal" visual state that consumes zero animation frames.
4.  **ZKP Depth**: When performing Zero-Knowledge Proof verifications, always respect the `zkpVerificationDepth` to prevent thermal runaway on mobile devices.
