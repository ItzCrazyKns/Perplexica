import test from 'node:test';
import assert from 'node:assert/strict';
import SessionManager from './session.ts';
import { TextBlock } from './types.ts';

const textBlock = (id: string, data: string): TextBlock => ({
  id,
  type: 'text',
  data,
});

test('appendText mutates the stored block and emits a delta', () => {
  const session = new SessionManager();
  const events: any[] = [];

  session.subscribe((event, data) => events.push({ event, data }));

  session.emitBlock(textBlock('b1', 'Hel'));
  session.appendText('b1', 'lo');

  assert.equal((session.getBlock('b1') as TextBlock).data, 'Hello');
  assert.deepEqual(events[1], {
    event: 'data',
    data: { type: 'appendText', blockId: 'b1', delta: 'lo' },
  });
});

test('late subscriber gets one snapshot per block, not the patch history', () => {
  const session = new SessionManager();

  session.emitBlock(textBlock('b1', ''));
  for (const piece of ['a', 'b', 'c']) session.appendText('b1', piece);

  const events: any[] = [];
  session.subscribe((event, data) => events.push({ event, data }));

  assert.equal(events.length, 1);
  assert.equal(events[0].data.type, 'block');
  assert.equal(events[0].data.block.data, 'abc');
});

test('replays researchComplete and terminal end to late subscribers', () => {
  const session = new SessionManager();

  session.emitBlock(textBlock('b1', 'answer'));
  session.emit('data', { type: 'researchComplete' });
  session.emit('end', {});

  const events: any[] = [];
  session.subscribe((event, data) => events.push({ event, data }));

  assert.deepEqual(
    events.map((e) => e.event),
    ['data', 'data', 'end'],
  );
  assert.equal(events[1].data.type, 'researchComplete');
});

test('first terminal event wins', () => {
  const session = new SessionManager();

  session.emit('end', {});
  session.emit('error', { data: 'late failure' });

  const events: any[] = [];
  session.subscribe((event) => events.push(event));

  assert.deepEqual(events, ['end']);
});

test('live subscriber does not receive replayed duplicates', () => {
  const session = new SessionManager();
  const events: any[] = [];

  session.subscribe((event, data) => events.push({ event, data }));

  session.emitBlock(textBlock('b1', 'x'));
  session.appendText('b1', 'y');
  session.emit('end', {});

  assert.equal(events.length, 3);
});

test('appendText on an unknown or empty delta is a no-op', () => {
  const session = new SessionManager();
  const events: any[] = [];

  session.subscribe((event, data) => events.push({ event, data }));

  session.appendText('missing', 'x');
  session.emitBlock(textBlock('b1', 'x'));
  session.appendText('b1', '');

  assert.equal(events.length, 1);
});
