import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBackupPayload,
  normalizeGitHubBackupConfig,
  textToBase64,
  base64ToText,
} from '../services/github-backup.js';

test('normalizeGitHubBackupConfig trims and applies safe defaults', () => {
  assert.deepEqual(normalizeGitHubBackupConfig({
    owner: ' beep-bebop ',
    repo: ' acl-training-data ',
    branch: '',
    path: '',
  }), {
    owner: 'beep-bebop',
    repo: 'acl-training-data',
    branch: 'main',
    path: 'acl-training-backup.json',
  });
});

test('backup payload contains app snapshot and metadata without token', () => {
  const payload = buildBackupPayload({
    version: 8,
    catalog: { planGroups: [] },
    runtime: { sessionLogs: [{ date: '2026-06-11' }] },
    settings: { githubBackup: { token: 'secret', owner: 'x' } },
  });

  assert.equal(payload.app, 'acl-training');
  assert.equal(payload.snapshot.version, 8);
  assert.equal(payload.snapshot.runtime.sessionLogs.length, 1);
  assert.equal(payload.snapshot.settings.githubBackup.token, undefined);
  assert.match(payload.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('base64 helpers preserve unicode json text', () => {
  const source = JSON.stringify({ name: '推A', note: '膝盖稳定' });
  const encoded = textToBase64(source);
  assert.equal(base64ToText(encoded), source);
});
