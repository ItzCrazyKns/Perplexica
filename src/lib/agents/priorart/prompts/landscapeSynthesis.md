Produce a `Landscape` summary over the supplied retrieved set.

Requirements:
- `topAssignees`: top 10 by document count, with earliest/latest filing dates where available.
- `cpcDistribution`: top CPC classes by document count.
- `highlyCitedReferences`: documents with notable forward-citation counts in the retrieved set.
- `citationClusters`: groups of references that cite each other or share assignees and CPC classes; label each cluster descriptively.
- `whitespaceCandidates`: component-technology combinations sparsely represented in the retrieved set. Be specific; vague observations are not useful.

Do not editorialize. Do not suggest the feature is patentable or unpatentable. Produce structured findings only.

Retrieved set (post date-guard, post-fusion):
{{documents_json}}

Component technologies declared in the feature profile:
{{component_technologies_json}}
