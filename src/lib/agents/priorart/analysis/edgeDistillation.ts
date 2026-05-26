import z from 'zod';
import type { ReframeResult } from './deepResearchReframe';

export const priorArtTeachingSchema = z.object({
  art: z.string().describe('Named reference (e.g. "Firecracker", "arXiv:2605.03375", "RouteLLM").'),
  teaching: z.string().describe('1-2 sentence summary of what this reference teaches, grounded in the actual source.'),
});

export const patentableEdgeSchema = z.object({
  pillar: z.string(),
  priorArtSummaries: z.array(priorArtTeachingSchema),
  combinationEdge: z
    .string()
    .describe(
      'The specific combination that goes BEYOND any single referenced piece of prior art. Name what is added and to what.',
    ),
  emergentProperty: z
    .string()
    .describe(
      '§103 non-obviousness anchor: the measurable property (latency tier, refusal guarantee, settlement primitive, etc.) that emerges ONLY from the combination, not from any single component alone.',
    ),
  suggestedClaimLanguage: z
    .string()
    .describe(
      'High-level claim-drafting language counsel can adapt — NOT actual claim text. Pattern: "A method comprising: [combination element A]; [combination element B]; wherein [emergent property]."',
    ),
  benchmarkDelta: z
    .string()
    .nullable()
    .optional()
    .describe(
      'If user supplied A/B benchmark data showing this pillar beats named alternatives, summarize the delta here.',
    ),
  strength: z
    .enum(['strong', 'moderate', 'weak'])
    .describe(
      'Self-assessment of §103 argument quality. strong = multi-piece combination with measurable emergent property + benchmark evidence; moderate = combination present but emergent property fuzzy; weak = mostly an aggregation of known pieces.',
    ),
});
export type PatentableEdge = z.infer<typeof patentableEdgeSchema>;

const edgesArraySchema = z.object({
  edges: z.array(patentableEdgeSchema),
});

export type EdgeDistillationConfig = {
  apiKey: string;
  model?: string;
};

const SYSTEM_PROMPT = `You are a patent claim-drafting analyst. Given a list of technical pillars (each with its closest known prior art) and optional A/B benchmark data, your job is to produce per-pillar "patentable edge" entries.

For each pillar:
1. For each named related-art item, summarize what it ACTUALLY teaches in 1-2 sentences. Use Google Search to ground this — papers update, products evolve. Do not hallucinate.
2. Identify the SPECIFIC combination in the feature that goes beyond what any single piece teaches. Name what's added and to what existing piece.
3. Frame the §103 non-obviousness argument: name the EMERGENT PROPERTY that arises ONLY from the combination — a measurable property (a latency tier, a refusal guarantee, a settlement primitive) that no single component produces alone. This is the patent-strength anchor.
4. Sketch high-level claim language counsel can adapt (NOT actual claim text — patent-style "A method comprising: ... wherein ..." with the combination + emergent property).
5. Self-assess argument strength: strong / moderate / weak.

Output ONLY valid JSON matching the schema. Be precise. Do not editorialize. Cite real prior art only.`;

