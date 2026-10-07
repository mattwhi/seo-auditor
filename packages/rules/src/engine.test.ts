import assert from 'node:assert/strict';
import test from 'node:test';

import type { PageFacts, SeoRule } from '@seo-auditor/types';

import { RuleEngine, RuleRegistry } from './engine.js';

const page: PageFacts = {
  url: 'https://example.test/',
  finalUrl: 'https://example.test/',
  statusCode: 200,
  contentType: 'text/html',
  responseTimeMs: 1,
  title: 'Example',
  metaDescription: 'Example page',
  canonical: 'https://example.test/',
  robots: [],
  h1: ['Example'],
  h2: [],
  wordCount: 300,
  images: [],
  links: [],
  schemaTypes: [],
};

const makeRule = (id: string): SeoRule => ({
  id,
  name: id,
  description: id,
  severity: 'low',
  category: 'content',
  evaluate() {
    return [];
  },
});

test('registry preserves deterministic rule order', () => {
  const registry = new RuleRegistry([makeRule('test.first'), makeRule('test.second')]);
  assert.deepEqual(registry.list().map((rule) => rule.id), ['test.first', 'test.second']);
});

test('registry resolves a rule by stable ID', () => {
  const rule = makeRule('test.lookup');
  const registry = new RuleRegistry([rule]);
  assert.equal(registry.get('test.lookup'), rule);
  assert.equal(registry.get('test.missing'), undefined);
});

test('registry rejects duplicate rule IDs', () => {
  assert.throws(
    () => new RuleRegistry([makeRule('test.duplicate'), makeRule('test.duplicate')]),
    /Duplicate SEO rule ID/,
  );
});

test('registry rejects non-namespaced rule IDs', () => {
  assert.throws(() => new RuleRegistry([makeRule('invalid')]), /Invalid SEO rule ID/);
});

test('engine evaluates rules in registry order', () => {
  const first: SeoRule = {
    ...makeRule('test.first'),
    evaluate() {
      return [{ ruleId: this.id, severity: this.severity, category: this.category, message: 'first' }];
    },
  };
  const second: SeoRule = {
    ...makeRule('test.second'),
    evaluate() {
      return [{ ruleId: this.id, severity: this.severity, category: this.category, message: 'second' }];
    },
  };

  const findings = new RuleEngine(new RuleRegistry([first, second])).evaluatePage(page);
  assert.deepEqual(findings.map((finding) => finding.message), ['first', 'second']);
});

test('engine rejects findings whose rule ID does not match the executing rule', () => {
  const badRule: SeoRule = {
    ...makeRule('test.bad-id'),
    evaluate() {
      return [{ ruleId: 'test.other', severity: this.severity, category: this.category, message: 'bad' }];
    },
  };

  assert.throws(
    () => new RuleEngine(new RuleRegistry([badRule])).evaluatePage(page),
    /returned finding for/,
  );
});

test('engine rejects findings whose severity does not match rule metadata', () => {
  const badRule: SeoRule = {
    ...makeRule('test.bad-severity'),
    evaluate() {
      return [{ ruleId: this.id, severity: 'high', category: this.category, message: 'bad' }];
    },
  };

  assert.throws(
    () => new RuleEngine(new RuleRegistry([badRule])).evaluatePage(page),
    /mismatched severity/,
  );
});

test('engine rejects findings whose category does not match rule metadata', () => {
  const badRule: SeoRule = {
    ...makeRule('test.bad-category'),
    evaluate() {
      return [{ ruleId: this.id, severity: this.severity, category: 'metadata', message: 'bad' }];
    },
  };

  assert.throws(
    () => new RuleEngine(new RuleRegistry([badRule])).evaluatePage(page),
    /mismatched category/,
  );
});
