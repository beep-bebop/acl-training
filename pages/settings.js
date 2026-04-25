// 设置页面
import { state } from '../core/state.js';
import { saveToStorage, clearAllProgress } from '../core/storage.js';
import { getCurrentSnapshot, importPlans, loadDefaultCatalogSnapshot } from '../services/plans.js';
import { showToast, copyToClipboard } from '../utils/helpers.js';
import { renderLibrary } from './library.js';

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
  const snapshot = getCurrentSnapshot();
  // 安全默认：导出时不携带 API Key，避免误传泄露凭据。
  if (snapshot.settings?.aiConfig) {
    snapshot.settings.aiConfig.deepseekApiKey = '';
  }
  const data = {
    ...snapshot,
    exportedAt: new Date().toISOString(),
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `acl-plans-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
