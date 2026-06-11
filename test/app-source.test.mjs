import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('app imports showToast before using it for theme feedback', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /import\s+\{\s*showToast\s*\}\s+from\s+'\.\/utils\/helpers\.js';/);
  assert.match(source, /showToast\(messages\[newTheme\]/);
});
