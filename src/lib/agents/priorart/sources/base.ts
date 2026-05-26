import { PatentDocument, QueryPlan } from '../schemas';

export interface PriorArtSource {
  readonly name: 'uspto_odp' | 'bigquery_patents';
  search(plan: QueryPlan, limit: number): Promise<PatentDocument[]>;
  fetch(identifier: string): Promise<PatentDocument | null>;
}

export interface SourceSearchResult {
  source: PriorArtSource['name'];
  documents: PatentDocument[];
}
