import BaseLLM from '@/lib/models/base/llm';
import {
  FeatureProfile,
  Landscape,
  landscapeSchema,
  PatentDocument,
  RankedDocument,
} from '../schemas';
import { loadPrompt, renderPrompt } from '../prompts';

export async function synthesizeLandscape(
  llm: BaseLLM<unknown>,
  profile: FeatureProfile,
  documents: (PatentDocument | RankedDocument)[],
): Promise<Landscape> {
  const system = loadPrompt('system');
  const compactDocs = documents.map((d) => ({
    publicationNumber: d.publicationNumber,
    title: d.title,
    assignees: d.assignees,
    inventors: d.inventors,
    cpcCodes: d.cpcCodes,
    filingDate: d.filingDate,
    publicationDate: d.publicationDate,
    citationCount: d.citationCount,
  }));
  const user = renderPrompt('landscapeSynthesis', {
    documents_json: JSON.stringify(compactDocs, null, 2),
    component_technologies_json: JSON.stringify(profile.componentTechnologies, null, 2),
  });
  const landscape = await llm.generateObject<typeof landscapeSchema>({
    schema: landscapeSchema,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    options: { temperature: 0.2, maxTokens: 8192 },
  });
  return landscapeSchema.parse(landscape);
}
