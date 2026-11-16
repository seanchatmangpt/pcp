# Complete Component Prop Definitions

This reference documentation provides exhaustive TypeScript interface definitions for core Pcp Framework SDK components. These definitions ensure type safety and provide a contract for the generative engine and manual composition.

---

## Button

The `Button` component is the primary interactive primitive in the Pcp Framework, supporting rich variants, sizes, and animated states.

### `ButtonProps`

Extends `React.ComponentPropsWithoutRef<typeof Pressable>`.

| Prop            | Type                              | Description                                                             | Default     |
| :-------------- | :-------------------------------- | :---------------------------------------------------------------------- | :---------- |
| `variant`       | [`ButtonVariant`](#buttonvariant) | The visual style of the button.                                         | `'default'` |
| `size`          | [`ButtonSize`](#buttonsize)       | The physical dimensions and padding.                                    | `'md'`      |
| `isLoading`     | `boolean`                         | If true, renders a loading indicator and disables interactions.         | `false`     |
| `className`     | `string`                          | Optional Tailwind CSS classes for the container.                        | -           |
| `textClassName` | `string`                          | Optional Tailwind CSS classes for the internal text element.            | -           |
| `children`      | `React.ReactNode`                 | Content to render inside the button. Supports strings for auto-styling. | -           |

### Supporting Types

#### `ButtonVariant`

```typescript
export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'ghost'
  | 'link';
```

#### `ButtonSize`

```typescript
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
```

---

## GlassCard

A specialized container component implementing the Pcp 2030 Glassmorphism design language.

### `GlassCardProps`

Extends `ViewProps` (React Native) and [`GlassBaseProps`](#glassbaseprops).

| Prop            | Type                                | Description                                             | Default     |
| :-------------- | :---------------------------------- | :------------------------------------------------------ | :---------- |
| `intensity`     | [`GlassIntensity`](#glassintensity) | Depth and blur strength of the frosted effect.          | `'medium'`  |
| `tint`          | [`GlassTint`](#glasstint)           | Color tint applied to the glass substrate.              | `'default'` |
| `withBorder`    | `boolean`                           | Enables a prismatic reflection border.                  | `true`      |
| `borderOpacity` | `number`                            | Overrides the default opacity of the reflection border. | -           |
| `className`     | `string`                            | Tailwind CSS classes for custom positioning and layout. | -           |

### Supporting Types

#### `GlassBaseProps`

```typescript
export interface GlassBaseProps {
  intensity?: GlassIntensity;
  tint?: GlassTint;
  withBorder?: boolean;
}
```

#### `GlassIntensity`

```typescript
export type GlassIntensity = 'low' | 'medium' | 'high';
```

#### `GlassTint`

```typescript
export type GlassTint = 'light' | 'dark' | 'default';
```

---

## GenerativeView

A data-driven component that dynamically scaffolds UI based on a semantic schema.

### `GenerativeViewProps`

Extends `ViewProps`.

| Prop             | Type                                    | Description                                           | Required |
| :--------------- | :-------------------------------------- | :---------------------------------------------------- | :------- |
| `schema`         | [`GenerativeSchema`](#generativeschema) | The structural definition of the data.                | Yes      |
| `data`           | `Record<string, any>`                   | The dataset to be rendered via the schema.            | Yes      |
| `themeOverrides` | `any`                                   | Localized style overrides for the generative engine.  | No       |
| `onAction`       | `(key: string, value: any) => void`     | Event handler for interactions with generated fields. | No       |

### Supporting Types

#### `GenerativeSchema`

```typescript
export interface GenerativeSchema {
  title?: string;
  description?: string;
  fields: SemanticField[];
  layoutHints?: Record<string, LayoutHint>;
}
```

#### `SemanticField`

```typescript
export interface SemanticField {
  key: string;
  label?: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'uri';
  format?: 'email' | 'url' | 'multiline' | 'image' | 'color';
  description?: string;
  semanticType?: string;
}
```

#### `LayoutHint`

```typescript
export interface LayoutHint {
  priority?: number;
  span?: 1 | 2 | 3 | 4;
  variant?: 'card' | 'flat' | 'hero' | 'compact';
  position?: 'header' | 'body' | 'footer' | 'sidebar';
}
```

---

## FusionAdminConsole

The high-level administrative interface for the Fusion architecture, combining 3D telemetry and autonomous repair orchestration.

### `FusionAdminConsoleProps`

| Prop               | Type                       | Description                                       | Required |
| :----------------- | :------------------------- | :------------------------------------------------ | :------- |
| `topology`         | `MembraneTopology`         | The graph structure for the 3D visualization.     | Yes      |
| `initialErrorLogs` | `FusionErrorLog[]`         | Pre-populated error logs for the diagnostic view. | No       |
| `onNodeClick`      | `(nodeId: string) => void` | Callback for 3D node selection events.            | No       |
| `onBack`           | `() => void`               | Navigation callback for exit intent.              | No       |
| `testID`           | `string`                   | Unique identifier for automation and testing.     | No       |

### Supporting Types

#### `FusionErrorLog`

```typescript
export interface FusionErrorLog {
  id: string;
  timestamp: number;
  error: Error;
  status: 'pending' | 'fixed' | 'ignored';
}
```
