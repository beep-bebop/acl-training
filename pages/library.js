// 计划库页面
import { state } from '../core/state.js';
import { STAGES } from '../data/config.js';
import { getPlanProgress, getPlan } from '../utils/helpers.js';

export function renderLibrary() {
  const container = document.getElementById('libraryContent');
  if (!container) return;

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
    html += `<div class="stage-section"><div class="stage-header">`;
    html += `<div class="stage-badge" style="background:${stage.gradient || stage.color}">${stage.subtitle.replace('阶段', '')}</div>`;
    html += `<div><div class="stage-title">${stage.name}</div><div class="stage-subtitle">${stage.subtitle}</div></div>`;
    html += `</div><div class="plan-cards">`;

    group.forEach(plan => {
      const exCount = plan.modules.reduce((sum, m) => sum + m.exercises.length, 0);
      html += `<div class="plan-card" data-plan-id="${plan.id}">`;
      html += `<div class="plan-card-icon" style="background:${stage.color}20">${plan.icon}</div>`;
      html += `<div class="plan-card-info"><div class="plan-card-name">${plan.name}</div>`;
      html += `<div class="plan-card-desc">${plan.modules.length} 个模块 · ${exCount} 个动作</div></div>`;
      html += `<div class="plan-card-arrow">›</div></div>`;
    });

    html += `</div></div>`;
  });

  // 未匹配已知阶段的计划（自定义导入）
  const orphans = state.plans.filter(p => !STAGES.find(s => s.id === p.stage));
  if (orphans.length) {
    html += `<div class="stage-section"><div class="stage-header">`;
    html += `<div class="stage-badge" style="background:#8E8E93">+</div>`;
    html += `<div><div class="stage-title">自定义计划</div><div class="stage-subtitle">导入的计划</div></div>`;
    html += `</div><div class="plan-cards">`;
    orphans.forEach(plan => {
      const exCount = plan.modules.reduce((sum, m) => sum + m.exercises.length, 0);
      html += `<div class="plan-card" data-plan-id="${plan.id}">`;
      html += `<div class="plan-card-icon" style="background:#8E8E9320">${plan.icon}</div>`;
      html += `<div class="plan-card-info"><div class="plan-card-name">${plan.name}</div>`;
      html += `<div class="plan-card-desc">${plan.modules.length} 个模块 · ${exCount} 个动作</div></div>`;
      html += `<div class="plan-card-arrow">›</div></div>`;
    });
    html += `</div></div>`;
  }

  container.innerHTML = html;
}
