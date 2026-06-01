# Pcp Framework: Auto, Compositions, and Fusion Layers

This document outlines the high-level SDK layers responsible for the autonomous, compositional, and fused user experiences in the Pcp Framework.

## 1. Architectural Layers

### `auto/*` (UI/UX/DX)

The **Auto** layer provides autonomous capability discovery and self-healing UI. It leverages the Virtual Knowledge Graph (VKG) to automatically scaffold interfaces based on semantic intent.

- **AutoUI:** Subscribes to real-time VKG graph changes and automatically re-renders generative UI layouts.
- **AutoUX:** Adaptive interaction wrappers that adjust to user behavior and environmental constraints (device vitals, trust scores).
- **AutoDX:** Scaffolding tools like `useAutoScaffold` that provide real-time developer feedback and "auto-fixers" for missing semantic bindings.

### `compositions/*`

Compositions are higher-order patterns that combine multiple core capabilities into cohesive units.

- **Semantic CRUD:** Orchestrates data management using `SemanticListView` and `SemanticCrudManager`.
- **Auth UI:** Provides unified, multi-modal authentication flows like `UnifiedAuthScreen`.
- **Collaborative State:** Patterns for real-time peer-to-peer state sharing and workspace synchronization.

### `fusion/*`

The **Fusion** layer is the ultimate integration point where data, auth, and UI converge. It ensures that semantic data is always protected by identity and rendered with contextual intelligence.

---

## 2. The Generative UI Flow

The Pcp Framework uses a "Generative UI" pattern to bridge the gap between abstract data and concrete interfaces:

1. **RDF Schema:** Data is defined using standard RDF/JSON-LD (Schema.org).
2. **VKG (Virtual Knowledge Graph):** The VKG client fetches and synchronizes these RDF quads.
3. **Semantic Mapping:** The framework maps RDF types (e.g., `schema:Person`) to semantic intents.
4. **AutoSemanticView:** This component consumes the VKG node and dynamically selects the optimal renderer based on the device context (Mobile, XR, or Web) and user preferences.

---

## 3. Code Examples

### `FusionDataManager`

Manages semantic entities with built-in persistence and UI hints.

```tsx
import { FusionDataManager } from '@pcp/fusion';

export const ContactList = () => (
  <FusionDataManager
    targetType="http://schema.org/Person"
    uiHint="Display as a dense list for high-frequency access"
    onEntityDelete={(id) => console.log(`Deleted ${id}`)}
  />
);
```

### `FusionAuthGuard`

A high-order component that protects semantic views based on VKG-defined permissions.

```tsx
import { FusionAuthGuard } from '@pcp/fusion';
import { AutoSemanticView } from '@pcp/auto';

export const SecureProfile = ({ userUri }) => (
  <FusionAuthGuard requiredScope="profile:read">
    <AutoSemanticView subject={userUri} />
  </FusionAuthGuard>
);
```

### `UnifiedAuthScreen`

The standard composition for all entry points, supporting multi-modal identity.

```tsx
import { UnifiedAuthScreen } from '@pcp/compositions';

export const AppEntry = () => (
  <UnifiedAuthScreen
    onSuccess={() => navigate('/dashboard')}
    providers={['passkey', 'oidc', 'biometric']}
  />
);
```

## 2030 Best Practices

- **Semantic First:** Always define data structures in RDF before building UI.
- **Adaptive UX:** Use `AdaptiveInteractionWrapper` to ensure accessibility is baked in, not bolted on.
- **Graceful Degradation:** Use `AutoFixer` during development to identify missing schema mappings.
