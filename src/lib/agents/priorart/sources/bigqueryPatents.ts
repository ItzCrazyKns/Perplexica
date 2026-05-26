import { BigQuery, BigQueryOptions } from '@google-cloud/bigquery';
import { PatentDocument, QueryPlan } from '../schemas';
import { PriorArtSource } from './base';

export type BigQueryPatentsConfig = {
  projectId: string;
  credentialsPath?: string;
  dataset: string;
  bytesBilledCap: number;
  cpcWhitelist?: string[]; // hard floor; doc must match at least one prefix
};

type ParamValue = string | number | boolean | string[] | number[];

type Param = {
  name: string;
  type: 'STRING' | 'INT64' | 'FLOAT64' | 'BOOL' | 'DATE';
  value: ParamValue;
  array?: boolean | null;
};

export class BigQueryPatentsSource implements PriorArtSource {
  readonly name = 'bigquery_patents' as const;
  private client: BigQuery;

  constructor(private config: BigQueryPatentsConfig) {
    if (!config.projectId) throw new Error('GCP project id is required');
    const opts: BigQueryOptions = { projectId: config.projectId };
    if (config.credentialsPath) opts.keyFilename = config.credentialsPath;
    this.client = new BigQuery(opts);
  }

  async search(plan: QueryPlan, limit: number): Promise<PatentDocument[]> {
    const priorityDateInt = isoToInt(plan.priorityDate);
    const dataset = this.config.dataset;
    const lowerBoundInt = priorityDateLowerBoundInt(plan.priorityDate, 10);
    const params: Param[] = [
      { name: 'priorityDateInt', type: 'INT64', value: priorityDateInt },
      { name: 'lowerBoundInt', type: 'INT64', value: lowerBoundInt },
    ];
    const orFragments: string[] = [];
    const seenParamNames = new Set<string>(params.map((p) => p.name));
    plan.bigqueryFragments.forEach((frag) => {
      if (!frag.whereClause.trim()) return;
      orFragments.push(`(${frag.whereClause})`);
      frag.params.forEach((p) => {
        if (seenParamNames.has(p.name)) return; // ignore duplicate names across fragments
        seenParamNames.add(p.name);
        params.push({
          name: p.name,
          type: p.type,
          value: p.value as ParamValue,
          array: p.array,
        });
      });
    });
    const cpcClause = plan.cpcClasses.length
      ? `EXISTS (SELECT 1 FROM UNNEST(cpc) c WHERE ${plan.cpcClasses
          .map((_, i) => `STARTS_WITH(c.code, @cpc${i})`)
          .join(' OR ')})`
      : '';
    plan.cpcClasses.forEach((code, i) =>
      params.push({ name: `cpc${i}`, type: 'STRING', value: code }),
    );

    // Hard scope filter: doc must match at least one whitelist CPC prefix.
    // Default scopes to software + semiconductor + data-center subclasses so
    // unrelated patents (medical, mechanical, etc.) never reach the fuser.
    const whitelist = this.config.cpcWhitelist ?? [];
    const whitelistClause = whitelist.length
      ? `EXISTS (SELECT 1 FROM UNNEST(cpc) c WHERE ${whitelist
          .map((_, i) => `STARTS_WITH(c.code, @cpcW${i})`)
          .join(' OR ')})`
      : '';
    whitelist.forEach((code, i) =>
      params.push({ name: `cpcW${i}`, type: 'STRING', value: code }),
    );

    const where = [
      `publication_date < @priorityDateInt`,
      `publication_date >= @lowerBoundInt`,
      orFragments.length ? `(${orFragments.join(' OR ')})` : '',
      cpcClause,
      whitelistClause,
    ]
      .filter((s) => s.length > 0)
      .join(' AND ');

    // Lightweight projection: title + abstract + dates + assignees + cpc.
    // Drop claims_localized + inventors + ipc + citation array — these inflate
    // scanned bytes ~10x. Use .fetch(pubNumber) for full record on demand.
    const sql = `
      SELECT
        publication_number,
        application_number,
        ARRAY(
          SELECT t.text FROM UNNEST(title_localized) t WHERE t.language = 'en' LIMIT 1
        ) AS title,
        ARRAY(
          SELECT a.text FROM UNNEST(abstract_localized) a WHERE a.language = 'en' LIMIT 1
        ) AS abstract,
        filing_date,
        publication_date,
        priority_date,
        ARRAY(SELECT name FROM UNNEST(assignee_harmonized)) AS assignees,
        ARRAY(SELECT code FROM UNNEST(cpc)) AS cpc_codes
      FROM \`${dataset}\`
      WHERE ${where}
      LIMIT @rowLimit
    `;
    params.push({ name: 'rowLimit', type: 'INT64', value: limit });

    await this.assertWithinCap(sql, params);
    const result = (await this.client.query({
      query: sql,
      maximumBytesBilled: String(this.config.bytesBilledCap),
      params: this.toQueryParams(params),
      types: this.toQueryTypes(params),
    } as any)) as [any[]];
    const rows = result[0];
    return rows.map((r: any) => this.normalize(r));
  }

