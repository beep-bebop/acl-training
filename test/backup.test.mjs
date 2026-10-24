// GitHub 备份：纯函数 + 自动备份控制器（假时钟）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBackupConfig,
  buildBackupPayload,
  textToBase64,
  base64ToText,
  validateBackupInputs,
  loadBackupToken,
  saveBackupToken
} from '../src/services/github-backup.js';
import { createAutoBackupController } from '../src/services/auto-backup.js';

test('textToBase64 / base64ToText 往返（含中文）', () => {
  const text = 'ACL 训练备份 {"version":9}';
  assert.equal(base64ToText(textToBase64(text)), text);
});

test('buildBackupPayload 脱敏 AI Key', () => {
  const payload = buildBackupPayload({ version: 9, settings: { ai: { apiKey: 'sk-secret', model: 'm' } } });
  assert.equal(payload.app, 'acl-training');
  assert.equal(payload.snapshot.settings.ai.apiKey, '');
  assert.equal(payload.snapshot.settings.ai.model, 'm');
});

test('normalizeBackupConfig 填默认值', () => {
  const cfg = normalizeBackupConfig({ owner: 'u', repo: 'r' });
  assert.equal(cfg.branch, 'main');
  assert.equal(cfg.path, 'acl-training-backup.json');
});

test('validateBackupInputs 校验完整性', () => {
  assert.equal(validateBackupInputs({ owner: 'u', repo: 'r' }, '').ok, false);
  assert.equal(validateBackupInputs({ owner: 'u' }, 't').ok, false);
  assert.equal(validateBackupInputs({ owner: 'u', repo: 'r' }, 't').ok, true);
});

test('token 存取与旧键兼容读取', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k)
  };
  try {
    // 旧键存在时优先读旧键（迁移场景）
    store.set('acl_training_github_backup_token', 'old-token');
    assert.equal(loadBackupToken(), 'old-token');
    saveBackupToken('new-token');
    assert.equal(loadBackupToken(), 'new-token');
    assert.equal(store.has('acl-training.github-token'), true);
    saveBackupToken('');
    assert.equal(loadBackupToken(), '');
  } finally {
    delete globalThis.localStorage;
  }
});

test('自动备份控制器：未配置跳过 / 防抖合并 / 失败后可重试', async () => {
  const slots = [];
  let now = 0;
  const timers = {
    setTimeout: (fn, ms) => {
      const id = { fn, at: now + ms };
      slots.push(id);
      return id;
    },
    clearTimeout: (id) => {
      const idx = slots.indexOf(id);
      if (idx >= 0) slots.splice(idx, 1);
    }
  };
  const settle = () => new Promise((r) => setImmediate(r));
  const flush = async () => {
    while (slots.length) {
      slots.sort((a, b) => a.at - b.at);
      const next = slots.shift();
      now = Math.max(now, next.at);
      next.fn();
      await settle(); // 等待 async runNow 完成
    }
    await settle();
  };

  const calls = [];
  let configured = false;
  let failNext = false;
  let statusSeen = null;
  const controller = createAutoBackupController({
    timers,
    debounceMs: 100,
    getSnapshot: () => ({ version: 9 }),
    getConfig: () => (configured ? { owner: 'u', repo: 'r' } : {}),
    getToken: () => (configured ? 'tok' : ''),
    pushBackup: async () => {
      calls.push(now);
      if (failNext) {
        failNext = false;
        return { ok: false, msg: 'boom' };
      }
      return { ok: true, exportedAt: '2026-10-24T00:00:00Z' };
    },
    onStatus: (s) => (statusSeen = s.state),
    onSuccess: () => {}
  });

  // 未配置：不产生任何调度
  controller.schedule();
  assert.equal(slots.length, 0);

  // 连续两次保存 → 防抖合并为一次上传，且按最后一次保存计时
  configured = true;
  controller.schedule();
  now = 50;
  controller.schedule();
  assert.equal(slots.length, 1);
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0], 150);
  assert.equal(statusSeen, 'success');

  // 上传失败 → 状态 error；再次 schedule 可重试成功
  failNext = true;
  now = 300;
  controller.schedule();
  await flush();
  assert.equal(calls.length, 2);
  assert.equal(statusSeen, 'error');

  now = 500;
  controller.schedule();
  await flush();
  assert.equal(calls.length, 3);
  assert.equal(statusSeen, 'success');
});
