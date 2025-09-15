# Firecrawl Integration: Before vs After

This document highlights the impact of enabling Firecrawl for page retrieval and enrichment in Perplexica.

## Summary

- Before: Pages were fetched as raw HTML and converted to plain text via `html-to-text`, with minimal metadata and limited structure. PDFs were parsed with `pdf-parse`.
- After: Firecrawl provides structured, markdown-first content and richer metadata. The summarizer receives cleaner, denser context leading to higher-quality answers.

## What Improved

- Better snippet quality: Markdown preserves headings, lists, and code blocks; noise from navigation/menus is reduced.
- More coverage: Firecrawl returns fuller page content consistently across sites; less content loss vs. naive HTML-to-text.
- Enhanced metadata: Title, description, language, authorship, and other fields become available to guide ranking and display.

## Where It’s Used

- `src/lib/utils/documents.ts` now attempts Firecrawl first for each URL. If Firecrawl is not configured or fails for a URL, it falls back to the legacy extractor.

## How To Reproduce

1. Copy `.env.example` to `.env.local` and set `FIRECRAWL_API_KEY`.
2. Install SDK: `pnpm add @mendable/firecrawl-js`.
3. Start dev server: `pnpm dev`.
4. Query examples:
   - “Latest AI frameworks 2025”
   - “How to deploy Next.js on Docker”

Observe:

- Sources include clean titles and body text with sections.
- Fewer garbled snippets, improved recall across long pages.

## CLI Demo

Run a one-off scrape to inspect raw Firecrawl output:

```bash
FIRECRAWL_API_KEY=... node scripts/crawlTest.mjs https://techcrunch.com
```

This prints enriched JSON, including `markdown`, `html`, `raw`, and `metadata`.

## Notes

- The integration is non-breaking. Without an API key or on per-URL failures, Perplexica uses the original extraction path.
- No UI changes are required; improvements flow through the existing search + summarization pipeline.
