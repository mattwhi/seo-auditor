import assert from 'node:assert/strict';
import test from 'node:test';
import type { RuleFinding } from '@seo-auditor/types';
import { score } from './index.js';
const finding = (severity: RuleFinding['severity']): RuleFinding => ({ ruleId: 'metadata.title-duplicate', severity, category: 'metadata', message: 'Duplicate' });
test('informational variants never dilute actionable penalties', () => {
  assert.equal(score([finding('medium')], 10), score([finding('info'), finding('medium')], 10));
  assert.equal(score([finding('info')], 10), 100);
});
test('severity and prevalence affect score predictably', () => {
  assert.equal(score([finding('medium')], 10), 99);
  assert.equal(score(Array.from({length: 10}, () => finding('medium')), 10), 93);
  assert.equal(score([], 0), 100);
});
