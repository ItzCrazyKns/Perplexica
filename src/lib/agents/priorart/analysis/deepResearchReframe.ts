import z from 'zod';

export const reframeResultSchema = z.object({
  trueTechnicalPillars: z
    .array(
      z.object({
        pillar: z.string().describe('Short label for the actual technical contribution.'),
        domainContext: z
          .string()
          .describe(
            'One-line context naming the correct technical domain. Must explicitly mention any unrelated domains the term might be confused with.',
          ),
        relatedKnownArt: z
          .array(z.string())
          .describe('Named existing systems/papers/products that teach related art (e.g. "Firecracker", "RouteLLM", "arXiv:2605.03375").'),
      }),
    )
    .min(1),
  nonPatentPriorArt: z
    .array(
      z.object({
        type: z.enum(['arxiv', 'github', 'standard', 'product', 'blog', 'paper']),
        title: z.string(),
        url: z.string().describe('Canonical URL; verifier checks it resolves.'),
        relevance: z.string().describe('One-line description of what this teaches.'),
      }),
    )
    .describe(
      'Non-patent prior art surfaced by grounded web search. Counsel reviews separately from §102 patent art.',
    ),
  refinedUsptoQueries: z
    .array(z.string())
    .min(3)
    .describe(
      'Patent-search keyword phrases (no quotes, no Boolean operators). Grounded in the actual technical domain after disambiguation. 6-10 entries.',
    ),
  refinedCpcClasses: z
    .array(z.string())
    .describe('CPC prefix candidates (e.g. "G06N20", "H04L9/00"). Narrower than the generic software whitelist.'),
  noiseDomainsToAvoid: z
    .array(z.string())
    .describe(
      'Named technical domains the feature\'s keywords accidentally collide with (e.g. "electrical substations", "lithium batteries"). The downstream semantic filter uses this as a hard negative list.',
    ),
  ambiguousTerms: z
    .array(
      z.object({
        term: z.string(),
        intendedMeaning: z.string(),
        collisions: z.array(z.string()),
      }),
    )
    .describe(
      'Multi-meaning terms in the feature description, with intended interpretation and the unrelated domains they collide with.',
    ),
});
export type ReframeResult = z.infer<typeof reframeResultSchema>;

export type ReframeConfig = {
  apiKey: string;
  model?: string;
};

const SYSTEM_PROMPT = `You are a patent prior-art research analyst. You receive a software-feature description and your job is to REFRAME it for downstream patent search:

1. Use Google Search to find the TRUE technical domain of the feature. The feature description may use terms that have multiple meanings across unrelated domains (e.g. "switchyard" = inference exchange OR electrical substation OR JBoss SOA framework). Disambiguate.

2. Search for what's actually been published in the disambiguated domain:
   - arxiv preprints
   - GitHub repos
   - product documentation
   - technical standards
   - existing patents you can find via Google Patents

3. From this grounded view, decide:
   - True technical pillars (4-7 of them) — each a discrete contribution, not marketing language
   - Refined patent-search keywords (6-10 phrases) — plain whitespace-separated keywords, NOT Boolean and NOT quoted; tested by you against what would actually surface relevant patents
   - Refined CPC class prefixes — narrower than generic software whitelist; based on what the disambiguated domain actually uses
   - Noise domains to explicitly exclude — name the unrelated domains the keywords would otherwise pull (be specific, e.g. "electrical substations", not just "irrelevant")
   - Ambiguous terms and their disambiguation

4. Surface non-patent prior art that's relevant — arxiv papers, github repos, products, standards. Counsel reviews these separately from §102 patent search.

You output ONLY valid JSON matching the supplied schema. Do not editorialize. Be concrete and citation-grounded.`;

export async function deepResearchReframe(
  featureDescription: string,
  cfg: ReframeConfig,
): Promise<ReframeResult> {
  // Import lazily so unit tests can mock without requiring the SDK.
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: cfg.apiKey });
  const model = cfg.model ?? 'gemini-2.5-pro';

  // Note: Gemini structured-output + googleSearch tool simultaneously requires
  // Gemini 3 family. For 2.5-pro we run grounded search first, then a second
  // pass to coerce into the schema. Single-call path used when model supports it.
  const supportsCombined = /gemini-3/.test(model);

  if (supportsCombined) {
    const resp = await ai.models.generateContent({
      model,
      contents: `${SYSTEM_PROMPT}\n\nFeature description:\n${featureDescription}`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: zodToGeminiSchema(reframeResultSchema),
        thinkingConfig: { thinkingBudget: -1 },
      },
    } as any);
    const text = extractText(resp);
    return reframeResultSchema.parse(JSON.parse(text));
  }

  // 2-call path for 2.5-pro: grounded search → unstructured analysis,
  // then a second structured-output coercion call.
  const groundedResp = await ai.models.generateContent({
    model,
    contents: `${SYSTEM_PROMPT}\n\nFeature description:\n${featureDescription}\n\nProduce your reframe analysis as plain prose with explicit "Pillar:", "Refined queries:", "Noise domains:", "Non-patent prior art:" sections. Cite URLs.`,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: -1 },
    },
  } as any);
  const grounded = extractText(groundedResp);

  // Coerce step: just JSON mime type, no schema. Gemini's strict-schema mode
  // sometimes returns a top-level JSON string (not an object) when the schema
  // is complex; this looser path lets the LLM emit the object and zod cleans up.
  const coerceResp = await ai.models.generateContent({
    model,
    contents: `Convert this prior-art reframe analysis into a JSON object matching this exact shape:

{
  "trueTechnicalPillars": [ {"pillar": str, "domainContext": str, "relatedKnownArt": [str, ...]}, ... ],
  "nonPatentPriorArt": [ {"type": "arxiv"|"github"|"standard"|"product"|"blog"|"paper", "title": str, "url": str, "relevance": str}, ... ],
  "refinedUsptoQueries": [str, ...],              // 6-10 plain keyword phrases
  "refinedCpcClasses": [str, ...],                // CPC prefixes like "G06N20"
  "noiseDomainsToAvoid": [str, ...],              // named off-domain areas to filter
  "ambiguousTerms": [ {"term": str, "intendedMeaning": str, "collisions": [str, ...]}, ... ]
}

Output ONLY the JSON object, no prose or markdown fencing. Preserve all URLs verbatim from the source. Do not invent content.

--- SOURCE ANALYSIS ---
${grounded}`,
    config: {
      responseMimeType: 'application/json',
    },
  } as any);
  const coerced = extractText(coerceResp);
  const cleaned = stripJsonFence(coerced);
  return reframeResultSchema.parse(JSON.parse(cleaned));
}

function stripJsonFence(s: string): string {
  // Some models wrap output in ```json ... ``` despite responseMimeType.
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

/**
 * Convert a zod schema to the OpenAPI-3-flavored JSON Schema Gemini expects.
 * Gemini's responseSchema is a strict subset (no $ref, no anyOf, simplified
 * enums). For our ReframeResult shape this is enough.
 */
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
      const isOptional = inner?.typeName === 'ZodOptional' || inner?.typeName === 'ZodDefault';
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
  if (def?.typeName === 'ZodNumber') {
    return { type: 'number' };
  }
  if (def?.typeName === 'ZodBoolean') {
    return { type: 'boolean' };
  }
  if (def?.typeName === 'ZodEnum') {
    return { type: 'string', enum: def.values };
  }
  if (def?.typeName === 'ZodOptional' || def?.typeName === 'ZodNullable' || def?.typeName === 'ZodDefault') {
    return walk(def.innerType);
  }
  return { type: 'string' };
}
