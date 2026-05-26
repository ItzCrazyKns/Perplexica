import { ClaimChart, MemoSkeleton, MEMO_DISCLAIMER, RankedDocument } from './schemas';

export function renderMemoMarkdown(memo: MemoSkeleton): string {
  const lines: string[] = [];
  lines.push(`> ${MEMO_DISCLAIMER}`);
  lines.push('');
  lines.push(`# Prior Art Research Memo`);
  lines.push('');
  lines.push(`## 1. Feature Description`);
  lines.push(memo.featureDescription);
  lines.push('');
  lines.push(`## 2. Search Strategy`);
  lines.push(`- Priority date: ${memo.searchStrategy.priorityDate}`);
  lines.push(`- Sources: ${memo.searchStrategy.sources.join(', ')}`);
  lines.push(`- CPC classes: ${memo.searchStrategy.cpcClasses.join(', ') || '(none)'}`);
  lines.push(`- Keyword clusters: ${memo.searchStrategy.keywordClusters.join(' | ') || '(none)'}`);
  lines.push('');

  if (memo.reframe) {
    const rf = memo.reframe;
    lines.push(`## 2b. Reframe (Gemini Deep Research)`);
    if (rf.ambiguousTerms.length) {
      lines.push(`**Identified ambiguities**:`);
      for (const a of rf.ambiguousTerms) {
        lines.push(
          `- _${a.term}_ → intended: ${a.intendedMeaning}; collides with: ${a.collisions.join(', ') || '(none)'}`,
        );
      }
      lines.push('');
    }
    if (rf.trueTechnicalPillars.length) {
      lines.push(`**True technical pillars**:`);
      for (const p of rf.trueTechnicalPillars) {
        lines.push(`- **${p.pillar}** — ${p.domainContext}`);
        if (p.relatedKnownArt.length) {
          lines.push(`  - related known art: ${p.relatedKnownArt.join(', ')}`);
        }
      }
      lines.push('');
    }
    if (rf.nonPatentPriorArt.length) {
      lines.push(
        `**Non-patent prior art surfaced** (review separately from §102 patent art):`,
      );
      for (const npa of rf.nonPatentPriorArt) {
        lines.push(`- [${npa.type}] [${npa.title}](${npa.url}) — ${npa.relevance}`);
      }
      lines.push('');
    }
    if (rf.noiseDomainsToAvoid.length) {
      lines.push(`**Noise domains filtered**: ${rf.noiseDomainsToAvoid.join(' · ')}`);
      lines.push('');
    }
  }

  lines.push(`## 3. Landscape Findings`);
  lines.push(`### Top assignees`);
  for (const a of memo.landscapeFindings.topAssignees) {
    lines.push(`- ${a.name} — ${a.count} docs (filings ${a.earliestFiling ?? '?'} → ${a.latestFiling ?? '?'})`);
  }
  lines.push('');
  lines.push(`### CPC distribution`);
  for (const c of memo.landscapeFindings.cpcDistribution) {
    lines.push(`- ${c.code} — ${c.count}`);
  }
  lines.push('');
  lines.push(`### Highly cited`);
  for (const h of memo.landscapeFindings.highlyCitedReferences) {
    lines.push(`- ${h.publicationNumber} — ${h.citationCount} forward cites`);
  }
  lines.push('');
  lines.push(`### Whitespace candidates`);
  for (const w of memo.landscapeFindings.whitespaceCandidates) lines.push(`- ${w}`);
  lines.push('');
  if (memo.elementCoverage && memo.elementCoverage.length) {
    const counts = countNovelty(memo.elementCoverage);
    lines.push(`## 4. Element Coverage Matrix`);
    lines.push(
      `Per-element prior-art coverage at cosine threshold. Likely novel: ${counts.likely_novel} · Partial: ${counts.partial} · Anticipated risk: ${counts.anticipated_risk}.`,
    );
    lines.push('');
    lines.push(`| Element | Name | Hits | Max Sim | Risk | Top References |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const ec of memo.elementCoverage) {
      const refs = ec.matchingRefs.length
        ? ec.matchingRefs
            .map((r) => `${r.publicationNumber} (${r.similarity.toFixed(2)})`)
            .join(', ')
        : '(none)';
      lines.push(
        `| ${ec.label} | ${escapeMd(ec.name)} | ${ec.hitCount} | ${ec.maxSimilarity.toFixed(2)} | ${noveltyBadge(ec.novelty)} | ${escapeMd(refs)} |`,
      );
    }
    lines.push('');
  }

  if (memo.primaryReference) {
    const pr = memo.primaryReference;
    lines.push(`## 5. Primary Reference to Distinguish Over`);
    lines.push(
      `**${pr.publicationNumber}** — ${pr.title} — covers ${pr.coveredElements.length}/${pr.coveredElements.length + pr.distinguishingElements.length} elements (${(pr.elementCoverageFraction * 100).toFixed(0)}%).`,
    );
    lines.push('');
    lines.push(`- **Covered elements**: ${pr.coveredElements.join(', ') || '(none)'}`);
    lines.push(
      `- **Distinguishing elements** (counsel drafts around these for §103): ${pr.distinguishingElements.join(', ') || '(none)'}`,
    );
    lines.push('');
  } else if (memo.elementCoverage && memo.elementCoverage.length) {
    lines.push(`## 5. Primary Reference to Distinguish Over`);
    lines.push(
      `_No single reference covered ≥20% of the feature's technical elements. Invention is a novel-combination case; §103 obviousness territory rather than §102 anticipation. Counsel should weigh motivation-to-combine across the top references in §6._`,
    );
    lines.push('');
  }

  if (memo.patentableEdges && memo.patentableEdges.length) {
    const strong = memo.patentableEdges.filter((e) => e.strength === 'strong').length;
    const moderate = memo.patentableEdges.filter((e) => e.strength === 'moderate').length;
    const weak = memo.patentableEdges.filter((e) => e.strength === 'weak').length;
    lines.push(`## 6. Patentable Edges (per-pillar prior-art positioning)`);
    lines.push(
      `${memo.patentableEdges.length} pillars distilled — strong: ${strong} · moderate: ${moderate} · weak: ${weak}. Counsel uses each entry below as claim-drafting prep: the **combination edge** is the §103 non-obviousness anchor.`,
    );
    lines.push('');
    memo.patentableEdges.forEach((edge, idx) => {
      lines.push(`### 6.${idx + 1} ${edge.pillar} — _${edge.strength}_`);
      lines.push('');
      lines.push(`**Closest prior art**:`);
      for (const pa of edge.priorArtSummaries) {
        lines.push(`- **${pa.art}** — ${pa.teaching}`);
      }
      lines.push('');
      lines.push(`**Combination edge**: ${edge.combinationEdge}`);
      lines.push('');
      lines.push(`**Emergent property** (§103 anchor): ${edge.emergentProperty}`);
      lines.push('');
      lines.push(`**Suggested claim language**: ${edge.suggestedClaimLanguage}`);
      if (edge.benchmarkDelta) {
        lines.push('');
        lines.push(`**Benchmark delta**: ${edge.benchmarkDelta}`);
      }
      lines.push('');
    });
  }

  lines.push(`## 7. References of Interest`);
  for (const r of memo.referencesOfInterest) {
    lines.push(`- **${r.publicationNumber}** — ${r.title}`);
    lines.push(`  - ${r.relevanceNote}`);
  }
  lines.push('');
  if (memo.claimChart) {
    lines.push(`## 8. Claim Chart`);
    lines.push(renderClaimChart(memo.claimChart));
    lines.push('');
  }
  lines.push(`## 9. Open Questions for Counsel`);
  for (const q of memo.openQuestionsForCounsel) lines.push(`- ${q}`);
  lines.push('');
  if (memo.verificationWarnings.length) {
    lines.push(`## 10. Verification Warnings`);
    for (const w of memo.verificationWarnings) lines.push(`- ${w}`);
    lines.push('');
  }
  lines.push('---');
  lines.push(`> ${MEMO_DISCLAIMER}`);
  return lines.join('\n');
}

function countNovelty(coverage: MemoSkeleton['elementCoverage']) {
  const out = { likely_novel: 0, partial: 0, anticipated_risk: 0 };
  for (const ec of coverage) out[ec.novelty]++;
  return out;
}

function noveltyBadge(n: 'likely_novel' | 'partial' | 'anticipated_risk'): string {
  switch (n) {
    case 'likely_novel':
      return '✅ novel';
    case 'partial':
      return '◐ partial';
    case 'anticipated_risk':
      return '⚠️ risk';
  }
}

export function renderClaimChart(chart: ClaimChart): string {
  const rows: string[] = [];
  rows.push('| Element | Reference | Pinpoint | Excerpt |');
  rows.push('|---|---|---|---|');
  for (const e of chart.elements) {
    const mappings = chart.mappings.filter((m) => m.elementLabel === e.label);
    if (!mappings.length) {
      rows.push(`| ${e.label}: ${escapeMd(e.text)} | (no mapping) | | |`);
      continue;
    }
    for (const m of mappings) {
      rows.push(
        `| ${e.label}: ${escapeMd(e.text)} | ${m.referencePublicationNumber} | ${m.pinpoint} | ${escapeMd(m.excerpt)} |`,
      );
    }
  }
  return rows.join('\n');
}

export function renderRankedSet(refs: RankedDocument[]): string {
  return refs
    .map(
      (r, i) =>
        `${i + 1}. ${r.publicationNumber} — ${r.title} (score ${r.fusedScore.toFixed(4)})`,
    )
    .join('\n');
}

function escapeMd(s: string): string {
  return s.replaceAll('|', '\\|').replaceAll('\n', ' ');
}
