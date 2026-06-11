// 设置页面
import { state } from '../core/state.js';
import { saveToStorage, clearAllProgress } from '../core/storage.js';
import {
  getCurrentSnapshot, importPlans, loadDefaultCatalogSnapshot
} from '../services/plans.js';
import {
  normalizeGitHubBackupConfig,
  loadGitHubBackupToken,
  saveGitHubBackupToken,
  clearGitHubBackupToken,
  pushGitHubBackup,
  pullGitHubBackup,
} from '../services/github-backup.js';
import { showToast, copyToClipboard } from '../utils/helpers.js';
import { renderLibrary } from './library.js';

function buildSnapshotForExport() {
  const snapshot = getCurrentSnapshot();
  if (snapshot.settings?.aiConfig) {
    snapshot.settings.aiConfig.deepseekApiKey = '';
  }
  if (snapshot.settings?.githubBackup) {
    delete snapshot.settings.githubBackup.token;
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
  hydrateGitHubBackupInputs();
}

function getGitHubBackupInputs() {
  return {
    ownerInput: document.getElementById('githubBackupOwnerInput'),
    repoInput: document.getElementById('githubBackupRepoInput'),
    branchInput: document.getElementById('githubBackupBranchInput'),
    pathInput: document.getElementById('githubBackupPathInput'),
    tokenInput: document.getElementById('githubBackupTokenInput'),
    statusEl: document.getElementById('githubBackupStatus'),
  };
}

function readGitHubBackupForm() {
  const { ownerInput, repoInput, branchInput, pathInput, tokenInput } = getGitHubBackupInputs();
  return {
    config: normalizeGitHubBackupConfig({
      owner: ownerInput?.value,
      repo: repoInput?.value,
      branch: branchInput?.value,
      path: pathInput?.value,
    }),
    token: tokenInput?.value?.trim() || loadGitHubBackupToken(),
  };
}

function ensureGitHubBackupSettings() {
  if (!state.settings) state.settings = {};
  state.settings.githubBackup = {
    ...normalizeGitHubBackupConfig(state.settings.githubBackup),
    lastBackupAt: state.settings.githubBackup?.lastBackupAt || '',
    lastRestoreAt: state.settings.githubBackup?.lastRestoreAt || '',
    lastCommitSha: state.settings.githubBackup?.lastCommitSha || '',
    lastAutoBackupStatus: state.settings.githubBackup?.lastAutoBackupStatus || '',
  };
  return state.settings.githubBackup;
}

function updateGitHubBackupStatus(message) {
  const { statusEl } = getGitHubBackupInputs();
  if (statusEl) statusEl.textContent = message || '';
}

function formatBackupTime(value) {
  if (!value) return '还没有记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function hydrateGitHubBackupInputs() {
  const config = ensureGitHubBackupSettings();
  const { ownerInput, repoInput, branchInput, pathInput, tokenInput } = getGitHubBackupInputs();
  if (ownerInput) ownerInput.value = config.owner || '';
  if (repoInput) repoInput.value = config.repo || '';
  if (branchInput) branchInput.value = config.branch || 'main';
  if (pathInput) pathInput.value = config.path || 'acl-training-backup.json';
  if (tokenInput) tokenInput.value = loadGitHubBackupToken();
  const autoStatus = config.lastAutoBackupStatus ? `；自动备份：${config.lastAutoBackupStatus}` : '';
  updateGitHubBackupStatus(`上次备份：${formatBackupTime(config.lastBackupAt)}；上次恢复：${formatBackupTime(config.lastRestoreAt)}${autoStatus}`);
}

export function setGitHubBackupAutoStatus(status) {
  const message = status?.message || '';
  if (!message) return;
  const suffix = status.state === 'error' ? `失败：${message}` : message;
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  if (!state.settings) state.settings = {};
  state.settings.githubBackup = {
    ...(state.settings.githubBackup || {}),
    lastAutoBackupStatus: `${suffix}（${time}）`,
  };
  hydrateGitHubBackupInputs();
}

function persistGitHubBackupConfig() {
  const { config, token } = readGitHubBackupForm();
  const current = ensureGitHubBackupSettings();
  state.settings.githubBackup = {
    ...current,
    ...config,
  };
  saveGitHubBackupToken(token);
  saveToStorage();
  hydrateGitHubBackupInputs();
  return { config: state.settings.githubBackup, token };
}

export function saveGitHubBackupConfig() {
  persistGitHubBackupConfig();
  showToast('GitHub 数据仓库配置已保存');
}

export async function backupToGitHub() {
  const { config, token } = persistGitHubBackupConfig();
  updateGitHubBackupStatus('正在备份到 GitHub...');
  const result = await pushGitHubBackup(getCurrentSnapshot(), config, token);
  if (!result.ok) {
    updateGitHubBackupStatus(result.msg || 'GitHub 备份失败');
    showToast(`备份失败：${result.msg || '请检查仓库和 Token'}`);
    return;
  }
  const current = ensureGitHubBackupSettings();
  state.settings.githubBackup = {
    ...current,
    ...result.config,
    lastBackupAt: result.exportedAt,
    lastCommitSha: result.commitSha || current.lastCommitSha || '',
  };
  saveToStorage();
  hydrateGitHubBackupInputs();
  showToast('已备份到 GitHub 数据仓库');
}

export async function restoreFromGitHub() {
  const { config, token } = persistGitHubBackupConfig();
  if (!confirm('确定从 GitHub 数据仓库恢复吗？当前本机计划、记录和统计会被备份内容替换。')) return;
  updateGitHubBackupStatus('正在从 GitHub 读取备份...');
  const result = await pullGitHubBackup(config, token);
  if (!result.ok) {
    updateGitHubBackupStatus(result.msg || 'GitHub 恢复失败');
    showToast(`恢复失败：${result.msg || '请检查备份文件'}`);
    return;
  }
  const imported = importPlans(result.snapshot, 'replace');
  if (!imported.ok) {
    updateGitHubBackupStatus(imported.msg || '备份数据校验失败');
    showToast(`恢复失败：${imported.msg}`);
    return;
  }
  const current = ensureGitHubBackupSettings();
  state.settings.githubBackup = {
    ...current,
    ...result.config,
    lastRestoreAt: new Date().toISOString(),
    lastCommitSha: result.sha || current.lastCommitSha || '',
  };
  saveToStorage();
  renderLibrary();
  hydrateGitHubBackupInputs();
  showToast('已从 GitHub 恢复训练数据');
}

export function clearGitHubBackupTokenSetting() {
  clearGitHubBackupToken();
  hydrateGitHubBackupInputs();
  showToast('已清空本机 GitHub Token');
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
