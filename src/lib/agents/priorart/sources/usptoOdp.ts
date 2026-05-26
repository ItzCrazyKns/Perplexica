import axios, { AxiosInstance, AxiosError } from 'axios';
import pRetry, { AbortError } from 'p-retry';
import { PatentDocument, PatentDocument as Doc, QueryPlan } from '../schemas';
import { PriorArtSource } from './base';

export type UsptoOdpConfig = {
  apiKey: string;
  baseUrl: string;
  legacyBaseUrl: string;
  oaUseLegacyHost: boolean;
  requestTimeoutMs: number;
  uspcWhitelist?: string[]; // e.g. ['706','709','711','257','365'] — drops out-of-scope hits
};

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export class UsptoOdpSource implements PriorArtSource {
  readonly name = 'uspto_odp' as const;
  private http: AxiosInstance;

  constructor(private config: UsptoOdpConfig) {
    if (!config.apiKey) throw new Error('USPTO ODP API key is required');
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.requestTimeoutMs,
      headers: { 'x-api-key': config.apiKey, accept: 'application/json' },
    });
  }

  async search(plan: QueryPlan, limit: number): Promise<PatentDocument[]> {
    const queries = plan.odpQueries.slice(0, 8);
    const perQueryLimit = Math.max(5, Math.floor(limit / Math.max(queries.length, 1)));
    const responses = await Promise.all(
      queries.map((q) =>
        this.request('POST', '/api/v1/patent/applications/search', {
          q: q.query,
          pagination: { offset: 0, limit: perQueryLimit },
        }),
      ),
    );
    const seen = new Set<string>();
    const out: PatentDocument[] = [];
    const whitelist = this.config.uspcWhitelist ?? [];
    let dropped = 0;
    for (const resp of responses) {
      const items: any[] =
        resp?.patentFileWrapperDataBag ??
        resp?.patentBag ??
        resp?.results ??
        resp?.applications ??
        [];
      for (const item of items) {
        const appNum = item.applicationNumberText ?? item.applicationNumber;
        if (!appNum || seen.has(appNum)) continue;
        seen.add(appNum);
        // USPC scope filter: ODP search has no CPC predicate, so we post-filter
        // by US classification (the `class` field in applicationMetaData) to scope
        // to software / semiconductor / data-center subclasses.
        if (whitelist.length) {
          const uspcClass = item.applicationMetaData?.class ?? item.class;
          if (!uspcClass || !whitelist.includes(String(uspcClass))) {
            dropped++;
            continue;
          }
        }
        out.push(this.normalize(item));
        if (out.length >= limit) {
          if (dropped > 0) console.log(`[uspto_odp] dropped ${dropped} out-of-scope by USPC`);
          return out;
        }
      }
    }
    if (dropped > 0) console.log(`[uspto_odp] dropped ${dropped} out-of-scope by USPC`);
    return out;
  }

  async fetch(identifier: string): Promise<PatentDocument | null> {
    const encoded = encodeURIComponent(identifier);
    try {
      const meta = await this.request(
        'GET',
        `/api/v1/patent/applications/${encoded}/meta-data`,
      );
      return this.normalize(meta);
    } catch (err) {
      if (this.is404(err)) return null;
      throw err;
    }
  }

  async fetchOfficeActions(applicationNumber: string): Promise<unknown[]> {
    const useLegacy = this.config.oaUseLegacyHost;
    const base = useLegacy ? this.config.legacyBaseUrl : this.config.baseUrl;
    const path = useLegacy
      ? `/ds-api/oa-actions/v1/applications/${encodeURIComponent(applicationNumber)}`
      : `/api/v1/patent/applications/${encodeURIComponent(applicationNumber)}/office-actions`;
    const resp = await this.requestAbsolute('GET', base + path, undefined, useLegacy);
    return (resp?.results ?? resp?.officeActions ?? []) as unknown[];
  }

  async ptabDecisionsSearch(query: string, limit = 20): Promise<unknown[]> {
    const resp = await this.request('POST', '/api/v1/ptab/decisions/search', {
      q: query,
      pagination: { offset: 0, limit },
    });
    return (resp?.results ?? resp?.decisions ?? []) as unknown[];
  }

  async assignmentsSearch(query: string, limit = 20): Promise<unknown[]> {
    const resp = await this.request('POST', '/api/v1/patent/assignments/search', {
      q: query,
      pagination: { offset: 0, limit },
    });
    return (resp?.results ?? resp?.assignments ?? []) as unknown[];
  }

  private normalize(item: any): Doc {
    const meta = item.applicationMetaData ?? {};
    const pubNumber =
      item.publicationNumber ??
      meta.earliestPublicationNumber ??
      item.patentNumber ??
      item.publicationNumberText ??
      item.applicationNumberText ??
      item.applicationNumber ??
      '';
    return {
      publicationNumber: String(pubNumber),
      applicationNumber: item.applicationNumberText ?? item.applicationNumber,
      title: meta.inventionTitle ?? item.inventionTitle ?? item.title ?? '',
      abstract: meta.abstractText ?? item.abstractText ?? item.abstract,
      firstIndependentClaim: meta.firstClaimText ?? item.firstClaimText ?? undefined,
      filingDate: meta.filingDate ?? item.filingDate,
      publicationDate:
        meta.earliestPublicationDate ??
        item.publicationDate ??
        item.earliestPublicationDate,
      priorityDate:
        meta.effectiveFilingDate ??
        item.priorityDate ??
        item.earliestFilingDate ??
        meta.filingDate,
      assignees: this.collect(
        meta.applicantBag ?? item.applicantBag ?? item.assigneeBag ?? item.assignees,
        ['applicantNameText', 'name', 'nameLineOneText'],
      ),
      inventors: this.collect(
        meta.inventorBag ?? item.inventorBag ?? item.inventors,
        ['inventorNameText', 'name'],
      ),
      cpcCodes: this.collect(
        meta.cpcClassificationBag ?? item.cpcClassificationBag ?? item.cpcClassifications,
        ['symbol', 'cpcSymbol'],
      ),
      ipcCodes: this.collect(
        meta.ipcClassificationBag ?? item.ipcClassificationBag ?? item.ipcClassifications,
        ['symbol', 'ipcSymbol'],
      ),
      source: 'uspto_odp',
      raw: undefined,
    };
  }

  private collect(arr: any, keys: string | string[]): string[] {
    if (!arr || !Array.isArray(arr)) return [];
    const keyList = Array.isArray(keys) ? keys : [keys];
    return arr
      .map((x) => {
        if (typeof x === 'string') return x;
        for (const k of keyList) {
          const v = x?.[k];
          if (typeof v === 'string' && v.length > 0) return v;
        }
        return '';
      })
      .filter((s) => typeof s === 'string' && s.length > 0);
  }

  private async request(method: 'GET' | 'POST', path: string, body?: unknown) {
    return this.requestAbsolute(method, this.config.baseUrl + path, body, false);
  }

  private async requestAbsolute(
    method: 'GET' | 'POST',
    url: string,
    body: unknown,
    stripAuth: boolean,
  ) {
    return pRetry(
      async () => {
        try {
          const resp = await this.http.request({
            method,
            url,
            data: body,
            headers: stripAuth ? { 'x-api-key': undefined } : undefined,
          });
          return resp.data;
        } catch (e) {
          const err = e as AxiosError;
          const status = err.response?.status;
          if (status && !RETRYABLE_STATUSES.has(status)) {
            throw new AbortError(this.scrub(err));
          }
          throw new Error(this.scrub(err));
        }
      },
      { retries: 3, factor: 2, minTimeout: 500, maxTimeout: 4000 },
    );
  }

  private is404(err: unknown): boolean {
    if ((err as AxiosError)?.response?.status === 404) return true;
    const msg = (err as Error)?.message ?? '';
    return msg.includes('USPTO ODP 404');
  }

  private scrub(err: AxiosError): string {
    const status = err.response?.status ?? 'no-status';
    const path = err.config?.url ?? 'no-url';
    return `USPTO ODP ${status} on ${path}`;
  }
}
