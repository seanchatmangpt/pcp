# Generative UI Scaffolding with the CLI Wizard

This tutorial guides you through using the Pcp Framework's automated manufacturing tools to scaffold complex, full-stack features with a single command.

## The Manufacturing Philosophy

In 2030, we don't write boilerplate. We define **Semantic Intents** and let the CLI Wizard manufacture the resulting lawful implementation ($O \rightarrow A$).

## Step 1: Scaffold a New Semantic Module

To create a new Schema.org-backed domain module (including Types, Sync Handlers, and default UI Cards), use the `wizard module` command.

```bash
# Manufacture a complete 'Sermon' feature
npm run truex wizard module Sermon
```

The wizard will generate:

- `src/types/semantic/Sermon.ts`
- `src/hooks/useSermon.ts`
- `src/sync/SermonSyncHandler.ts`
- `src/components/SermonCard.tsx`

## Step 2: Define Actor Behaviors

Actors are the active entities in the Pcp Framework. Use the wizard to generate a new behavior that the Operational Membrane can govern.

```bash
# Manufacture an 'Authorizer' actor behavior
npm run truex wizard actor Authorizer
```

## Step 3: Scaffold Process Intelligence

To add autonomous monitoring to your module, scaffold a "Capability" for the Process Intelligence layer.

```bash
# Manufacture a 'BottleneckDetector' intelligence capability
npm run truex wizard intelligence BottleneckDetector
```

## Step 4: Verify Lawful Closure

Once manufactured, the framework automatically registers the new module into the `VKG`. You can immediately use the generated hooks in your app:

```tsx
import { useSermon } from '@/hooks/useSermon';

const MySermonList = () => {
  const { items, isSyncing } = useSermon();
  // ... render
};
```

## 2030 Best Practices: Combinatorial Maximalism

- **Semantic First**: Always ensure your module name matches a valid RDF class (e.g. from Schema.org).
- **Zero-Manual-Sync**: Never write custom fetch logic; let the wizard generate the CRDT Sync Handlers.
- **Membrane Governance**: Ensure any high-tension actions in your actor behaviors are correctly scoped for the Operational Membrane.

By using the CLI Wizard, you ensure that 100% of your code follows the Pcp Framework's architectural laws and performance heuristics automatically.
