// 自动备份控制器：保存后防抖推送 GitHub（依赖注入，便于单测）。
import { normalizeBackupConfig, validateBackupInputs } from './github-backup.js';

const DEFAULT_DEBOUNCE_MS = 2000;

function noop() {}

export function createAutoBackupController(options) {
  const timers = options.timers || globalThis;
  const debounceMs = Number.isFinite(Number(options.debounceMs)) ? Number(options.debounceMs) : DEFAULT_DEBOUNCE_MS;
  const { getSnapshot, getConfig, getToken, pushBackup } = options;
  const onStatus = options.onStatus || noop;
  const onSuccess = options.onSuccess || noop;
  let timer = null;
  let inFlight = false;
  let rerunAfterCurrent = false;

  function readyContext() {
    const config = normalizeBackupConfig(getConfig());
    const token = getToken();
    const validation = validateBackupInputs(config, token);
    if (!validation.ok) return null;
    return { config, token };
  }

  async function runNow() {
    const context = readyContext();
    if (!context) return;
    if (inFlight) {
      rerunAfterCurrent = true;
      return;
    }
    inFlight = true;
    onStatus({ state: 'running', message: '正在自动备份…' });
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
    if (!readyContext()) return;
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
