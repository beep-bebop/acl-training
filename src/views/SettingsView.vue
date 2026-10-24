<script setup>
import { computed, ref } from 'vue';
import ToggleSwitch from '../components/ui/ToggleSwitch.vue';
import SegmentedControl from '../components/ui/SegmentedControl.vue';
import ImportSheet from '../components/ui/ImportSheet.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import { useSettingsStore } from '../stores/settings.js';
import { useCatalogStore } from '../stores/catalog.js';
import { useUiStore } from '../stores/ui.js';
import { useLogsStore } from '../stores/logs.js';
import { useProgramStore } from '../stores/program.js';
import { buildSnapshot, triggerBackupNow } from '../stores/persist.js';
import { ensurePermission, permissionState } from '../services/notifications.js';
import { loadBackupToken, saveBackupToken, pullBackup } from '../services/github-backup.js';
import { normalizeCatalog } from '../core/schema.js';
import { migrateSnapshot } from '../core/migration.js';
import { fetchSeedCatalog } from '../services/persistence.js';
import { downloadJson, copyText } from '../utils/export.js';
import { SCHEMA_VERSION } from '../core/schema.js';

const settings = useSettingsStore();
const catalog = useCatalogStore();
const logs = useLogsStore();
const program = useProgramStore();
const ui = useUiStore();

const THEME_OPTIONS = [
  { value: 'dark', label: '深色' },
  { value: 'light', label: '浅色' },
  { value: 'system', label: '跟随系统' }
];
function setTheme(v) {
  settings.patch({ theme: v });
  settings.applyTheme();
}

// ---------- 提醒 ----------
const permission = computed(() => permissionState());
const permissionText = computed(
  () => ({ granted: '已开启', denied: '被拒绝（去系统设置开启）', default: '未开启', unsupported: '设备不支持' }[permission.value] || '未知')
);
async function requestPermission() {
  const result = await ensurePermission();
  if (result === 'denied') ui.toast('通知权限被拒绝，请在浏览器设置中开启');
  else ui.toast('通知已开启', 'success');
}

// ---------- 备份 ----------
const backupForm = ref({ ...settings.backup });
const token = ref(loadBackupToken());
const backupBusy = ref(false);

async function saveBackupConfig() {
  settings.patchBackup(backupForm.value);
  saveBackupToken(token.value.trim());
  backupBusy.value = true;
  const ok = triggerBackupNow();
  if (!ok) {
    ui.toast('已保存配置；填写 Token 后将自动备份');
  }
  setTimeout(() => (backupBusy.value = false), 600);
}
async function restoreBackup() {
  const ok = await ui.confirmAsync({
    title: '从 GitHub 恢复数据？',
    body: '本地数据将被远端备份覆盖。',
    confirmText: '恢复',
    danger: true
  });
  if (!ok) return;
  backupBusy.value = true;
  try {
    const result = await pullBackup(backupForm.value, token.value.trim());
    if (!result.ok) throw new Error(result.msg);
    const snapshot = migrateSnapshot(result.snapshot);
    if (!snapshot) throw new Error('备份内容无法识别');
    catalog.hydrate(snapshot.catalog);
    program.hydrate(snapshot.program);
    logs.hydrate(snapshot.logs);
    settings.hydrate(snapshot.settings);
    ui.toast('已从备份恢复', 'success');
  } catch (e) {
    ui.toast(`恢复失败：${e.message}`, 'error');
  } finally {
    backupBusy.value = false;
  }
}

// ---------- 数据管理 ----------
const importOpen = ref(false);

