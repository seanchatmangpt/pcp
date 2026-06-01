# Customizing Dynamic Themes and Holographic Aesthetics

This guide demonstrates how to programmatically manipulate the Pcp Framework's aesthetic engine. You will learn how to switch themes dynamically and configure high-fidelity holographic glass effects for spatial computing interfaces.

## Prerequisites

- Your application must be wrapped in a `<ThemeProvider>`.
- For holographic effects, components must be descendants of a `<HolographicContainer>`.

## Switching Themes Dynamically

The `useUpdateTheme` hook provides a surgical way to modify the global theme state. This is essential for creating immersive transitions such as "Combat Mode," "Stealth HUD," or responding to environmental light changes.

### Updating Theme Colors

You can pass a partial theme object to `updateTheme` to override specific colors while preserving the rest of the configuration.

```tsx
import { useUpdateTheme } from '@/framework/ui/theme';

export const TacticalOverride = () => {
  const { updateTheme } = useUpdateTheme();

  const activateTacticalMode = () => {
    updateTheme({
      colors: {
        primary: '#FF3B30', // Tactical Red
        background: '#000000',
        card: '#1C1C1E',
        text: '#FFFFFF',
      },
    });
  };

  return <Button title="Activate Tactical HUD" onPress={activateTacticalMode} />;
};
```

### Resetting to Defaults

To revert all customizations to the system default theme:

```tsx
const { resetTheme } = useUpdateTheme();

// Call this to clear all overrides
resetTheme();
```

## Configuring Holographic Depth Effects

The `HolographicGlassCard` is the primary primitive for "Glassmorphism v2." it utilizes device gyroscopes and accelerometers to simulate physical depth and light interaction.

### 1. Basic Holographic Card

A standard card provides subtle depth and a light sheen (glare) that reacts to device tilt.

```tsx
import { HolographicGlassCard } from '@/framework/2030/ui-holographic';

const DataCrystal = () => (
  <HolographicGlassCard>
    <View className="p-4">
      <Text className="text-white font-bold">Neural Link: Active</Text>
    </View>
  </HolographicGlassCard>
);
```

### 2. Tuning Depth (Parallax)

The `parallaxIntensity` prop defines the perceived distance between the glass surface and the content layer.

- **Subtle (Default: 15):** Best for standard UI elements.
- **Deep (30-50):** Creates a "shadow box" effect, ideal for immersive data visualizations.

```tsx
<HolographicGlassCard parallaxIntensity={40}>
  {/* Content appears significantly recessed behind the glass */}
</HolographicGlassCard>
```

### 3. Controlling Reflectivity (Glare)

The `glareIntensity` prop (0.0 to 1.0) controls the brightness of the light reflection that sweeps across the card.

```tsx
<HolographicGlassCard glareIntensity={0.8}>
  {/* Represents a highly polished, sapphire-like surface */}
</HolographicGlassCard>
```

### 4. Inverting Motion for "Floating" Effects

By default, content appears to be _inside_ the card. Setting `inverted={true}` makes the content appear to float _above_ the card surface.

```tsx
<HolographicGlassCard inverted={true} parallaxIntensity={10}>
  <Text>Floating HUD Element</Text>
</HolographicGlassCard>
```

## 2030 Best Practices

- **Motion Sensitivity:** Always respect user accessibility settings. The `HolographicContainer` can be disabled globally via `isEnabled={false}` for users with vestibular sensitivities.
- **Performance:** Holographic effects are calculated on the UI thread. While highly optimized, avoid nesting more than 3 levels of `HolographicGlassCard` to maintain 120fps performance on mobile hardware.
- **Spatial Consistency:** Use consistent `parallaxIntensity` values across a single screen to ensure the "virtual depth" of your UI feels physically grounded.

## Troubleshooting

### "useUpdateTheme must be used within a ThemeProvider"

Ensure your root component (usually `App.tsx` or `_layout.tsx`) is wrapped in the `ThemeProvider`.

### Holographic effects are static

Verify that the component is wrapped in a `HolographicContainer`. On some platforms, you may also need to request permission for Motion & Orientation sensors.
