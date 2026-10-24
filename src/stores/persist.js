// 持久化接线：stores → 快照 → localStorage（防抖）→ 自动备份调度。
import { SCHEMA_VERSION } from '../core/schema.js';
import { saveSnapshot } from '../services/persistence.js';
import { createAutoBackupController } from '../services/auto-backup.js';
import { loadBackupToken, pushBackup } from '../services/github-backup.js';
import { useCatalogStore } from './catalog.js';
import { useProgramStore } from './program.js';
import { useLogsStore } from './logs.js';
import { useSettingsStore } from './settings.js';

let saveTimer = null;
let autoBackup = null;
let suppressBackupOnce = false;

export function buildSnapshot() {
  const catalog = useCatalogStore();
  const program = useProgramStore();
  const logs = useLogsStore();
  const settings = useSettingsStore();
  return {
    version: SCHEMA_VERSION,
    catalog: { planGroups: catalog.planGroups },
    program: {
      cycleStart: program.cycleStart,
      weekdayPlan: program.weekdayPlan,
      deloadEveryN: program.deloadEveryN,
      deloadWeeks: program.deloadWeeks,
      activeStage: program.activeStage
    },
    logs: {
      calendarLogs: logs.calendarLogs,
      sessionLogs: logs.sessionLogs,
      setLogs: logs.setLogs,
      readinessLogs: logs.readinessLogs
    },
    settings: JSON.parse(JSON.stringify(settings.$state))
  };
}

export function initPersistence() {
  const settings = useSettingsStore();

  autoBackup = createAutoBackupController({
    getSnapshot: buildSnapshot,
    getConfig: () => settings.backup,
    getToken: () => loadBackupToken(),
    pushBackup,
    onStatus: (status) => {
      if (status.state === 'error' || status.state === 'running') {
        settings.patchBackup({ lastStatus: status.message });
      }
    },
    onSuccess: (result) => {
      // 更新状态时直接落盘一次，跳过下一次备份调度，避免“备份→保存→再备份”循环
      suppressBackupOnce = true;
      settings.patchBackup({ lastBackupAt: result.exportedAt, lastStatus: `已备份 ${new Date(result.exportedAt).toLocaleString('zh-CN')}` });
      saveSnapshot(buildSnapshot());
    }
  });

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveSnapshot(buildSnapshot());
      if (suppressBackupOnce) {
        suppressBackupOnce = false;
        return;
      }
      if (settings.backup.auto) autoBackup.schedule();
    }, 300);
  };

  for (const store of [useCatalogStore(), useProgramStore(), useLogsStore(), useSettingsStore()]) {
    store.$subscribe(scheduleSave, { detached: true });
  }
}

export function triggerBackupNow() {
  if (!autoBackup) return false;
  autoBackup.runNow();
  return true;
}
