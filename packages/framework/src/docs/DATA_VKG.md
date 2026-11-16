# Virtual Knowledge Graph (VKG) & Data Layer

The Pcp Framework SDK leverages a **Virtual Knowledge Graph (VKG)** as its foundational data layer. Unlike traditional flat or relational data stores, the VKG treats information as a multi-dimensional web of interconnected nodes and edges, enabling high-performance semantic reasoning, neuro-symbolic querying, and predictive data orchestration.

## Architecture Layers

### 1. `vkg/react`

The React integration layer providing hooks and context providers to bind graph-state to the UI. It handles automatic re-renders when the underlying graph topology changes.

### 2. `vkg/semantic`

The semantic abstraction layer. It translates developer-friendly fluent queries into RDF-compliant graph patterns. It allows for complex matching across distributed data sources.

### 3. `vkg/inference`

A local execution environment for Datalog-style inference rules. It allows the SDK to derive new knowledge from existing quads in real-time without server round-trips (e.g., if `A parentOf B` and `B parentOf C`, then `A grandparentOf C`).

### 4. `neuro-symbolic`

The bridge between symbolic logic (RDF) and neural embeddings. It enables "fuzzy" semantic searches that combine exact graph matches with vector-based similarity, allowing for natural language queries over structured data.

### 5. `predictive`

The anticipatory data layer. It analyzes user interaction patterns and graph proximity to prefetch data before it is explicitly requested, ensuring zero-latency transitions.

---

## RDF Graph Concept

Pcp utilizes the **RDF (Resource Description Framework)** standard. Data is stored as **Quads**:

- **Subject**: The entity being described (e.g., a User ID).
- **Predicate**: The relationship or property (e.g., `schema:knows`).
- **Object**: The value or target entity (e.g., another User ID).
- **Graph**: The named context or provenance of this fact.

This "Web of Data" approach ensures that information is globally unique, machine-readable, and highly extensible without schema migrations.

---

## Semantic Query Builder API

The `RdfQueryBuilder` provides a fluent, type-safe interface for constructing graph queries.

```typescript
import { useVkg } from '@pcp/framework/vkg/react';
import { RdfQueryBuilder } from '@pcp/framework/vkg/query';

const client = useVkg();
const builder = new RdfQueryBuilder(client);

const results = await builder.subject('user:123').predicate('schema:worksFor').execute();
```

---

## Local Graph Inference

The `useGraphInference` hook executes a local inference engine over cached data. This is critical for "Infinite Intelligence" applications where the UI needs to react to logical consequences of data updates instantly.

```typescript
const { inferredQuads } = useGraphInference(client, [
  {
    name: 'GrandparentRule',
    if: [
      { s: '?a', p: 'parentOf', o: '?b' },
      { s: '?b', p: 'parentOf', o: '?c' },
    ],
    then: { s: '?a', p: 'grandparentOf', o: '?c' },
  },
]);
```

---

## Code Examples

### 1. `useGraphTraversal`

Use this hook to walk the graph from a specific node across a defined predicate.

```tsx
import { useGraphTraversal } from '@pcp/framework/vkg/react';

function UserConnections({ userId }) {
  const { objects: friends, loading } = useGraphTraversal(client, `user:${userId}`, 'schema:knows');

  if (loading) return <Spinner />;

  return (
    <ul>
      {friends.map((friend) => (
        <li key={friend.value}>{friend.value}</li>
      ))}
    </ul>
  );
}
```

### 2. `useNeuroSymbolicQuery`

Perfect for building search interfaces that understand intent, not just keywords.

```tsx
import { useNeuroSymbolicQuery } from '@pcp/framework/data/neuro-symbolic';

function SemanticSearch({ userPrompt }) {
  const { data, loading } = useNeuroSymbolicQuery(client, {
    symbolic: {
      predicate: 'schema:description',
    },
    neuro: {
      prompt: userPrompt,
      threshold: 0.85,
      limit: 5,
    },
  });

  return (
    <div>
      {data.map(({ quad, score }) => (
        <div key={quad.subject.value}>
          <p>{quad.object.value}</p>
          <span>Relevance: {(score * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}
```

### 3. `usePredictivePrefetch`

Optimize user experience by fetching data in anticipation of navigation.

```tsx
import { usePredictivePrefetch } from '@pcp/framework/data/predictive';

function ProductDetails({ productUri }) {
  // Prefetches related technical specs and reviews based on graph proximity
  usePredictivePrefetch(productUri, { depth: 2, proximityThreshold: 0.9 });

  return <View>...</View>;
}
```

---

## 2030 Best Practices

1. **Context-Aware Prefetching**: Always use `usePredictivePrefetch` in list views to warm the cache for detail transitions.
2. **Schema Alignment**: Favor standard ontologies (Schema.org, FOAF) to ensure interoperability with the broader Semantic Web.
3. **Inference Over Logic**: Move complex business logic into Inference Rules rather than hardcoding `if/else` statements in React components.
4. **Deterministic Terms**: Use the `DataFactory` to create `NamedNode` and `Literal` terms to maintain type-safety across the graph.