async function exportSnapshot() {
  const snapshot = buildSnapshot();
  const payload = { app: 'acl-training', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), snapshot };
  downloadJson(`acl-training-backup-${snapshot.logs.sessionLogs.length}次-${Date.now()}.json`.replace(/[:*?"<>|]/g, '-'), payload);
  ui.toast('已下载备份文件', 'success');
}
async function copySnapshot() {
  const ok = await copyText(JSON.stringify(buildSnapshot()));
  ui.toast(ok ? '快照已复制到剪贴板' : '复制失败，请改用下载', ok ? 'success' : 'error');
}
async function resetCatalog() {
  const ok = await ui.confirmAsync({
    title: '恢复默认动作库？',
    body: '所有计划与动作会被默认 ACL 康复库覆盖；训练记录与周期设置保留。',
    confirmText: '恢复',
    danger: true
  });
  if (!ok) return;
  try {
    const seed = await fetchSeedCatalog();
    catalog.hydrate(normalizeCatalog(seed));
    ui.toast('已恢复默认动作库', 'success');
  } catch (e) {
    ui.toast(`恢复失败：${e.message}`, 'error');
  }
}
async function wipeLogs() {
  const ok = await ui.confirmAsync({
    title: '清空全部训练记录？',
    body: '会话、组记录、日历与晨检记录都会删除，无法恢复。',
    confirmText: '清空',
    danger: true
  });
  if (!ok) return;
  logs.clearTrainingHistory();
  ui.toast('训练记录已清空');
}
</script>

<template>
  <div class="app-page">
    <h1 class="t-display" style="margin-bottom: 14px">我的</h1>

    <!-- 外观 -->
    <div class="card card-pad sec">
      <div class="sec-head"><h3>外观</h3></div>
      <SegmentedControl :model-value="settings.theme" :options="THEME_OPTIONS" @update:model-value="setTheme" />
    </div>

    <!-- 提醒 -->
    <div class="card card-pad sec">
      <div class="sec-head"><h3>提醒</h3></div>

      <div class="setting-row">
        <div class="sr-text">
          <span class="sr-title">通知权限</span>
          <span class="t-mini">{{ permissionText }}</span>
        </div>
        <button v-if="permission === 'default'" class="btn btn-sm btn-primary" @click="requestPermission">开启</button>
      </div>

      <div class="setting-row">
        <div class="sr-text">
          <span class="sr-title">每日训练提醒</span>
          <span class="t-mini">应用保持打开或 PWA 后台时送达</span>
        </div>
        <input
          v-model="settings.dailyReminder.time"
          type="time"
          class="time-input num"
          :disabled="!settings.dailyReminder.enabled"
          @change="settings.patchDailyReminder({})"
        />
        <ToggleSwitch :model-value="settings.dailyReminder.enabled" @update:model-value="settings.patchDailyReminder({ enabled: $event })" />
      </div>

      <div class="setting-row">
        <div class="sr-text">
          <span class="sr-title">休息周开始前提醒</span>
          <span class="t-mini">休息周前一天通知</span>
        </div>
        <ToggleSwitch v-model="settings.deloadReminder" />
      </div>

      <div class="setting-row">
        <div class="sr-text">
          <span class="sr-title">训练中振动反馈</span>
        </div>
        <ToggleSwitch v-model="settings.vibrate" />
      </div>

      <div class="setting-row">
        <div class="sr-text">
          <span class="sr-title">完成后自动开始休息计时</span>
        </div>
        <ToggleSwitch v-model="settings.autoRest" />
      </div>
    </div>

    <!-- 周期 -->
    <router-link to="/program" class="card card-pad sec link-sec">
      <div class="setting-row" style="padding: 0">
        <div class="sr-text">
          <span class="sr-title">训练周期</span>
          <span class="t-mini">每周排班 · 休息周 · 阶段切换</span>
        </div>
        <AppIcon name="chevron-right" :size="18" class="t-mini" />
      </div>
    </router-link>

    <!-- 备份 -->
    <div class="card card-pad sec">
      <div class="sec-head">
        <h3>GitHub 自动备份</h3>
        <span v-if="settings.backup.lastStatus" class="t-mini">{{ settings.backup.lastStatus }}</span>
      </div>
      <p class="t-mini" style="margin-top: -6px">
        每次修改自动备份到你的私有仓库 <b>beep-bebop/acl-training-data</b>。粘贴一次 Token 即可，此后全自动（含换新手机时从备份恢复）。
      </p>
      <div class="field">
        <span class="field-label">Token（fine-grained，只授权 acl-training-data 仓库 · Contents 读写 · 仅保存在本机）</span>
        <input v-model="token" type="password" class="field-input" placeholder="github_pat_…" autocomplete="off" />
        <span class="t-mini">没有 Token？在 GitHub → Settings → Developer settings → Fine-grained tokens 生成，权限选 Contents: Read and write</span>
      </div>
      <div class="setting-row">
        <div class="sr-text"><span class="sr-title">保存后自动备份</span></div>
        <ToggleSwitch v-model="backupForm.auto" />
      </div>
      <div class="bk-actions">
        <button class="btn btn-primary" style="flex: 1" :disabled="backupBusy" @click="saveBackupConfig">
          保存并立即备份
        </button>
      </div>
      <details class="bk-advanced">
        <summary class="t-mini">高级（默认无需修改）</summary>
        <div class="bk-grid">
          <div class="field">
            <span class="field-label">Owner</span>
            <input v-model="backupForm.owner" class="field-input" />
          </div>
          <div class="field">
            <span class="field-label">数据仓库</span>
            <input v-model="backupForm.repo" class="field-input" />
          </div>
          <div class="field">
            <span class="field-label">分支</span>
            <input v-model="backupForm.branch" class="field-input" />
          </div>
          <div class="field">
            <span class="field-label">文件路径</span>
            <input v-model="backupForm.path" class="field-input" />
          </div>
        </div>
      </details>
      <button class="btn btn-soft btn-block" @click="restoreBackup">
        <AppIcon name="download" :size="16" /> 从备份恢复
      </button>
    </div>

    <!-- AI -->
    <div class="card card-pad sec">
      <div class="sec-head"><h3>AI 辅助</h3></div>
      <p class="t-mini" style="margin-top: -6px">DeepSeek 生成动作详解（桌面工作台中使用），Key 仅保存在本机。</p>
      <div class="field">
        <span class="field-label">API Key</span>
        <input
          :value="settings.ai.apiKey"
          type="password"
          class="field-input"
          placeholder="sk-…"
          autocomplete="off"
          @change="settings.patchAi({ apiKey: $event.target.value.trim() })"
        />
      </div>
      <div class="field">
        <span class="field-label">模型</span>
        <select
          class="field-select"
          :value="settings.ai.model"
          @change="settings.patchAi({ model: $event.target.value })"
        >
          <option value="deepseek-v4-flash">deepseek-v4-flash（快）</option>
          <option value="deepseek-v4-pro">deepseek-v4-pro（好）</option>
        </select>
      </div>
    </div>

    <!-- 数据管理 -->
    <div class="card card-pad sec">
      <div class="sec-head"><h3>数据管理</h3></div>
      <div class="dm-actions">
        <button class="btn btn-soft" @click="exportSnapshot">
          <AppIcon name="download" :size="16" /> 下载快照
        </button>
        <button class="btn btn-soft" @click="copySnapshot">
          <AppIcon name="copy" :size="16" /> 复制快照
        </button>
        <button class="btn btn-soft" @click="importOpen = true">
          <AppIcon name="upload" :size="16" /> 导入数据
        </button>
      </div>
      <button class="btn btn-ghost btn-block" @click="resetCatalog">恢复默认动作库</button>
      <button class="btn btn-danger btn-block" @click="wipeLogs">
        <AppIcon name="trash" :size="16" /> 清空训练记录
      </button>
    </div>

    <!-- 关于 -->
    <div class="card card-pad sec about">
      <div class="setting-row" style="padding: 0">
        <div class="sr-text">
          <span class="sr-title">ACL 训练</span>
          <span class="t-mini">数据结构 v{{ SCHEMA_VERSION }} · {{ catalog.planGroups.length }} 阶段 / {{ catalog.exerciseCount }} 动作</span>
        </div>
      </div>
    </div>

    <ImportSheet v-model:open="importOpen" mode="snapshot" />
  </div>
</template>

<style scoped>
.sec {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sec-head h3 {
  font-size: 14.5px;
  font-weight: 800;
}
.link-sec {
  text-decoration: none;
  color: inherit;
}
.setting-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
}
.sr-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sr-title {
  font-size: 14px;
  font-weight: 650;
}
.time-input {
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  padding: 6px 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}
.time-input:disabled {
  opacity: 0.4;
}
.bk-advanced {
  border: 1px dashed var(--border);
  border-radius: var(--r-md);
  padding: 8px 12px;
}
.bk-advanced summary {
  cursor: pointer;
  user-select: none;
}
.bk-advanced .bk-grid {
  margin-top: 12px;
}
.bk-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.bk-actions {
  display: flex;
  gap: 10px;
}
.dm-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.dm-actions .btn {
  flex-direction: column;
  gap: 4px;
  font-size: 12.5px;
  min-height: 58px;
}
.about :deep(.t-mini) {
  margin-top: 2px;
}
</style>
