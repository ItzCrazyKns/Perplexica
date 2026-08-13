import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import z from 'zod';
import { ActionRegistry } from './index';
import type { ActionOutput, ResearchAction } from '../../types';

const additionalConfig = {
  llm: {} as any,
  embedding: {} as any,
  session: {} as any,
  researchBlockId: 'r1',
  fileIds: [],
  mode: 'balanced' as const,
  notionDb: {} as any,
  notionPages: [],
};

let active = 0;
let maxActive = 0;

function makeAction(
  name: string,
  stagesWrite = false,
  delayMs = 10,
): ResearchAction<any> {
  return {
    name,
    schema: z.object({}),
    getToolDescription: () => '',
    getDescription: () => '',
    enabled: () => true,
    ...(stagesWrite ? { stagesWrite: true } : {}),
    execute: async (): Promise<ActionOutput> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      active -= 1;
      return {
        type: 'search_results',
        results: [
          { content: name, metadata: { title: name, url: '' } },
        ],
      };
    },
  };
}

describe('ActionRegistry.executeAll', () => {
  const registered: string[] = [];

  function register(action: ResearchAction<any>) {
    ActionRegistry.register(action);
    registered.push(action.name);
  }

  afterAll(() => {
    // The registry is a static singleton; remove only the fakes this
    // file added so other tests never see them.
    const map = (ActionRegistry as unknown as {
      actions: Map<string, unknown>;
    }).actions;
    registered.forEach((name) => map.delete(name));
  });

  beforeEach(() => {
    active = 0;
    maxActive = 0;
  });

  it('runs independent actions concurrently', async () => {
    register(makeAction('registry-test-ind-a'));
    register(makeAction('registry-test-ind-b'));
    register(makeAction('registry-test-ind-c'));

    const results = await ActionRegistry.executeAll(
      [
        { id: '1', name: 'registry-test-ind-a', arguments: {} },
        { id: '2', name: 'registry-test-ind-b', arguments: {} },
        { id: '3', name: 'registry-test-ind-c', arguments: {} },
      ],
      additionalConfig,
    );

    // Overlapping execution means they were not serialized.
    expect(maxActive).toBeGreaterThan(1);
    expect(results).toHaveLength(3);
  });

  it('serializes staged writes in tool-call order', async () => {
    register(makeAction('registry-test-write-a', true, 5));
    register(makeAction('registry-test-write-b', true, 5));
    register(makeAction('registry-test-write-c', true, 5));

    await ActionRegistry.executeAll(
      [
        { id: '1', name: 'registry-test-write-a', arguments: {} },
        { id: '2', name: 'registry-test-write-b', arguments: {} },
        { id: '3', name: 'registry-test-write-c', arguments: {} },
      ],
      additionalConfig,
    );

    // Sequential execution: never more than one staged write in flight,
    // so the batch order is the model's tool-call order.
    expect(maxActive).toBe(1);
  });

  it('pairs results with tool calls by index even when independent actions complete out of order', async () => {
    // Different delays force completion order to differ from call order.
    register(makeAction('registry-test-fast', false, 5));
    register(makeAction('registry-test-slow', false, 30));
    register(makeAction('registry-test-mid', false, 15));

    const results = await ActionRegistry.executeAll(
      [
        { id: '1', name: 'registry-test-fast', arguments: {} },
        { id: '2', name: 'registry-test-slow', arguments: {} },
        { id: '3', name: 'registry-test-mid', arguments: {} },
      ],
      additionalConfig,
    );

    expect(
      results.map((r) => r.type === 'search_results' && r.results[0]?.content),
    ).toEqual([
      'registry-test-fast',
      'registry-test-slow',
      'registry-test-mid',
    ]);
  });

  it('mixes staged writes and independent actions while keeping index pairing', async () => {
    register(makeAction('registry-test-mix-ind', false, 20));
    register(makeAction('registry-test-mix-write', true, 5));

    const results = await ActionRegistry.executeAll(
      [
        { id: '1', name: 'registry-test-mix-ind', arguments: {} },
        { id: '2', name: 'registry-test-mix-write', arguments: {} },
        { id: '3', name: 'registry-test-mix-ind', arguments: {} },
      ],
      additionalConfig,
    );

    expect(
      results.map((r) => r.type === 'search_results' && r.results[0]?.content),
    ).toEqual([
      'registry-test-mix-ind',
      'registry-test-mix-write',
      'registry-test-mix-ind',
    ]);
  });
});
