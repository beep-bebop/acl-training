// 设置页面
import { state } from '../core/state.js';
import { saveToStorage, clearAllProgress } from '../core/storage.js';
import {
  getCurrentSnapshot, importPlans, loadDefaultCatalogSnapshot
} from '../services/plans.js';
import { showToast, copyToClipboard } from '../utils/helpers.js';
import { renderLibrary } from './library.js';

function buildSnapshotForExport() {
  const snapshot = getCurrentSnapshot();
  if (snapshot.settings?.aiConfig) {
    snapshot.settings.aiConfig.deepseekApiKey = '';
  }
  return snapshot;
}

function buildCurrentPlanSnapshotForExport() {
  const snapshot = buildSnapshotForExport();
  const currentPlanId = state.currentPlanId;
  if (!currentPlanId) return null;
  const nextGroups = [];
  (snapshot.catalog?.planGroups || []).forEach((group) => {
    const plans = (group.plans || []).filter(plan => plan.id === currentPlanId);
    if (plans.length) nextGroups.push({ ...group, plans });
  });
  if (!nextGroups.length) return null;
  snapshot.catalog = { ...snapshot.catalog, planGroups: nextGroups };
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
  showToast('已导出全部计划 JSON（已隐藏 API Key）');
}

export function exportCurrentPlan() {
  const snapshot = buildCurrentPlanSnapshotForExport();
  if (!snapshot) {
    showToast('请先打开一个计划，再导出当前计划');
    return;
  }
  const plan = snapshot.catalog.planGroups[0]?.plans?.[0];
  downloadSnapshotAsFile(snapshot, `acl-plan-${plan?.id || 'current'}`);
  showToast('已导出当前计划 JSON（已隐藏 API Key）');
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

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
}

export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function toggleTheme() {
  const current = state.settings?.theme || 'auto';
  const modes = ['auto', 'dark', 'light'];
  const currentIndex = modes.indexOf(current);
  const nextIndex = (currentIndex + 1) % modes.length;
  const next = modes[nextIndex];
  
  if (!state.settings) state.settings = {};
  state.settings.theme = next;
  saveToStorage();
  
  if (next === 'auto') {
    applyAutoTheme();
    updateThemeButton(getEffectiveTheme());
  } else {
    applyTheme(next);
    updateThemeButton(next);
  }
  return next;
}

export function updateThemeButton(theme) {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const labels = { auto: '自动', dark: '深色', light: '浅色', system: '系统' };
  btn.textContent = labels[theme] || theme;
  btn.classList.toggle('active', theme === 'dark' || theme === 'auto');
}

export function initTheme() {
  const savedTheme = state.settings?.theme || 'auto';
  if (savedTheme !== 'auto') {
    applyTheme(savedTheme);
    updateThemeButton(savedTheme);
  } else {
    applyAutoTheme();
  }
  setupSystemThemeListener();
}

function setupSystemThemeListener() {
  if (!window.matchMedia) return;
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    const themeSetting = state.settings?.theme || 'auto';
    if (themeSetting === 'auto' || themeSetting === 'system') {
      applyAutoTheme();
      updateThemeButton(getEffectiveTheme());
    }
  });
}

function applyAutoTheme() {
  const themeSetting = state.settings?.theme || 'auto';
  if (themeSetting === 'auto' || themeSetting === 'system') {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyTheme('dark');
    } else {
      applyTheme('light');
    }
  } else if (themeSetting === 'time') {
    applyTimeBasedTheme();
  }
}

function applyTimeBasedTheme() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 18) {
    applyTheme('light');
  } else {
    applyTheme('dark');
  }
}

function getEffectiveTheme() {
  const themeSetting = state.settings?.theme || 'auto';
  if (themeSetting === 'auto' || themeSetting === 'system') {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  } else if (themeSetting === 'time') {
    const hour = new Date().getHours();
    return (hour >= 6 && hour < 18) ? 'light' : 'dark';
  }
  return themeSetting;
}
