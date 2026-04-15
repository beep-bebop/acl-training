// 计划详情页面
import { state } from '../core/state.js';
import { STAGES } from '../data/config.js';
import { saveToStorage } from '../core/storage.js';
import { getStage, getPlan, getExercise, getSetsDisplay, getPlanProgress, showToast } from '../utils/helpers.js';

const DOT_COLORS = { warmup: '#34C759', stretch: '#5AC8FA', activate: '#FF9500', main: '#5856D6', core: '#FF2D55', cooldown: '#5AC8FA', cardio: '#FF3B30', custom: '#8E8E93' };

export function openPlanDetail(planId) {
  state.currentPlanId = planId;
  state.isEditMode = false;
  return planId; // 返回给 app.js 做导航
}

export function renderDetail() {
  const plan = getPlan(state.currentPlanId, state.plans);
  if (!plan) return;
  const stage = getStage(plan.stage, STAGES);
  const container = document.getElementById('detailContent');

  document.getElementById('navTitle').textContent = plan.icon + ' ' + plan.name;

  let html = '<div style="padding:16px;">';
  html += `<div class="detail-stage-tag" style="background:${stage.gradient || stage.color}">${stage.subtitle}</div>`;
  html += `<div class="detail-plan-name">${plan.name}</div>`;
  const exCount = plan.modules.reduce((sum, m) => sum + m.exercises.length, 0);
  html += `<div class="detail-plan-desc">${plan.modules.length} 个模块 · ${exCount} 个动作</div>`;

  plan.modules.forEach((mod, mi) => {
    const dotColor = DOT_COLORS[mod.type] || '#8E8E93';
    html += `<div class="detail-module"><div class="detail-module-head">`;
    html += `<div class="detail-module-icon ${mod.type}">${mod.icon}</div>`;
    html += `<div class="detail-module-info"><div class="detail-module-name">${mod.name}</div>`;
    html += `<div class="detail-module-count">${mod.exercises.length} 个动作</div></div></div>`;

    html += '<div class="detail-exercises">';
    mod.exercises.forEach((ex, ei) => {
      const actualEx = getExercise(state.currentPlanId, mi, ei, state.plans, state.userEdits);
      const setsStr = getSetsDisplay(actualEx);
      const editing = state.isEditMode ? ' editing' : '';
      html += `<div class="detail-ex-item${editing}" data-mi="${mi}" data-ei="${ei}">`;
      html += `<div class="detail-ex-dot" style="background:${dotColor}"></div>`;
      html += `<div class="detail-ex-name">${actualEx.name}</div>`;
      html += `<input class="detail-ex-edit-name" value="${actualEx.name.replace(/"/g, '&quot;')}" data-field="name" />`;
      html += `<div class="detail-ex-sets">${setsStr}</div>`;
      html += `<input class="detail-ex-edit-sets" value="${setsStr.replace(/"/g, '&quot;')}" data-field="sets" />`;
      html += '</div>';
    });
    html += '</div>';

    if (state.isEditMode) {
      html += '<div class="detail-tip-section">';
      mod.exercises.forEach((ex, ei) => {
        const actualEx = getExercise(state.currentPlanId, mi, ei, state.plans, state.userEdits);
        html += '<div style="margin-bottom:10px;">';
        html += `<div class="detail-tip-label">📋 ${actualEx.name} - 要领</div>`;
        html += `<div class="detail-tip-text" contenteditable="true" data-mi="${mi}" data-ei="${ei}">${actualEx.tip}</div>`;
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
  });

  const prog = getPlanProgress(state.currentPlanId, state.plans, state.userEdits, state.trainingProgress);
  const btnText = prog.done > 0 ? `继续训练 (${prog.done}/${prog.total})` : '开始训练';
  html += `<button class="start-training-btn" data-start-training="${state.currentPlanId}">💪 ${btnText}</button>`;
  html += '</div>';
  container.innerHTML = html;
}

export function toggleEditMode() {
  if (state.isEditMode) saveEdits();
  state.isEditMode = !state.isEditMode;
  document.getElementById('navAction').textContent = state.isEditMode ? '完成' : '编辑';
  renderDetail();
}

function saveEdits() {
  if (!state.currentPlanId) return;
  document.querySelectorAll('.detail-ex-item.editing').forEach(item => {
    const mi = item.dataset.mi, ei = item.dataset.ei;
    const nameInput = item.querySelector('.detail-ex-edit-name');
    const setsInput = item.querySelector('.detail-ex-edit-sets');
    if (!state.userEdits[state.currentPlanId]) state.userEdits[state.currentPlanId] = {};
    const key = `${mi}_${ei}`, edit = state.userEdits[state.currentPlanId][key] || {};
    if (nameInput && nameInput.value.trim()) edit.name = nameInput.value.trim();
    if (setsInput && setsInput.value.trim()) edit.sets = setsInput.value.trim();
    state.userEdits[state.currentPlanId][key] = edit;
  });
  document.querySelectorAll('.detail-tip-text[contenteditable="true"]').forEach(el => {
    const mi = el.dataset.mi, ei = el.dataset.ei;
    const newTip = el.textContent.trim();
    if (!state.userEdits[state.currentPlanId]) state.userEdits[state.currentPlanId] = {};
    const key = `${mi}_${ei}`, edit = state.userEdits[state.currentPlanId][key] || {};
    if (newTip) edit.tip = newTip;
    state.userEdits[state.currentPlanId][key] = edit;
  });
  saveToStorage();
  showToast('✅ 已保存修改');
}
