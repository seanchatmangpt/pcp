# Pcp Framework: Developer Experience (DX) & Tooling

The Pcp Framework provides a comprehensive suite of tools designed to accelerate development, ensure architectural consistency, and maintain system health through autonomous agents.

## 1. CLI Scaffolding (`dx/cli-scaffold`)

Pcp uses a "Wizard" system to manufacture production-ready code skeletons. These are driven by templates defined in `src/framework/dx/cli-scaffold/templates.ts` and managed via the `truex` CLI.

### CLI Scaffolding Blueprints

Blueprints allow for compositional generation of multiple related files (types, hooks, UI, sync logic) from a single command.

**Usage Examples:**

- **Scaffold an Actor Behavior:**
  ```bash
  npm run truex wizard actor Sermon
  ```
- **Scaffold a Process Intelligence Capability:**
  ```bash
  npm run truex wizard intelligence BottleneckDetector
  ```
- **Scaffold a CRUD Composition (Blueprint):**
  Uses the `CRUDWithAISearchAndSync` generator to create:
  - Semantic Type: `src/types/semantic/Resource.ts`
  - Hook: `src/hooks/useResource.ts`
  - UI Card: `src/components/ResourceCard.tsx`
  - Sync Handler: `src/sync/ResourceSyncHandler.ts`

## 2. In-App Documentation Explorer (`core/docs`)

The **DocExplorer** provides a live, interactive documentation browser directly within the application. It parses Markdown and TSX documentation files to offer a "Single Source of Truth" for developers and power users.

- **Component**: `DocExplorer.tsx`
- **Registry**: `DocRegistry.ts`
- **Feature**: Supports live preview of components and interactive API documentation.

## 3. Autonomous Testing & Repair (`2030/qa-autonomous`)

The **AutonomousRepairAgent** is a "self-healing" subsystem that monitors application state and automatically triggers repair cycles when invariant violations are detected.

### Key Components:

- **AutonomousRepairAgent.ts**: Orchestrates the diagnostic and repair loop.
- **StateMonitor.ts**: Watches the VKG (Value Knowledge Graph) for anomalies.
- **TestGenerator.ts**: Dynamically creates Jest/Maestro test cases to reproduce and verify fixes.

### Workflow:

1. **Detect**: The `StateMonitor` identifies a state drift or crash.
2. **Diagnose**: The `AutonomousRepairAgent` analyzes the trace.
3. **Repair**: The agent applies a patch or triggers a re-sync.
4. **Verify**: The `TestRunner` executes generated tests to confirm the fix.

## Usage Example: Custom Scaffolding Blueprint

To create a new blueprint, implement the `CompositionalBlueprint` interface:

```typescript
// src/framework/compositions/blueprints/generators/my-generator.ts
export const MyBlueprint: CompositionalBlueprint = {
  name: 'my-feature',
  generate: (name) => [
    { path: `src/types/${name}.ts`, content: myTemplate(name) },
    // ... additional files
  ],
};
```
