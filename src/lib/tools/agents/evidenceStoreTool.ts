import type { ExtractedDoc } from './readerExtractorTool';

export type EvidenceSource = { url: string; title?: string };
export type EvidenceItem = {
  claim: string;
  sources: EvidenceSource[];
  examples?: string[]; // example quotes
  supportCount: number;
};

function normalizeClaim(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_+={}[\]|\\:;"'<>,.?/\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function evidenceStoreTool(extracted: ExtractedDoc[]): EvidenceItem[] {
  const map = new Map<string, EvidenceItem>();
  for (const doc of extracted) {
    const src: EvidenceSource = { url: doc.url, title: doc.title };
    // Use facts as claims; quotes as examples
    for (const fact of doc.facts) {
      const key = normalizeClaim(fact);
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        // Merge sources without duplicates
        if (!existing.sources.find((s) => s.url === src.url)) {
          existing.sources.push(src);
        }
        existing.supportCount += 1;
      } else {
        map.set(key, {
          claim: fact.trim(),
          sources: [src],
          examples: [],
          supportCount: 1,
        });
      }
    }
    // Attach up to one quote per doc to the most recent claim when available
    if (doc.quotes.length > 0) {
      const lastFact = doc.facts[doc.facts.length - 1];
      if (lastFact) {
        const key = normalizeClaim(lastFact);
        const item = map.get(key);
        if (item) {
          item.examples = item.examples || [];
          if (item.examples.length < 3) item.examples.push(doc.quotes[0]);
        }
      }
    }
  }
  // Return items sorted by supportCount desc
  return Array.from(map.values()).sort(
    (a, b) => b.supportCount - a.supportCount,
  );
}
