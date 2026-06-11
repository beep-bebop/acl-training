import { state } from '../core/state.js';
import { saveToStorage, addAfterSaveListener } from '../core/storage.js';
import { getCurrentSnapshot } from './plans.js';
import {
  loadGitHubBackupToken,
  normalizeGitHubBackupConfig,
  pushGitHubBackup,
  validateGitHubBackupInputs,
} from './github-backup.js';

const DEFAULT_DEBOUNCE_MS = 2000;

function noop() {}

export function createAutoBackupController(options) {
  const timers = options.timers || globalThis;
  const debounceMs = Number.isFinite(Number(options.debounceMs))
    ? Number(options.debounceMs)
    : DEFAULT_DEBOUNCE_MS;
  const getSnapshot = options.getSnapshot;
  const getConfig = options.getConfig;
  const getToken = options.getToken;
  const pushBackup = options.pushBackup;
  const onStatus = options.onStatus || noop;
  const onSuccess = options.onSuccess || noop;
  let timer = null;
  let inFlight = false;
  let rerunAfterCurrent = false;

  function getReadyContext() {
    const config = normalizeGitHubBackupConfig(getConfig());
    const token = getToken();
    const validation = validateGitHubBackupInputs(config, token);
    if (!validation.ok) return null;
    return { config, token };
  }

  async function runNow() {
    const context = getReadyContext();
    if (!context) return;
    if (inFlight) {
      rerunAfterCurrent = true;
      return;
    }
    inFlight = true;
    onStatus({ state: 'running', message: '正在自动备份到 GitHub...' });
    try {
      const result = await pushBackup(getSnapshot(), context.config, context.token);
      if (result?.ok) {
        onSuccess(result);
        onStatus({ state: 'success', message: '已自动备份到 GitHub', result });
      } else {
        onStatus({ state: 'error', message: result?.msg || '自动备份失败', result });
      }
    } catch (err) {
      onStatus({ state: 'error', message: err?.message || '自动备份失败', error: err });
    } finally {
      inFlight = false;
      if (rerunAfterCurrent) {
        rerunAfterCurrent = false;
        await runNow();
      }
    }
  }

  function schedule() {
    if (!getReadyContext()) return;
    if (inFlight) {
      rerunAfterCurrent = true;
      return;
    }
    if (timer) timers.clearTimeout(timer);
    timer = timers.setTimeout(async () => {
      timer = null;
      await runNow();
    }, debounceMs);
  }

  return { schedule, runNow };
}

function formatAutoBackupStatus(status) {
  if (!status?.message) return '';
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  return `${status.message}（${time}）`;
}

export function initAutoGitHubBackup(onStatus = noop) {
  const controller = createAutoBackupController({
    getSnapshot: () => getCurrentSnapshot(),
    getConfig: () => state.settings?.githubBackup || {},
    getToken: () => loadGitHubBackupToken(),
    pushBackup: pushGitHubBackup,
    onStatus,
    onSuccess: (result) => {
      if (!state.settings) state.settings = {};
      state.settings.githubBackup = {
        ...(state.settings.githubBackup || {}),
        ...(result.config || {}),
        lastBackupAt: result.exportedAt || new Date().toISOString(),
        lastCommitSha: result.commitSha || state.settings.githubBackup?.lastCommitSha || '',
        lastAutoBackupStatus: formatAutoBackupStatus({ message: '已自动备份到 GitHub' }),
      };
      saveToStorage({ skipBackup: true });
    },
  });
  addAfterSaveListener(() => controller.schedule());
  return controller;
}