  async fetch(identifier: string): Promise<PatentDocument | null> {
    const dataset = this.config.dataset;
    const sql = `
      SELECT
        publication_number,
        application_number,
        ARRAY(SELECT t.text FROM UNNEST(title_localized) t WHERE t.language = 'en' LIMIT 1) AS title,
        ARRAY(SELECT a.text FROM UNNEST(abstract_localized) a WHERE a.language = 'en' LIMIT 1) AS abstract,
        ARRAY(SELECT cl.text FROM UNNEST(claims_localized) cl WHERE cl.language = 'en' LIMIT 1) AS claims,
        filing_date, publication_date, priority_date,
        ARRAY(SELECT name FROM UNNEST(assignee_harmonized)) AS assignees,
        ARRAY(SELECT name FROM UNNEST(inventor_harmonized)) AS inventors,
        ARRAY(SELECT code FROM UNNEST(cpc)) AS cpc_codes,
        ARRAY(SELECT code FROM UNNEST(ipc)) AS ipc_codes,
        ARRAY_LENGTH(citation) AS citation_count
      FROM \`${dataset}\`
      WHERE publication_number = @id OR application_number = @id
      LIMIT 1
    `;
    const params: Param[] = [{ name: 'id', type: 'STRING', value: identifier }];
    await this.assertWithinCap(sql, params);
    const result = (await this.client.query({
      query: sql,
      maximumBytesBilled: String(this.config.bytesBilledCap),
      params: this.toQueryParams(params),
      types: this.toQueryTypes(params),
    } as any)) as [any[]];
    const rows = result[0];
    if (!rows.length) return null;
    return this.normalize(rows[0]);
  }

  private async assertWithinCap(sql: string, params: Param[]) {
    const result = (await this.client.createQueryJob({
      query: sql,
      dryRun: true,
      params: this.toQueryParams(params),
      types: this.toQueryTypes(params),
    } as any)) as unknown as [any];
    const job = result[0];
    const meta: any = job.metadata?.statistics;
    const bytesProcessed = Number(meta?.totalBytesProcessed ?? meta?.query?.totalBytesProcessed ?? 0);
    if (bytesProcessed > this.config.bytesBilledCap) {
      throw new Error(
        `BigQuery dry-run estimate ${bytesProcessed} bytes exceeds cap ${this.config.bytesBilledCap}; refusing query.`,
      );
    }
  }

  private toQueryParams(params: Param[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const p of params) out[p.name] = p.value;
    return out;
  }

  private toQueryTypes(params: Param[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const p of params) {
      out[p.name] = p.array ? [p.type] : p.type;
    }
    return out;
  }

  private normalize(row: any): PatentDocument {
    return {
      publicationNumber: String(row.publication_number ?? ''),
      applicationNumber: row.application_number ?? undefined,
      title: row.title?.[0] ?? '',
      abstract: row.abstract?.[0] ?? undefined,
      firstIndependentClaim: row.claims?.[0] ?? undefined,
      filingDate: intToIso(row.filing_date),
      publicationDate: intToIso(row.publication_date),
      priorityDate: intToIso(row.priority_date),
      assignees: row.assignees ?? [],
      inventors: row.inventors ?? [],
      cpcCodes: row.cpc_codes ?? [],
      ipcCodes: row.ipc_codes ?? [],
      citationCount: row.citation_count ?? undefined,
      source: 'bigquery_patents',
    };
  }
}

function isoToInt(iso: string): number {
  return Number(iso.replace(/-/g, ''));
}

function priorityDateLowerBoundInt(priorityIso: string, yearsBack: number): number {
  const [y, m, d] = priorityIso.split('-').map(Number);
  return Number(`${(y - yearsBack).toString().padStart(4, '0')}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`);
}

function intToIso(n: number | string | undefined): string | undefined {
  if (n === undefined || n === null) return undefined;
  const s = String(n);
  if (s.length !== 8) return undefined;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
