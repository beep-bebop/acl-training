// 设置页面
import { state } from '../core/state.js';
import { saveToStorage, clearAllProgress } from '../core/storage.js';
import {
  getCurrentSnapshot, importPlans, loadDefaultCatalogSnapshot,
  previewRemoteCatalogMerge, applyRemoteCatalogMerge
} from '../services/plans.js';
import { showToast, copyToClipboard } from '../utils/helpers.js';
import { renderLibrary } from './library.js';

let pendingRemoteSyncPreview = null;

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSnapshotForExport() {
  const snapshot = getCurrentSnapshot();
  if (snapshot.settings?.aiConfig) {
    snapshot.settings.aiConfig.deepseekApiKey = '';
  }
  return snapshot;
}

function downloadSnapshotAsFile(snapshot, filenamePrefix = 'acl-plans') {
  const data = {
    ...snapshot,
    exportedAt: new Date().toISOString(),
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderSyncMetaSummary() {
  const el = document.getElementById('syncMetaSummary');
  if (!el) return;
  const meta = state.settings?.syncMeta || {};
  if (!meta.lastSyncAt) {
    el.textContent = '尚未执行远程同步';
    return;
  }
  const source = meta.lastSource || 'data/catalog.v7.json';
  const summary = meta.lastSummary || '已完成同步';
  el.textContent = `${meta.lastSyncAt} · ${summary} · ${source}`;
}

function renderRemotePreviewHtml(result) {
  const preview = document.getElementById('remoteSyncPreview');
  const applyBtn = document.getElementById('remoteSyncApplyBtn');
  if (!preview || !applyBtn) return;
  if (!result) {
    preview.innerHTML = '<div style="color:var(--text3);font-size:12px;">点击“拉取并预览”查看远程变更。</div>';
    applyBtn.style.display = 'none';
    return;
  }
  if (!result.ok) {
    preview.innerHTML = `<div style="color:var(--danger);font-size:12px;">❌ ${result.msg}</div>`;
    applyBtn.style.display = 'none';
    return;
  }
  preview.innerHTML = `
    <div style="font-weight:700;color:var(--text1);margin-bottom:6px;">远程合并预览</div>
    <div style="font-size:12px;color:var(--text2);line-height:1.55;">
      远程总计划：${result.remoteTotal}<br>
      新增到本地：${result.remoteAdded}<br>
      覆盖同 ID：${result.remoteUpdated}<br>
      保留本地独有：${result.localOnlyKept}<br>
      数据哈希：${(result.remoteHash || '').slice(0, 12) || '-'}<br>
      来源：${result.sourceUrl}
    </div>`;
  applyBtn.style.display = 'inline-flex';
}

export function resetAllData() {
  if (!confirm('确定要清除所有训练记录吗？此操作不可恢复。')) return;
  clearAllProgress();
  saveToStorage();
  renderLibrary();
  showToast('🗑 已清除所有记录');
}

export async function resetPlansToDefault() {
  if (!confirm('确定要恢复默认计划吗？自定义导入的计划将丢失。')) return;
  const defaults = await loadDefaultCatalogSnapshot();
  const snapshot = getCurrentSnapshot();
  snapshot.catalog = defaults.catalog;
  snapshot.runtime.progress = {};
  snapshot.runtime.exerciseRest = {};
  snapshot.runtime.trainingSessionStartAt = null;
  const result = importPlans(snapshot, 'replace');
  if (!result.ok) {
    showToast(`❌ ${result.msg}`);
    return;
  }
  renderLibrary();
  showToast('🔄 已恢复默认计划');
}

export function exportPlans() {
  const snapshot = buildSnapshotForExport();
  downloadSnapshotAsFile(snapshot, 'acl-plans');
  showToast('📤 已导出计划 JSON（已自动隐藏 API Key）');
}

export function copySchemaTemplate() {
  const el = document.getElementById('schemaTemplate');
  if (!el) return;
  copyToClipboard(el.textContent).then(() => {
    showToast('📋 已复制到剪贴板');
  }).catch(() => {
    showToast('❌ 复制失败，请手动选择复制');
  });
}

export function hydrateAiConfigInputs() {
  const keyInput = document.getElementById('deepseekApiKeyInput');
  const modelSelect = document.getElementById('deepseekModelSelect');
  if (keyInput) keyInput.value = state.settings?.aiConfig?.deepseekApiKey || '';
  if (modelSelect) {
    const model = state.settings?.aiConfig?.deepseekModel === 'deepseek-v4-pro'
      ? 'deepseek-v4-pro'
      : 'deepseek-v4-flash';
    modelSelect.value = model;
  }
  renderSyncMetaSummary();
}

export async function previewRemoteSync() {
  const sourceInput = document.getElementById('remoteSyncSourceInput');
  const source = sourceInput ? sourceInput.value.trim() : '';
  pendingRemoteSyncPreview = null;
  const previewEl = document.getElementById('remoteSyncPreview');
  const applyBtn = document.getElementById('remoteSyncApplyBtn');
  if (previewEl) {
    previewEl.innerHTML = '<div style="color:var(--text3);font-size:12px;">拉取中，请稍候...</div>';
  }
  if (applyBtn) applyBtn.style.display = 'none';
  const preview = await previewRemoteCatalogMerge(source);
  if (!preview.ok) {
    pendingRemoteSyncPreview = null;
    renderRemotePreviewHtml(preview);
    showToast(`❌ ${preview.msg}`);
    return;
  }
  pendingRemoteSyncPreview = preview;
  renderRemotePreviewHtml(preview);
  showToast('✅ 远程预览已生成');
}

export function applyRemoteSync() {
  if (!pendingRemoteSyncPreview || !pendingRemoteSyncPreview.ok) {
    showToast('⚠️ 请先拉取并预览远程数据');
    return;
  }
  if (!confirm('确认将远程计划合并到本地吗？系统会先自动导出一份本地备份。')) return;

  const backup = buildSnapshotForExport();
  downloadSnapshotAsFile(backup, 'acl-sync-backup');
  const result = applyRemoteCatalogMerge(pendingRemoteSyncPreview);
  if (!result.ok) {
    showToast(`❌ ${result.msg}`);
    return;
  }
  pendingRemoteSyncPreview = null;
  const previewEl = document.getElementById('remoteSyncPreview');
  const applyBtn = document.getElementById('remoteSyncApplyBtn');
  if (previewEl) {
    previewEl.innerHTML = `<div style="color:var(--success);font-size:12px;">✅ 已应用远程变更：${escapeHtml(result.summary)}</div>`;
  }
  if (applyBtn) applyBtn.style.display = 'none';
  renderSyncMetaSummary();
  renderLibrary();
  showToast(`🔄 已同步远程计划：${result.summary}`);
}

export function saveAiConfig() {
  const keyInput = document.getElementById('deepseekApiKeyInput');
  const modelSelect = document.getElementById('deepseekModelSelect');
  if (!state.settings) state.settings = {};
  if (!state.settings.aiConfig) state.settings.aiConfig = {};
  state.settings.aiConfig.deepseekApiKey = keyInput ? keyInput.value.trim() : '';
  state.settings.aiConfig.deepseekModel = modelSelect && modelSelect.value === 'deepseek-v4-pro'
    ? 'deepseek-v4-pro'
    : 'deepseek-v4-flash';
  saveToStorage();
  showToast('🤖 AI 配置已保存');
}

export function clearAiApiKey() {
  if (!state.settings) state.settings = {};
  if (!state.settings.aiConfig) state.settings.aiConfig = {};
  state.settings.aiConfig.deepseekApiKey = '';
  saveToStorage();
  hydrateAiConfigInputs();
  showToast('🔐 已清空 API Key');
}
