# Pcp Framework SDK API Index

Welcome to the central API index for the Pcp Framework SDK. This document provides a high-level overview of all exported hooks, components, and utilities, categorized by domain for 1000x developer velocity.

## 🧭 Navigation

- [UI & UX](#-ui--ux)
- [Auth & Identity](#-auth--identity)
- [Data & VKG](#-data--vkg)
- [Sync & CRDT](#-sync--crdt)
- [State Management](#-state-management)
- [Admin & Ops](#-admin--ops)
- [XR & Spatial](#-xr--spatial)
- [AI & Inference](#-ai--inference)
- [Core & Foundation](#-core--foundation)

---

## 🎨 UI & UX

Modern, accessible, and high-performance UI primitives.
**Deep Dive:** [UI_UX.md](./UI_UX.md)

### Components

| Component                            | Description                                        |
| :----------------------------------- | :------------------------------------------------- |
| `Button`                             | Versatile button with multiple variants and sizes. |
| `Badge`                              | Status and labeling indicators.                    |
| `GlassButton` / `GlassCard`          | Glassmorphism-based UI elements.                   |
| `FadeIn` / `SlideTransition`         | Standard animation wrappers.                       |
| `Stagger` / `ScalePress`             | Advanced interaction animations.                   |
| `PinchToZoom` / `SwipeToDismiss`     | Gesture-enabled containers.                        |
| `AvatarRelativeProjectionMatrixView` | Specialized 3D projection view.                    |
| `GenerativeView`                     | Schema-driven dynamic UI renderer.                 |
| `ConfettiCannon` / `ParticleEmitter` | Visual feedback and delight systems.               |
| `OfflineBanner`                      | Automatic connectivity status indicator.           |
| `AutoFixer`                          | AI-assisted error recovery UI.                     |

### Hooks

| Hook                  | Description                                        |
| :-------------------- | :------------------------------------------------- |
| `useTheme`            | Access current theme colors and settings.          |
| `useUpdateTheme`      | Programmatically switch or update themes.          |
| `useA11y`             | Intelligent accessibility state management.        |
| `useHaptics`          | Trigger intelligent haptic feedback patterns.      |
| `useVoiceIntent`      | Handle voice commands and natural language intent. |
| `useGenerativeLayout` | Calculate layouts based on semantic schemas.       |

---

## 🔐 Auth & Identity

Zero-trust, multi-boundary authentication and RBAC.
**Deep Dive:** [SECURITY_IDENTITY.md](./SECURITY_IDENTITY.md)

### Components

| Component        | Description                                              |
| :--------------- | :------------------------------------------------------- |
| `AuthProvider`   | Root context provider for session management.            |
| `ProtectedRoute` | Declarative route protection based on roles/permissions. |
| `MfaProvider`    | Orchestrates multi-factor authentication flows.          |

### Hooks

| Hook                 | Description                                       |
| :------------------- | :------------------------------------------------ |
| `useAuth`            | Main hook for accessing session and auth methods. |
| `useRBAC`            | Check roles and permissions dynamically.          |
| `useBiometricAuth`   | Native biometric (FaceID/TouchID) integration.    |
| `useBehavioralAuth`  | Passive behavioral biometric verification.        |
| `useZkClaimVerifier` | Zero-Knowledge Proof based claim verification.    |
| `useMfa`             | Interface for managing MFA challenges.            |

---

## 📊 Data & VKG

Vector Knowledge Graph (VKG) and semantic data orchestration.
**Deep Dive:** [DATA_VKG.md](./DATA_VKG.md)

### Components

| Component      | Description                                            |
| :------------- | :----------------------------------------------------- |
| `SemanticForm` | Form generated automatically from RDF/JSON-LD schemas. |

### Hooks

| Hook                       | Description                                       |
| :------------------------- | :------------------------------------------------ |
| `useSemanticNode`          | Fetch and subscribe to a single VKG node.         |
| `usePaginatedSemanticNode` | Handle large collections of semantic data.        |
| `useOptimisticMutation`    | Perform data updates with instant UI feedback.    |
| `useNeuroSymbolicQuery`    | Execute hybrid AI/Logic queries against the VKG.  |
| `usePredictivePrefetch`    | AI-driven prefetching based on user trajectory.   |
| `useOfflineSearch`         | Full-text search that works without connectivity. |

---

## 🔄 Sync & CRDT

P2P synchronization and conflict-free replicated data types.
**Deep Dive:** [SYNC_STATE.md](./SYNC_STATE.md)

### Components

| Component            | Description                                       |
| :------------------- | :------------------------------------------------ |
| `MeshSyncProvider`   | Enables P2P synchronization for children.         |
| `SyncReplayDebugger` | Visual tool for debugging synchronization events. |

### Hooks

| Hook                    | Description                                        |
| :---------------------- | :------------------------------------------------- |
| `useCrdtState`          | Synchronize complex state using custom CRDTs.      |
| `useLWWRegister`        | Last-Write-Wins atomic register.                   |
| `usePNCounter`          | Positive-Negative counter for distributed tallies. |
| `useMeshSync`           | Subscribe to a specific P2P mesh topic.            |
| `usePayloadCompression` | Transparent compression for sync payloads.         |

---

## 🧠 State Management

Resilient, persisted, and proxied application state.
**Deep Dive:** [CORE_LIFECYCLE.md](./CORE_LIFECYCLE.md)

### Hooks

| Hook           | Description                                            |
| :------------- | :----------------------------------------------------- |
| `useHydration` | Check if persisted state has been loaded from storage. |

### Utilities

| Utility                | Description                                        |
| :--------------------- | :------------------------------------------------- |
| `createProxyStore`     | Create a store that proxies a native object.       |
| `syncStores`           | Bi-directional synchronization between two stores. |
| `createStorageAdapter` | Standard interface for local/remote persistence.   |

---

## 🛠 Admin & Ops

Mission control, performance monitoring, and observability.
**Deep Dive:** [RESILIENCE_SUPERVISION.md](./RESILIENCE_SUPERVISION.md)

### Components

| Component          | Description                                 |
| :----------------- | :------------------------------------------ |
| `AdminShell`       | Layout for administrative dashboards.       |
| `LogViewer`        | High-performance system log browser.        |
| `TelemetryGraph3D` | 3D visualization of system membrane health. |
| `QuadDeltaPreview` | Low-level VKG delta inspector.              |

### Hooks

| Hook                     | Description                                       |
| :----------------------- | :------------------------------------------------ |
| `usePerformanceMonitor`  | Real-time FPS, memory, and CPU metrics.           |
| `useAppVitals`           | Tracks application health and crash reports.      |
| `usePresence`            | Real-time collaborative presence (who is online). |
| `useCollaborationEvents` | Generic event bus for multi-user collaboration.   |

---

## 🥽 XR & Spatial

Spatial computing and augmented reality primitives.

### Components

| Component         | Description                                      |
| :---------------- | :----------------------------------------------- |
| `SpatialProvider` | Root context for spatial tracking and anchoring. |
| `SpatialView`     | Container for 3D/Spatial content.                |

### Hooks

| Hook                 | Description                                     |
| :------------------- | :---------------------------------------------- |
| `useSpatialPosition` | Track objects in 3D space relative to the user. |

---

## 🤖 AI & Inference

On-device intelligence and neuro-symbolic reasoning.

### Hooks

| Hook                | Description                               |
| :------------------ | :---------------------------------------- |
| `useLocalInference` | Run LLM/ML models directly on the device. |

### Utilities

| Utility                | Description                                |
| :--------------------- | :----------------------------------------- |
| `LocalInferenceEngine` | Core engine for managing on-device models. |

---

## 🏛 Core & Foundation

The backbone of the Pcp Framework.
**Deep Dive:** [ARCHITECTURE.md](./ARCHITECTURE.md)

### Components

| Component              | Description                                    |
| :--------------------- | :--------------------------------------------- |
| `PcpFrameworkProvider` | Global root provider for the entire SDK.       |
| `MembraneProvider`     | Isolation and security boundary provider.      |
| `I18nProvider`         | Internationalization and localization context. |
| `FederatedComponent`   | Load micro-frontend modules dynamically.       |
| `ErrorBoundary`        | Graceful degradation and error reporting.      |

### Hooks

| Hook                  | Description                                   |
| :-------------------- | :-------------------------------------------- |
| `useMembrane`         | Access the current security membrane context. |
| `useTranslation`      | Access localized strings and formatting.      |
| `useModuleFederation` | Low-level control for dynamic code loading.   |

### Utilities

| Utility       | Description                                 |
| :------------ | :------------------------------------------ |
| `docRegistry` | Runtime access to component JSDoc metadata. |
