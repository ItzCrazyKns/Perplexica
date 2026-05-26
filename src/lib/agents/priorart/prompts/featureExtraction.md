Extract a structured `FeatureProfile` from the Switchyard feature description below. This profile is the bridge between product language and patent-language search queries. Treat this as the highest-leverage step of the pipeline.

Requirements:
- `technicalElements`: enumerate each separable technical contribution. For each, write a short novelty hypothesis describing what prior art it appears to improve over. Be concrete and patent-like in phrasing.
- `cpcClassesSuggested`: propose CPC classes you would search. Do not validate; downstream code does not assume these are correct.
- `keywordClusters`: group SEO-friendly keywords by sub-topic so each cluster maps to a coherent Boolean query.
- `semanticQueries`: short natural-language strings suitable for embedding-based similarity recall.
- `componentTechnologies`: the underlying primitives this feature composes (e.g. "vector similarity search", "real-time event routing", "merkle-tree state commitment"). Used for landscape clustering.
- `featureId`: kebab-case slug derived from the title; stable across runs.

Do not include legal conclusions. Do not assert novelty as fact — only hypothesize.

Feature description:
{{feature_description}}
