# Switchyard: Real-Time Routing for Sovereign-Capital Flow Events

## Summary
Switchyard ingests sovereign capital flow events (treasury allocations, central bank ops, sovereign wealth fund rebalances) and routes them in real time to subscribers whose interest profiles match the event signature. The interest matching uses a hybrid of dense semantic embeddings over the event payload and a rules engine evaluating sanctioned-entity exclusions.

## Technical elements
1. Event signature is computed via a streaming embedding pipeline that produces a vector commitment plus a merkle root of the underlying event fields, enabling downstream subscribers to verify provenance without re-fetching the source feed.
2. Subscriber interest profiles are stored as a hybrid index: dense vectors for semantic matching plus a sparse Boolean tree for sanctioned-entity gates.
3. Routing decisions are committed to an append-only log keyed by event hash; subscribers can replay or backfill from any commit point.
4. The system enforces per-jurisdiction routing policies via a compile-time-checked rule DSL evaluated at the edge.

## Component technologies
- streaming vector embedding
- merkle-tree state commitment
- subscriber interest matching
- sanctioned-entity gating
- real-time event routing
- append-only log with hash-keyed replay
