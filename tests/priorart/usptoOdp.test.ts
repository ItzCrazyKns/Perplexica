import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { UsptoOdpSource } from '@/lib/agents/priorart/sources/usptoOdp';
import { queryPlanSchema } from '@/lib/agents/priorart/schemas';
import fixture from './fixtures/odp_search_response.json';

const BASE = 'https://api.uspto.gov';

const newSource = (cfg: Partial<ConstructorParameters<typeof UsptoOdpSource>[0]> = {}) =>
  new UsptoOdpSource({
    apiKey: 'test-key',
    baseUrl: BASE,
    legacyBaseUrl: 'https://developer.uspto.gov',
    oaUseLegacyHost: true,
    requestTimeoutMs: 5000,
    ...cfg,
  });

const examplePlan = queryPlanSchema.parse({
  odpQueries: [{ field: 'any', query: 'merkle commitment' }],
  bigqueryFragments: [{ whereClause: '1=1', params: [] }],
  semanticQueries: ['merkle commitment'],
  cpcClasses: [],
  priorityDate: '2026-01-01',
});

describe('UsptoOdpSource', () => {
  const requestLog: { url: string; headers: Headers }[] = [];

  const server = setupServer(
    http.post(`${BASE}/api/v1/patent/applications/search`, ({ request }) => {
      requestLog.push({ url: request.url, headers: request.headers });
      const key = request.headers.get('x-api-key');
      if (key !== 'test-key') return new HttpResponse(null, { status: 401 });
      return HttpResponse.json(fixture);
    }),
    http.get(
      `${BASE}/api/v1/patent/applications/:applicationNumberText/meta-data`,
      () => HttpResponse.json(fixture.patentBag[0]),
    ),
  );

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    requestLog.length = 0;
  });
  afterAll(() => server.close());

  it('sends x-api-key header on every request', async () => {
    server.use(
      http.post(`${BASE}/api/v1/patent/applications/search`, ({ request }) => {
        expect(request.headers.get('x-api-key')).toBe('test-key');
        return HttpResponse.json(fixture);
      }),
    );
    const src = newSource();
    await src.search(examplePlan, 10);
  });

  it('parses search results into PatentDocument shape', async () => {
    const src = newSource();
    const docs = await src.search(examplePlan, 10);
    expect(docs.length).toBeGreaterThan(0);
    expect(docs[0].source).toBe('uspto_odp');
    expect(docs[0].title).toMatch(/streaming|hybrid/i);
    expect(docs[0].publicationDate).toBe('2020-11-19');
  });

  it('retries on 429 and eventually returns body', async () => {
    let attempts = 0;
    server.use(
      http.post(`${BASE}/api/v1/patent/applications/search`, () => {
        attempts++;
        if (attempts < 2) return new HttpResponse(null, { status: 429 });
        return HttpResponse.json(fixture);
      }),
    );
    const src = newSource();
    const docs = await src.search(examplePlan, 5);
    expect(attempts).toBe(2);
    expect(docs.length).toBeGreaterThan(0);
  });

  it('aborts immediately on non-retryable 4xx', async () => {
    server.use(
      http.post(`${BASE}/api/v1/patent/applications/search`, () =>
        new HttpResponse(null, { status: 400 }),
      ),
    );
    const src = newSource();
    await expect(src.search(examplePlan, 5)).rejects.toThrow(/USPTO ODP 400/);
  });

  it('never includes the API key in thrown error messages', async () => {
    server.use(
      http.post(`${BASE}/api/v1/patent/applications/search`, () =>
        new HttpResponse(null, { status: 500 }),
      ),
    );
    const src = newSource();
    let captured: Error | null = null;
    try {
      await src.search(examplePlan, 5);
    } catch (e) {
      captured = e as Error;
    }
    expect(captured).not.toBeNull();
    expect(captured!.message).not.toContain('test-key');
  });

  it('returns null on 404 fetch', async () => {
    server.use(
      http.get(
        `${BASE}/api/v1/patent/applications/:applicationNumberText/meta-data`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    const src = newSource();
    const doc = await src.fetch('99999999');
    expect(doc).toBeNull();
  });
});
