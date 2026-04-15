// 设置页面
import { state } from '../core/state.js';
import { saveToStorage, clearAllProgress } from '../core/storage.js';
import { loadDefaultPlans } from '../services/plans.js';
import { showToast, copyToClipboard, todayStr } from '../utils/helpers.js';
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
  const defaults = await loadDefaultPlans();
  state.plans = JSON.parse(JSON.stringify(defaults));
  state.userEdits = {};
  saveToStorage();
  renderLibrary();
  showToast('🔄 已恢复默认计划');
}

export function exportPlans() {
  const data = {
    version: 6,
    exportedAt: new Date().toISOString(),
    plans: state.plans,
    userEdits: state.userEdits
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
  showToast('📤 已导出计划 JSON');
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
