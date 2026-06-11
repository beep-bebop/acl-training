import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('settings page exposes private GitHub backup controls without Gist recommendation', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

  assert.match(html, /GitHub 数据仓库备份/);
  assert.match(html, /data-github-backup-now/);
  assert.match(html, /data-github-restore/);
  assert.match(html, /私有 GitHub 仓库/);
  assert.match(app, /backupToGitHub/);
  assert.match(app, /restoreFromGitHub/);
  assert.doesNotMatch(html, /Gist（推荐）|推荐 Gist|gist 保存隐私训练记录/);
});
