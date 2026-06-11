import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('settings UI and app events do not expose remote sync controls', () => {
  const files = [
    '../index.html',
    '../app.js',
    '../pages/settings.js',
  ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

  assert.doesNotMatch(files, /远程同步/);
  assert.doesNotMatch(files, /远程计划地址/);
  assert.doesNotMatch(files, /data-preview-remote-sync/);
  assert.doesNotMatch(files, /data-apply-remote-sync/);
  assert.doesNotMatch(files, /previewRemoteSync/);
  assert.doesNotMatch(files, /applyRemoteSync/);
});
