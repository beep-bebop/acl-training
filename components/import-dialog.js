// 导入对话框
import { state } from '../core/state.js';
import { importPlans } from '../services/plans.js';
import { showToast } from '../utils/helpers.js';
import { renderLibrary } from '../pages/library.js';

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function flattenV7Plans(data) {
  const groups = data?.catalog?.planGroups;
  if (!Array.isArray(groups)) return [];
  const plans = [];
  groups.forEach((group) => {
    (Array.isArray(group?.plans) ? group.plans : []).forEach((plan) => {
      plans.push({ ...plan, stage: plan.stage || group.id });
    });
  });
  return plans;
}

function extractPlansForPreview(data) {
  if (Array.isArray(data?.plans)) return data.plans;
  return flattenV7Plans(data);
}

export function summarizeImportSnapshot(data) {
  const groups = Array.isArray(data?.catalog?.planGroups) ? data.catalog.planGroups : [];
  if (!groups.length && Array.isArray(data?.plans)) {
    return {
      groups: 0,
      plans: data.plans.length,
      modules: data.plans.reduce((sum, plan) => sum + (Array.isArray(plan.modules) ? plan.modules.length : 0), 0),
      exercises: data.plans.reduce((sum, plan) => (
        sum + (Array.isArray(plan.modules) ? plan.modules.reduce((mSum, mod) => (
          mSum + (Array.isArray(mod.exercises) ? mod.exercises.length : 0)
        ), 0) : 0)
      ), 0),
    };
  }

  return groups.reduce((summary, group) => {
    const plans = Array.isArray(group?.plans) ? group.plans : [];
    summary.groups += 1;
    summary.plans += plans.length;
    plans.forEach((plan) => {
      const modules = Array.isArray(plan?.modules) ? plan.modules : [];
      summary.modules += modules.length;
      modules.forEach((mod) => {
        summary.exercises += Array.isArray(mod?.exercises) ? mod.exercises.length : 0;
      });
    });
    return summary;
  }, { groups: 0, plans: 0, modules: 0, exercises: 0 });
}

export function showImportDialog() {
  document.getElementById('importOverlay').classList.add('show');
  document.getElementById('importText').value = '';
  document.getElementById('importPreview').innerHTML = '';
  document.getElementById('importConfirmBtn').style.display = 'none';
}

export function closeImportDialog() {
  document.getElementById('importOverlay').classList.remove('show');
}

export function previewImport() {
  const text = document.getElementById('importText').value.trim();
  const preview = document.getElementById('importPreview');
  const confirmBtn = document.getElementById('importConfirmBtn');
  const strategy = document.getElementById('importStrategy').value;

  if (!text) {
    preview.innerHTML = '<div style="color:var(--text3);">请粘贴 JSON 数据</div>';
    confirmBtn.style.display = 'none';
    return;
  }

  try {
    const data = typeof text === 'string' ? JSON.parse(text) : text;
    const incomingPlans = extractPlansForPreview(data);
    if (!incomingPlans.length) throw new Error('格式错误，需要包含 plans 或 catalog.planGroups');
    const summary = summarizeImportSnapshot(data);

    let html = '<div style="margin-bottom:8px;font-weight:700;">导入预览</div>';
    html += `<div class="import-summary-grid">
      <span>${summary.groups} 分组</span>
      <span>${summary.plans} 计划</span>
      <span>${summary.modules} 模块</span>
      <span>${summary.exercises} 动作</span>
    </div>`;
    html += `<div style="font-size:13px;color:var(--text2);margin-top:8px;">策略：${escapeHtml(strategy)}</div>`;
    const simulatedIds = new Set(state.plans.map(p => p.id));

    incomingPlans.forEach(p => {
      const safePlanName = escapeHtml(p.name || '');
      const safePlanId = escapeHtml(p.id || '');
      if (strategy === 'append') {
        let finalId = p.id;
        let counter = 2;
        while (simulatedIds.has(finalId)) {
          finalId = `${p.id}_${counter++}`;
        }
        simulatedIds.add(finalId);
        const renamed = finalId !== p.id;
        html += `<div style="font-size:13px;padding:4px 0;${renamed ? 'color:var(--warning);' : ''}">新增 ${safePlanName} (${escapeHtml(finalId)})${renamed ? ' · 自动重命名' : ''}</div>`;
        return;
      }

      const exists = simulatedIds.has(p.id);
      simulatedIds.add(p.id);
      html += `<div style="font-size:13px;padding:4px 0;${exists ? 'color:var(--warning);' : ''}">${exists ? '覆盖' : '新增'} ${safePlanName} (${safePlanId})</div>`;
    });

    preview.innerHTML = html;
    confirmBtn.style.display = 'flex';
  } catch (e) {
    preview.innerHTML = `<div style="color:var(--danger);">解析失败：${escapeHtml(e.message)}</div>`;
    confirmBtn.style.display = 'none';
  }
}

export function confirmImport() {
  const text = document.getElementById('importText').value.trim();
  const strategy = document.getElementById('importStrategy').value;
  const result = importPlans(text, strategy);
  if (!result.ok) {
    showToast('导入失败：' + result.msg);
    return;
  }
  closeImportDialog();
  renderLibrary();
  showToast(`导入完成：${result.imported} 新增，${result.updated} 更新`);
}
