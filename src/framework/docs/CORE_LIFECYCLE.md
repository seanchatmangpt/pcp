# Core Application Lifecycle & Shell

The Pcp Framework SDK provides a unified, autonomic shell that governs the application's boot sequence, environment synchronization, and micro-frontend orchestration.

## Pcp2030 Root Provider

The `Pcp2030` component (located in `src/framework/2030/core/Pcp2030.tsx`) is the primary entry point for all Pcp applications. It acts as a "batteries-included" root provider that encapsulates:

- **Security Membranes**: Hardware-backed isolation of application logic via `MembraneProvider`.
- **Autonomic State**: Integrated synchronization and state management via the Sync-Extreme engine.
- **Contextual Awareness**: Automatic setup of UI themes, session providers, and Vector Knowledge Graph (VKG) actors.

## Zero-Config i18n

The i18n system (`src/framework/core/i18n`) is designed for semantic clarity with zero manual configuration.

- **`I18nProvider`**: Automatically detects user locale and fetches necessary dictionaries from the semantic store.
- **`useTranslation`**: ultra-fast hook that supports dynamic language switching, pluralization, and string interpolation natively.
- **Semantic Translation**: Uses predictive algorithms to ensure localized strings maintain context across different cultural domains.

## Micro-Frontend Federation

Pcp supports seamless Micro-Frontend (MFE) orchestration through 2030-standard module federation.

- **`FederatedComponent`**: Dynamically loads remote modules with built-in error isolation boundaries and holographic loading states.
- **Dynamic Registry**: `useModuleFederation` manages the registry and lifecycle of remote entry points, allowing for hot-swapping of features without a full application reload.

## App Lifecycle Orchestrator

The `PlatformKernel` (found in `src/framework/compositions/platform-orchestration/`) coordinates the complex interactions between local memory and remote sync:

- **Boot Sequence**: Orchestrates a parallelized startup of critical services (Auth, Sync, Membrane) before the UI renders.
- **Memory Reclamation**: Automatically reclaims resources from inactive or backgrounded micro-frontends to maintain peak performance.
- **Sync Reconciliation**: Orchestrates the extreme sync engine to maintain state consistency across distributed agents and holographic interfaces.
- **Self-Optimization**: Monitors device vitals (thermal, battery, FPS) and automatically throttles sync frequency and animation complexity to preserve performance.

This architecture ensures that developers can focus on building features while the Pcp Framework handles the complexities of security, localization, and distributed state management.
