// 计划详情页面
import { state } from '../core/state.js';
import { STAGES } from '../data/config.js';
import { saveToStorage } from '../core/storage.js';
import { getStage, getPlan, getExercise, getSetsDisplay, getPlanProgress, showToast } from '../utils/helpers.js';

const DOT_COLORS = { warmup: '#34C759', stretch: '#5AC8FA', activate: '#FF9500', main: '#5856D6', core: '#FF2D55', cooldown: '#5AC8FA', cardio: '#FF3B30', custom: '#8E8E93' };
let activeEditorKey = null;

function editorKey(mi, ei) {
  return `${mi}_${ei}`;
}

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function persistEditorByKey(key, { toast = false } = {}) {
  if (!state.currentPlanId || !key) return;

  const item = document.querySelector(`.detail-ex-item[data-edit-key="${key}"]`);
  if (!item) return;

  const nameInput = item.querySelector('[data-edit-field="name"]');
  const setsInput = item.querySelector('[data-edit-field="sets"]');
  const tipInput = item.querySelector('[data-edit-field="tip"]');

  const nameValue = nameInput ? nameInput.value.trim() : '';
  const setsValue = setsInput ? setsInput.value.trim() : '';
  const tipValue = tipInput ? tipInput.value.trim() : '';

  if (!state.userEdits[state.currentPlanId]) state.userEdits[state.currentPlanId] = {};

  const edit = { ...(state.userEdits[state.currentPlanId][key] || {}) };
  if (nameValue) edit.name = nameValue; else delete edit.name;
  if (setsValue) edit.sets = setsValue; else delete edit.sets;
  if (tipValue) edit.tip = tipValue; else delete edit.tip;

  if (Object.keys(edit).length) {
    state.userEdits[state.currentPlanId][key] = edit;
  } else {
    delete state.userEdits[state.currentPlanId][key];
    if (!Object.keys(state.userEdits[state.currentPlanId]).length) {
      delete state.userEdits[state.currentPlanId];
    }
  }

  saveToStorage();
  if (toast) showToast('✅ 已保存修改');
}

export function openPlanDetail(planId) {
  state.currentPlanId = planId;
  state.isEditMode = false;
  activeEditorKey = null;
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
      const key = editorKey(mi, ei);
      const editing = activeEditorKey === key ? ' editing' : '';
      html += `<div class="detail-ex-item${editing}" data-mi="${mi}" data-ei="${ei}" data-edit-key="${key}">`;
      html += `<div class="detail-ex-main" data-edit-open="${mi}|${ei}">`;
      html += `<div class="detail-ex-dot" style="background:${dotColor}"></div>`;
      html += `<div class="detail-ex-name">${actualEx.name}</div>`;
      html += `<div class="detail-ex-sets">${setsStr}</div>`;
      html += `<div class="detail-ex-edit-tag">${editing ? '收起' : '编辑'}</div>`;
      html += '</div>';
      html += '<div class="detail-ex-editor">';
      html += '<div class="detail-editor-label">动作名称</div>';
      html += `<input class="detail-ex-edit-name" value="${escapeHtml(actualEx.name)}" data-edit-field="name" />`;
      html += '<div class="detail-editor-label">组数 / 次数</div>';
      html += `<input class="detail-ex-edit-sets" value="${escapeHtml(setsStr)}" data-edit-field="sets" />`;
      html += '<div class="detail-editor-label">备注要领</div>';
      html += `<textarea class="detail-ex-edit-tip" data-edit-field="tip">${escapeHtml(actualEx.tip || '')}</textarea>`;
      html += `<button class="detail-save-btn" data-edit-save="${mi}|${ei}" type="button">保存并收起</button>`;
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';

    html += '</div>';
  });

  const prog = getPlanProgress(state.currentPlanId, state.plans, state.userEdits, state.trainingProgress);
  const btnText = prog.done > 0 ? `继续训练 (${prog.done}/${prog.total})` : '开始训练';
  html += `<button class="start-training-btn" data-start-training="${state.currentPlanId}">💪 ${btnText}</button>`;
  html += '</div>';
  container.innerHTML = html;

  if (activeEditorKey) {
    const currentEditor = container.querySelector(`.detail-ex-item[data-edit-key="${activeEditorKey}"] [data-edit-field="name"]`);
    if (currentEditor) currentEditor.focus();
  }
}

export function toggleDetailEditor(mi, ei) {
  const key = editorKey(mi, ei);
  if (activeEditorKey && activeEditorKey !== key) {
    persistEditorByKey(activeEditorKey);
  }

  if (activeEditorKey === key) {
    persistEditorByKey(key);
    activeEditorKey = null;
  } else {
    activeEditorKey = key;
  }
  renderDetail();
}

export function saveDetailEditor(mi, ei) {
  const key = editorKey(mi, ei);
  persistEditorByKey(key, { toast: true });
  activeEditorKey = null;
  renderDetail();
}

export function flushDetailEditorChanges() {
  if (!activeEditorKey) return;
  persistEditorByKey(activeEditorKey);
  activeEditorKey = null;
}
