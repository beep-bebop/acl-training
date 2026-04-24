// 计划库页面
import { state } from '../core/state.js';
import { STAGES } from '../data/config.js';

const libraryGroupOpen = {};

function ensureGroupOpen(groupId, defaultOpen = false) {
  if (typeof libraryGroupOpen[groupId] !== 'boolean') {
    libraryGroupOpen[groupId] = defaultOpen;
  }
  return libraryGroupOpen[groupId];
}

function renderStageGroup(stage, group, isOpen) {
  const badgeText = stage.badge || stage.subtitle.replace('阶段', '');
  const previewIcons = group.slice(0, 3).map(plan => `<span class="stage-preview-icon">${plan.icon || '•'}</span>`).join('');

  let html = `<div class="stage-section${isOpen ? ' open' : ''}">`;
  html += `<button class="stage-header" data-toggle-stage="${stage.id}" type="button">`;
  html += '<div class="stage-header-main">';
  html += `<div class="stage-badge" style="background:${stage.gradient || stage.color}">${badgeText}</div>`;
  html += `<div><div class="stage-title">${stage.name}</div><div class="stage-subtitle">${stage.subtitle}</div></div>`;
  html += '</div>';
  html += '<div class="stage-header-side">';
  html += `<div class="stage-mini-icons">${previewIcons}</div>`;
  html += `<div class="stage-count">${group.length} 套计划</div>`;
  html += '<div class="stage-arrow">›</div>';
  html += '</div></button>';
  html += '<div class="stage-body"><div class="plan-cards">';

  group.forEach(plan => {
    const modules = Array.isArray(plan.modules) ? plan.modules : [];
    const exCount = modules.reduce((sum, m) => sum + (Array.isArray(m.exercises) ? m.exercises.length : 0), 0);
    html += `<div class="plan-card" data-plan-id="${plan.id}">`;
    html += `<div class="plan-card-icon" style="background:${stage.color}20">${plan.icon}</div>`;
    html += `<div class="plan-card-info"><div class="plan-card-name">${plan.name}</div>`;
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

  // 按阶段分组
  const stageGroups = {};
  STAGES.forEach(s => { stageGroups[s.id] = []; });
  state.plans.forEach(p => {
    if (!stageGroups[p.stage]) stageGroups[p.stage] = [];
    stageGroups[p.stage].push(p);
  });

  let html = '';
  STAGES.forEach(stage => {
    const group = stageGroups[stage.id];
    if (!group || !group.length) return;
    const isOpen = ensureGroupOpen(stage.id, stage.order === 1);
    html += renderStageGroup(stage, group, isOpen);
  });

  // 未匹配已知阶段的计划（自定义导入）
  const orphans = state.plans.filter(p => !STAGES.find(s => s.id === p.stage));
  if (orphans.length) {
    const customStage = {
      id: 'custom',
      name: '自定义计划',
      subtitle: '导入的计划',
      badge: '+',
      color: '#8E8E93',
      gradient: '#8E8E93',
    };
    const isOpen = ensureGroupOpen(customStage.id, false);
    html += renderStageGroup(customStage, orphans, isOpen);
  }

  container.innerHTML = html;
}
