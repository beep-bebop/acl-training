import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('detail page does not expose module emoji editing controls', () => {
  const source = readFileSync(new URL('../pages/detail.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /data-module-edit-emoji/);
  assert.doesNotMatch(source, /data-module-emoji/);
});