export async function distillEdges(
  featureSummary: string,
  reframe: ReframeResult,
  cfg: EdgeDistillationConfig,
  opts: { benchmarkDeltas?: string } = {},
): Promise<PatentableEdge[]> {
  if (!reframe.trueTechnicalPillars.length) return [];

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: cfg.apiKey });
  const model = cfg.model ?? 'gemini-2.5-pro';
  const supportsCombined = /gemini-3/.test(model);

  const pillarsBlock = reframe.trueTechnicalPillars
    .map(
      (p, i) =>
        `${i + 1}. Pillar: ${p.pillar}\n   Domain: ${p.domainContext}\n   Related known art: ${p.relatedKnownArt.join(', ') || '(none)'}`,
    )
    .join('\n\n');

  const benchmarkBlock = opts.benchmarkDeltas
    ? `\n\nA/B benchmark data the user supplied (treat as evidence for emergent-property claims):\n${opts.benchmarkDeltas}`
    : '';

  const content = `${SYSTEM_PROMPT}

Feature summary:
${featureSummary}

Pillars to distill (produce one PatentableEdge per pillar):
${pillarsBlock}${benchmarkBlock}

Output a single JSON object with an "edges" array, one entry per pillar above, in the same order.`;

  if (supportsCombined) {
    const resp = await ai.models.generateContent({
      model,
      contents: content,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: zodToGeminiSchema(edgesArraySchema),
        thinkingConfig: { thinkingBudget: -1 },
      },
    } as any);
    const text = extractText(resp);
    return edgesArraySchema.parse(JSON.parse(text)).edges;
  }

  // 2-call path for 2.5-pro: grounded prose → structured coercion
  const groundedResp = await ai.models.generateContent({
    model,
    contents: `${content}\n\nWrite the per-pillar analysis as plain prose first. Use Google Search to verify what each named piece of prior art teaches.`,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: -1 },
    },
  } as any);
  const grounded = extractText(groundedResp);

  const coerceResp = await ai.models.generateContent({
    model,
    contents: `Convert this per-pillar patent edge analysis into a JSON object matching this exact shape:

{
  "edges": [
    {
      "pillar": str,
      "priorArtSummaries": [ {"art": str, "teaching": str}, ... ],
      "combinationEdge": str,
      "emergentProperty": str,
      "suggestedClaimLanguage": str,
      "benchmarkDelta": str | null,
      "strength": "strong"|"moderate"|"weak"
    }, ...
  ]
}

One edge entry per pillar, same order as the source analysis. Output ONLY the JSON object, no prose or markdown fencing. Preserve named prior art verbatim. Do not invent content not present in the source.

--- SOURCE ANALYSIS ---
${grounded}`,
    config: {
      responseMimeType: 'application/json',
    },
  } as any);
  const coerced = extractText(coerceResp);
  const cleaned = stripJsonFence(coerced);
  return edgesArraySchema.parse(JSON.parse(cleaned)).edges;
}

function stripJsonFence(s: string): string {
  const t = s.trim();
  if (t.startsWith('```')) {
    return t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  return t;
}

function extractText(resp: any): string {
  const cand = resp?.candidates?.[0] ?? resp?.response?.candidates?.[0];
  const parts = cand?.content?.parts ?? [];
  return parts
    .map((p: any) => p?.text ?? '')
    .filter(Boolean)
    .join('');
}

// Minimal zod→Gemini schema walker (subset of OpenAPI 3 Gemini accepts)
function zodToGeminiSchema(schema: z.ZodTypeAny): any {
  return walk(schema);
}

function walk(s: z.ZodTypeAny): any {
  const def: any = (s as any)._def;
  if (def?.typeName === 'ZodObject') {
    const shape = def.shape();
    const properties: Record<string, any> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries<z.ZodTypeAny>(shape)) {
      properties[k] = walk(v);
      const inner = (v as any)._def;
      const isOptional =
        inner?.typeName === 'ZodOptional' ||
        inner?.typeName === 'ZodDefault' ||
        inner?.typeName === 'ZodNullable';
      if (!isOptional) required.push(k);
    }
    const out: any = { type: 'object', properties };
    if (required.length) out.required = required;
    if (def.description) out.description = def.description;
    return out;
  }
  if (def?.typeName === 'ZodArray') {
    return {
      type: 'array',
      items: walk(def.type),
      ...(def.description ? { description: def.description } : {}),
    };
  }
  if (def?.typeName === 'ZodString') {
    return {
      type: 'string',
      ...(def.description ? { description: def.description } : {}),
    };
  }
  if (def?.typeName === 'ZodNumber') return { type: 'number' };
  if (def?.typeName === 'ZodBoolean') return { type: 'boolean' };
  if (def?.typeName === 'ZodEnum') return { type: 'string', enum: def.values };
  if (
    def?.typeName === 'ZodOptional' ||
    def?.typeName === 'ZodNullable' ||
    def?.typeName === 'ZodDefault'
  ) {
    return walk(def.innerType);
  }
  return { type: 'string' };
}
