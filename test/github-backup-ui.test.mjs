import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('settings page hides backup infrastructure controls from users', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

  assert.doesNotMatch(html, /GitHub 数据仓库备份/);
  assert.doesNotMatch(html, /Owner/);
  assert.doesNotMatch(html, /Fine-grained Token/);
  assert.doesNotMatch(html, /私有 GitHub 仓库|Gist|数据仓库|备份到 GitHub|从 GitHub 恢复|清空本机 Token/);
  assert.doesNotMatch(html, /githubBackupOwnerInput|githubBackupRepoInput|githubBackupTokenInput/);
  assert.doesNotMatch(html, /data-save-github-backup|data-github-backup-now|data-github-restore|data-clear-github-token/);
  assert.doesNotMatch(app, /data-save-github-backup|data-github-backup-now|data-github-restore|data-clear-github-token/);
});
