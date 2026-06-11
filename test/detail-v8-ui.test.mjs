import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('detail page renders v8 coaching and prescription fields', () => {
  const source = readFileSync(new URL('../pages/detail.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(source, /detail-coaching-panel/);
  assert.match(source, /prescription\.targetRpe/);
  assert.match(source, /prescription\.painCeiling/);
  assert.match(source, /prescription\.trackingMetric/);
  assert.match(css, /\.detail-coaching-panel/);
  assert.match(css, /\.detail-prescription-line/);
});
