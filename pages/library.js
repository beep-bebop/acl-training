// 计划库页面
import { state } from '../core/state.js';
import { getModuleExercises } from '../utils/helpers.js';

const libraryGroupOpen = {};

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ensureGroupOpen(groupId, defaultOpen = false) {
  if (typeof libraryGroupOpen[groupId] !== 'boolean') {
    libraryGroupOpen[groupId] = defaultOpen;
  }
  return libraryGroupOpen[groupId];
}

function renderStageGroup(groupMeta, plans, isOpen) {
  const badgeText = escapeHtml(groupMeta.badge || groupMeta.subtitle || groupMeta.name || '');
  const safeGroupId = escapeHtml(groupMeta.id || '');
  const safeGroupName = escapeHtml(groupMeta.name || '');
  const safeGroupSubtitle = escapeHtml(groupMeta.subtitle || '');
  const safeGroupColor = escapeHtml(groupMeta.color || '#8E8E93');
  const safeGroupGradient = escapeHtml(groupMeta.gradient || safeGroupColor);
  const previewIcons = plans.slice(0, 3).map(plan => `<span class="stage-preview-icon">${escapeHtml(plan.icon || '•')}</span>`).join('');

  let html = `<div class="stage-section${isOpen ? ' open' : ''}">`;
  html += `<button class="stage-header" data-toggle-stage="${safeGroupId}" type="button">`;
  html += '<div class="stage-header-main">';
  html += `<div class="stage-badge" style="background:${safeGroupGradient}">${badgeText}</div>`;
  html += `<div><div class="stage-title">${safeGroupName}</div><div class="stage-subtitle">${safeGroupSubtitle}</div></div>`;
  html += '</div>';
  html += '<div class="stage-header-side">';
  html += `<div class="stage-mini-icons">${previewIcons}</div>`;
  html += `<div class="stage-count">${plans.length} 套计划</div>`;
  html += '<div class="stage-arrow">›</div>';
  html += '</div></button>';
  html += '<div class="stage-body"><div class="plan-cards">';

  plans.forEach(plan => {
    const safePlanId = escapeHtml(plan.id || '');
    const safePlanIcon = escapeHtml(plan.icon || '•');
    const safePlanName = escapeHtml(plan.name || '');
    const modules = Array.isArray(plan.modules) ? plan.modules : [];
    const exCount = modules.reduce((sum, _m, mi) =>
      sum + getModuleExercises(plan.id, mi, state.plans, {}).length
    , 0);
    html += `<div class="plan-card" data-plan-id="${safePlanId}">`;
    html += `<div class="plan-card-icon" style="background:${safeGroupColor}20">${safePlanIcon}</div>`;
    html += `<div class="plan-card-info"><div class="plan-card-name">${safePlanName}</div>`;
    html += `<div class="plan-card-desc">${modules.length} 个模块 · ${exCount} 个动作</div></div>`;
    html += '<div class="plan-card-arrow">›</div></div>';
  });

  html += '</div></div></div>';
  return html;
}

export function toggleLibraryStage(stageId) {
  const current = ensureGroupOpen(stageId, false);
  libraryGroupOpen[stageId] = !current;
  renderLibrary();
}

export function renderLibrary() {
  const container = document.getElementById('libraryContent');
  if (!container) return;
  const planCountEl = document.getElementById('planCount');
  if (planCountEl) planCountEl.textContent = state.plans.length;

  const groups = (state.catalog?.planGroups || [])
    .slice()
    .sort((a, b) => (a.order || 999) - (b.order || 999));
  let html = '';
  groups.forEach(group => {
    const plans = Array.isArray(group.plans) ? group.plans : [];
    if (!plans.length) return;
    const isOpen = ensureGroupOpen(group.id, (group.order || 999) === 1);
    html += renderStageGroup(group, plans, isOpen);
  });

  container.innerHTML = html;
}
