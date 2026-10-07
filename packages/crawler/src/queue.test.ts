import assert from 'node:assert/strict';
import test from 'node:test';

import { CrawlQueue } from './queue.js';

test('dequeues URLs in FIFO order with their crawl depth', () => {
  const queue = new CrawlQueue({ maxDepth: 3, maxSize: 10 });

  assert.equal(queue.enqueue('https://example.com/', 0), true);
  assert.equal(queue.enqueue('https://example.com/a', 1), true);
  assert.deepEqual(queue.dequeue(), { url: 'https://example.com/', depth: 0 });
  assert.deepEqual(queue.dequeue(), { url: 'https://example.com/a', depth: 1 });
});

test('rejects URLs deeper than the configured maximum', () => {
  const queue = new CrawlQueue({ maxDepth: 2, maxSize: 10 });

  assert.equal(queue.enqueue('https://example.com/deep', 3), false);
  assert.equal(queue.size, 0);
});

test('deduplicates queued and already-seen URLs', () => {
  const queue = new CrawlQueue({ maxDepth: 3, maxSize: 10 });
  const url = 'https://example.com/page';

  assert.equal(queue.enqueue(url, 1), true);
  assert.equal(queue.enqueue(url, 1), false);
  assert.deepEqual(queue.dequeue(), { url, depth: 1 });
  assert.equal(queue.enqueue(url, 1), false);
});

test('enforces the maximum pending queue size', () => {
  const queue = new CrawlQueue({ maxDepth: 3, maxSize: 2 });

  assert.equal(queue.enqueue('https://example.com/1', 0), true);
  assert.equal(queue.enqueue('https://example.com/2', 0), true);
  assert.equal(queue.enqueue('https://example.com/3', 0), false);
  assert.equal(queue.size, 2);
});

test('tracks the number of unique dequeued URLs', () => {
  const queue = new CrawlQueue({ maxDepth: 3, maxSize: 10 });

  queue.enqueue('https://example.com/1', 0);
  queue.enqueue('https://example.com/2', 1);
  queue.dequeue();
  queue.dequeue();

  assert.equal(queue.seenCount, 2);
});
