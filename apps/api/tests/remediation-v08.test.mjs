import test from 'node:test';
import assert from 'node:assert/strict';
import { seoFieldForRule } from '../dist/wordpress.js';

test('only title and description rule families map to Rank Math fields', () => {
  assert.equal(seoFieldForRule('description.missing'), 'rank_math_description');
  assert.equal(seoFieldForRule('title.too-long'), 'rank_math_title');
  assert.equal(seoFieldForRule('metadata.title-duplicate'), null);
  assert.equal(seoFieldForRule('heading.h1-empty'), null);
});
