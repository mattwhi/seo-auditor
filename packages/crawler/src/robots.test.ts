import assert from 'node:assert/strict';
import test from 'node:test';

import { isAllowedByRobots, parseRobotsTxt } from './robots.js';

const robotsUrl = 'https://example.com/robots.txt';
const bot = 'OpenSEOAuditorBot/0.2';

test('allows URLs when there are no matching rules', () => {
  assert.equal(
    isAllowedByRobots('https://example.com/products', parseRobotsTxt('', robotsUrl), bot),
    true,
  );
});

test('honours wildcard disallow rules', () => {
  const policy = parseRobotsTxt('User-agent: *\nDisallow: /admin/\n', robotsUrl);
  assert.equal(isAllowedByRobots('https://example.com/admin/users', policy, bot), false);
  assert.equal(isAllowedByRobots('https://example.com/products', policy, bot), true);
});

test('uses specific user-agent rules instead of wildcard rules', () => {
  const policy = parseRobotsTxt(
    'User-agent: *\nDisallow: /private/\n\nUser-agent: OpenSEOAuditorBot\nAllow: /private/\n',
    robotsUrl,
  );
  assert.equal(isAllowedByRobots('https://example.com/private/report', policy, bot), true);
});

test('uses the longest matching rule', () => {
  const policy = parseRobotsTxt(
    'User-agent: *\nDisallow: /shop/\nAllow: /shop/public/\n',
    robotsUrl,
  );
  assert.equal(
    isAllowedByRobots('https://example.com/shop/private/item', policy, 'ExampleBot'),
    false,
  );
  assert.equal(
    isAllowedByRobots('https://example.com/shop/public/item', policy, 'ExampleBot'),
    true,
  );
});

test('allow wins when matching rules have equal specificity', () => {
  const policy = parseRobotsTxt(
    'User-agent: *\nDisallow: /products\nAllow: /products\n',
    robotsUrl,
  );
  assert.equal(isAllowedByRobots('https://example.com/products', policy, 'ExampleBot'), true);
});

test('supports wildcard patterns', () => {
  const policy = parseRobotsTxt('User-agent: *\nDisallow: /*?preview=\n', robotsUrl);
  assert.equal(
    isAllowedByRobots('https://example.com/product?preview=true', policy, 'ExampleBot'),
    false,
  );
});

test('supports end-of-path anchors', () => {
  const policy = parseRobotsTxt('User-agent: *\nDisallow: /*.pdf$\n', robotsUrl);
  assert.equal(
    isAllowedByRobots('https://example.com/files/report.pdf', policy, 'ExampleBot'),
    false,
  );
  assert.equal(
    isAllowedByRobots('https://example.com/files/report.pdf?download=1', policy, 'ExampleBot'),
    true,
  );
});

test('ignores comments', () => {
  const policy = parseRobotsTxt(
    '# Global rules\nUser-agent: *\nDisallow: /private/ # private content\n',
    robotsUrl,
  );
  assert.equal(
    isAllowedByRobots('https://example.com/private/test', policy, 'ExampleBot'),
    false,
  );
});

test('combines consecutive user-agent declarations into one group', () => {
  const policy = parseRobotsTxt(
    'User-agent: OpenSEOAuditorBot\nUser-agent: AnotherBot\nDisallow: /blocked/\n',
    robotsUrl,
  );
  assert.equal(isAllowedByRobots('https://example.com/blocked/page', policy, bot), false);
});
