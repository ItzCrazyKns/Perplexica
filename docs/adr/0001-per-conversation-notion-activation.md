# Notion access is granted per conversation, never globally

OAuth authorization establishes the instance-level Notion connection, but Vane may only touch a page that the user has explicitly selected or named in that same conversation; the connection alone grants nothing. Chosen so self-hosted users keep strict control over which notes an AI may read or write, mirroring Perplexity's @-connector behavior, while staying inside Vane's existing per-chat sources mechanism (a `'notion'` value of `SearchSources`).
