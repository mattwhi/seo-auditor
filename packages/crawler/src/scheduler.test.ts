import assert from 'node:assert/strict';
import test from 'node:test';

import { CrawlScheduler } from './scheduler.js';

const sleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

test('rejects invalid scheduler options', () => {
  assert.throws(() => new CrawlScheduler({ concurrency: 0, minDelayMs: 0 }), /concurrency/);
  assert.throws(() => new CrawlScheduler({ concurrency: 1, minDelayMs: -1 }), /minDelayMs/);
});

test('limits concurrently running tasks', async () => {
  const scheduler = new CrawlScheduler({ concurrency: 2, minDelayMs: 0 });
  let active = 0;
  let peakActive = 0;

  const task = async (): Promise<void> => {
    active += 1;
    peakActive = Math.max(peakActive, active);
    await sleep(25);
    active -= 1;
  };

  await Promise.all([
    scheduler.run(task),
    scheduler.run(task),
    scheduler.run(task),
    scheduler.run(task),
  ]);

  assert.equal(peakActive, 2);
});

test('spaces request starts by the configured minimum delay', async () => {
  const scheduler = new CrawlScheduler({ concurrency: 3, minDelayMs: 30 });
  const starts: number[] = [];

  await Promise.all(
    Array.from({ length: 3 }, () =>
      scheduler.run(async () => {
        starts.push(Date.now());
      }),
    ),
  );

  assert.equal(starts.length, 3);
  assert.ok(starts[1]! - starts[0]! >= 20);
  assert.ok(starts[2]! - starts[1]! >= 20);
});
