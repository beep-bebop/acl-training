import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoBackupController } from '../services/auto-backup.js';

function createFakeTimers() {
  const timers = [];
  return {
    timers,
    setTimeout(fn, delay) {
      const timer = { fn, delay, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      if (timer) timer.cleared = true;
    },
  };
}

test('auto backup schedules a debounced GitHub backup when config and token exist', async () => {
  const fakeTimers = createFakeTimers();
  const calls = [];
  const statuses = [];
  const controller = createAutoBackupController({
    debounceMs: 123,
    timers: fakeTimers,
    getSnapshot: () => ({ version: 7, marker: 'latest' }),
    getConfig: () => ({ owner: 'beep-bebop', repo: 'acl-training-data', branch: 'main', path: 'backup.json' }),
    getToken: () => 'token',
    pushBackup: async (snapshot, config, token) => {
      calls.push({ snapshot, config, token });
      return { ok: true, exportedAt: '2026-06-11T00:00:00.000Z', commitSha: 'abc123' };
    },
    onStatus: status => statuses.push(status),
  });

  controller.schedule();

  assert.equal(fakeTimers.timers.length, 1);
  assert.equal(fakeTimers.timers[0].delay, 123);
  await fakeTimers.timers[0].fn();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].snapshot.marker, 'latest');
  assert.equal(calls[0].token, 'token');
  assert.equal(statuses.at(-1).state, 'success');
});

test('auto backup skips scheduling until repository config and token are ready', () => {
  const fakeTimers = createFakeTimers();
  const controller = createAutoBackupController({
    timers: fakeTimers,
    getSnapshot: () => ({ version: 7 }),
    getConfig: () => ({ owner: '', repo: '' }),
    getToken: () => '',
    pushBackup: async () => ({ ok: true }),
  });

  controller.schedule();

  assert.equal(fakeTimers.timers.length, 0);
});

test('auto backup runs the latest snapshot again when changes happen during upload', async () => {
  const fakeTimers = createFakeTimers();
  let marker = 1;
  let finishFirst;
  const calls = [];
  const controller = createAutoBackupController({
    debounceMs: 1,
    timers: fakeTimers,
    getSnapshot: () => ({ version: 7, marker }),
    getConfig: () => ({ owner: 'beep-bebop', repo: 'acl-training-data' }),
    getToken: () => 'token',
    pushBackup: async (snapshot) => {
      calls.push(snapshot.marker);
      if (calls.length === 1) {
        await new Promise(resolve => { finishFirst = resolve; });
      }
      return { ok: true, exportedAt: `2026-06-11T00:00:0${calls.length}.000Z` };
    },
  });

  controller.schedule();
  const firstRun = fakeTimers.timers[0].fn();
  marker = 2;
  controller.schedule();
  finishFirst();
  await firstRun;

  assert.deepEqual(calls, [1, 2]);
});
