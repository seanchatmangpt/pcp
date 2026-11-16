# Generative Experience (GenEx) AI

The **Generative Experience (GenEx)** engine is a core pillar of the Pcp Framework, designed to deliver hyper-personalized, context-aware user interfaces that adapt in real-time. Unlike traditional static UI systems, GenEx leverages on-device LLMs and behavioral heuristics to morph the application's aesthetic and structural layout based on user intent, trust levels, and historical interaction patterns.

---

## 1. Core Modules

### `src/framework/2030/genex`

This module houses the brain of the generative system.

- **`GenExEngine`**: The central orchestrator that interfaces with local inference models to compute UI variants.
- **`GenExProvider`**: A React Context provider that manages the global GenEx state, including the current active variant and adaptation history.
- **`GenExDynamicWrapper`**: A high-level layout component that injects generative aesthetics (colors, spacing, radii) into the UI tree via CSS Custom Properties.

### `src/framework/ui/generative`

This module provides the "body" for the GenEx "brain."

- **`GenerativeView`**: A polymorphic component that renders data-driven interfaces from semantic schemas without manual component mapping.
- **`useGenerativeLayout`**: A hook that applies layout algorithms to distribute fields across a multi-region interface (Header, Body, Footer).

---

## 2. The GenEx Engine: Local Inference & Adaptive Logic

The `GenExEngine` performs real-time synthesis of the UI by combining **Behavioral Trust Scores** and **Navigation History**.

### How it Works

1. **Context Gathering**: The engine retrieves the user's current `trustScore` (computed via `BehavioralMetrics`) and the recent navigation path.
2. **Local Inference**: It sends a structured prompt to the `ILocalInferenceEngine` (running on-device models like Phi-3 or Llama-3-8B).
3. **Variant Synthesis**: The model returns a JSON configuration containing:
   - **Aesthetic**: Color palettes, spacing scales, and corner treatments.
   - **Layout Type**: The structural "mood" of the interface (e.g., `expansive` vs `focused`).

### Trust-Based Adaptations

| Trust Score          | Mood      | Visual Characteristics                           | Layout Strategy                                               |
| :------------------- | :-------- | :----------------------------------------------- | :------------------------------------------------------------ |
| **High (> 0.8)**     | Expansive | Vibrant colors, high spacing scale, large radii. | `expansive`: Maximizes whitespace and visual flow.            |
| **Medium (0.4-0.7)** | Standard  | Brand-standard blues, balanced spacing.          | `relaxed`: Traditional, comfortable density.                  |
| **Low (< 0.4)**      | Secure    | High-contrast slates/grays, compact spacing.     | `focused`: Removes distractions, emphasizes security signals. |

---

## 3. Layout Algorithms & Aesthetics

### Semantic Layout Synthesis

The `GenerativeView` doesn't follow a hardcoded template. Instead, it processes a `GenerativeSchema` using a weighted distribution algorithm:

1. **Positioning**: Fields are assigned to `header`, `body`, or `footer` based on their `LayoutHint.position`.
2. **Prioritization**: High-priority fields are rendered with `hero` variants or larger grid spans.
3. **Adaptive Grid**: The engine calculates `span` (1-4 columns) dynamically based on the current `layoutType` provided by GenEx.

### Aesthetic Adaptations

The system uses **CSS Custom Properties** (Variables) to propagate generative styles. This ensures that even "static" components become generative-aware.

```css
:root {
  --genex-primary-color: #6366f1;
  --genex-spacing-scale: 1.2;
  --genex-border-radius: 16px;
}
```

---

## 4. Code Examples

### `GenExDynamicWrapper`

Wrap your application or specific features to enable generative aesthetics.

```tsx
import { GenExProvider, GenExDynamicWrapper } from '@pcp/framework/2030/genex';

export const App = () => (
  <GenExProvider engineId="genex-v1-visionary" adaptationStrategy="eager">
    <GenExDynamicWrapper>
      <MainNavigation />
    </GenExDynamicWrapper>
  </GenExProvider>
);
```

### `GenerativeView`

Render complex data structures with zero UI code by defining semantic intent.

```tsx
import { GenerativeView } from '@pcp/framework/ui/generative';

const USER_PROFILE_SCHEMA = {
  title: 'Identity Projection',
  fields: [
    { key: 'avatar', label: 'Presence', type: 'uri', format: 'image' },
    { key: 'displayName', label: 'Known As', type: 'string' },
    { key: 'trustLevel', label: 'Network Trust', type: 'number' },
  ],
  layoutHints: {
    avatar: { position: 'header', variant: 'hero', span: 4 },
    displayName: { position: 'body', span: 2 },
  },
};

const ProfileView = ({ userData }) => (
  <GenerativeView
    schema={USER_PROFILE_SCHEMA}
    data={userData}
    onAction={(key, val) => console.log(`Interacted with ${key}`)}
  />
);
```

---

## 5. 2030 Best Practices

- **Local First**: Never send GenEx prompts to the cloud. Keep inference on-device to protect user behavioral history.
- **Semantic Intent**: Define schemas based on _what_ the data is (e.g., `semanticType: "rdf:Person"`), not _how_ it should look. Let the engine decide the look.
- **Heuristic Fallbacks**: Always provide a `generateHeuristicVariant` method in your engine to ensure the UI remains functional if the LLM is unavailable or times out.
- **A11y-Aware Adaptation**: Ensure the GenEx engine respects system accessibility settings (e.g., reduced motion, high contrast) regardless of the generated variant.
