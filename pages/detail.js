// 计划详情页面
import { state } from '../core/state.js';
import { STAGES } from '../data/config.js';
import { saveToStorage } from '../core/storage.js';
import {
  getStage, getPlan, getExercise, getModuleExercises,
  getSetsDisplay, getSetCount, getDuration, getPlanProgress, showToast, getPlanGroupByPlanId
} from '../utils/helpers.js';
import { enrichExerciseDetailByAI } from '../services/ai-enrich.js';

const DOT_COLORS = { warmup: '#34C759', stretch: '#5AC8FA', activate: '#FF9500', main: '#5856D6', core: '#FF2D55', cooldown: '#5AC8FA', cardio: '#FF3B30', custom: '#8E8E93' };
const TIMED_MODULE_TYPES = new Set(['warmup', 'stretch', 'cooldown']);
let activeEditorKey = null;
let pendingAddModuleIdx = null;
let enrichingKey = null;

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

function sanitizeClassToken(value = '') {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '');
}

function asPositiveInt(value, fallback) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return Math.max(1, Math.floor(n));
  return fallback;
}

function createDefaultExercise(moduleType) {
  if (TIMED_MODULE_TYPES.has(moduleType)) {
    return {
      name: '新计时动作',
      mode: 'timed',
      sets: 1,
      duration: 30,
      tip: '例如：保持稳定呼吸，不要耸肩。',
    };
  }
  return {
    name: '新计数动作',
    mode: 'counted',
    sets: 2,
    reps: '12次',
    tip: '例如：动作全程匀速，核心保持收紧。',
  };
}

function getAddExerciseDialogEls() {
  return {
    overlay: document.getElementById('addExerciseOverlay'),
    moduleName: document.getElementById('addExModuleName'),
    mode: document.getElementById('addExMode'),
    name: document.getElementById('addExName'),
    sets: document.getElementById('addExSets'),
    reps: document.getElementById('addExReps'),
    duration: document.getElementById('addExDuration'),
    tip: document.getElementById('addExTip'),
    countedWrap: document.getElementById('addExCountedWrap'),
    timedWrap: document.getElementById('addExTimedWrap'),
  };
}

export function syncAddExerciseDialogMode(mode) {
  const els = getAddExerciseDialogEls();
  const actualMode = mode === 'timed' ? 'timed' : 'counted';
  if (els.countedWrap) els.countedWrap.classList.toggle('hidden', actualMode !== 'counted');
  if (els.timedWrap) els.timedWrap.classList.toggle('hidden', actualMode !== 'timed');
}

function persistEditorByKey(key, { toast = false } = {}) {
  if (!state.currentPlanId || !key) return;

  const item = document.querySelector(`.detail-ex-item[data-edit-key="${key}"]`);
  if (!item) return;

  const [mi, ei] = key.split('_').map(v => parseInt(v, 10));
  const exercise = getExercise(state.currentPlanId, mi, ei, state.plans, {});
  if (!exercise) return;

  const nameInput = item.querySelector('[data-edit-field="name"]');
  const modeInput = item.querySelector('[data-edit-field="mode"]');
  const setsInput = item.querySelector('[data-edit-field="sets"]');
  const repsInput = item.querySelector('[data-edit-field="reps"]');
  const durationInput = item.querySelector('[data-edit-field="duration"]');
  const tipInput = item.querySelector('[data-edit-field="tip"]');

  const nameValue = nameInput ? nameInput.value.trim() : '';
  const modeValue = modeInput && modeInput.value === 'timed' ? 'timed' : 'counted';
  const setsValue = setsInput ? asPositiveInt(setsInput.value, getSetCount(exercise)) : getSetCount(exercise);
  const repsValue = repsInput ? repsInput.value.trim() : '';
  const durationValue = durationInput ? asPositiveInt(durationInput.value, getDuration(exercise)) : getDuration(exercise);
  const tipValue = tipInput ? tipInput.value.trim() : '';

  exercise.name = nameValue || exercise.name || `动作 ${ei + 1}`;
  exercise.mode = modeValue;
  exercise.sets = setsValue;
  exercise.tip = tipValue;

  if (modeValue === 'counted') {
    exercise.reps = repsValue || exercise.reps || '12次';
    delete exercise.duration;
  } else {
    exercise.duration = durationValue;
    if (repsValue) exercise.reps = repsValue;
  }

  saveToStorage();
  if (toast) showToast('✅ 已保存修改');
}

export function openPlanDetail(planId) {
  state.currentPlanId = planId;
  state.isEditMode = false;
  activeEditorKey = null;
  pendingAddModuleIdx = null;
  return planId; // 返回给 app.js 做导航
}

export function renderDetail() {
  const plan = getPlan(state.currentPlanId, state.plans);
  if (!plan) return;
  const stage = getPlanGroupByPlanId(plan.id, state.catalog, STAGES) || getStage(plan.stage, STAGES);
  const container = document.getElementById('detailContent');
  const modules = Array.isArray(plan.modules) ? plan.modules : [];
  const safeCurrentPlanId = escapeHtml(state.currentPlanId || '');

  document.getElementById('navTitle').textContent = plan.icon + ' ' + plan.name;

  let html = '<div style="padding:16px;">';
  html += `<div class="detail-stage-tag" style="background:${stage.gradient || stage.color}">${escapeHtml(stage.subtitle || stage.name)}</div>`;
  html += `<div class="detail-plan-name">${escapeHtml(plan.name)}</div>`;
  const exCount = modules.reduce((sum, _m, mi) => sum + getModuleExercises(state.currentPlanId, mi, state.plans, {}).length, 0);
  html += `<div class="detail-plan-desc">${modules.length} 个模块 · ${exCount} 个动作</div>`;

  modules.forEach((mod, mi) => {
    const safeModType = sanitizeClassToken(mod.type || 'custom');
    const dotColor = DOT_COLORS[safeModType] || '#8E8E93';
    const safeModIcon = escapeHtml(mod.icon || '•');
    const moduleExercises = getModuleExercises(state.currentPlanId, mi, state.plans, {});
    html += `<div class="detail-module"><div class="detail-module-head">`;
    html += `<div class="detail-module-icon ${safeModType}">${safeModIcon}</div>`;
    html += `<div class="detail-module-info"><div class="detail-module-name">${escapeHtml(mod.name)}</div>`;
    html += `<div class="detail-module-count">${moduleExercises.length} 个动作</div></div></div>`;

    html += '<div class="detail-exercises">';
    moduleExercises.forEach((_ex, ei) => {
      const actualEx = getExercise(state.currentPlanId, mi, ei, state.plans, {});
      if (!actualEx) return;
      const setsStr = getSetsDisplay(actualEx);
      const key = editorKey(mi, ei);
      const editing = activeEditorKey === key ? ' editing' : '';
      const mode = actualEx.mode === 'timed' ? 'timed' : 'counted';
      const setsValue = getSetCount(actualEx);
      const repsValue = actualEx.reps || '';
      const durationValue = getDuration(actualEx);
      const safeName = escapeHtml(actualEx.name || '');
      const safeSets = escapeHtml(setsStr || '');
      const isEnriching = enrichingKey === key;
      html += `<div class="detail-ex-item${editing}" data-mi="${mi}" data-ei="${ei}" data-edit-key="${key}">`;
      html += `<div class="detail-ex-main" data-edit-open="${mi}|${ei}">`;
      html += `<div class="detail-ex-dot" style="background:${dotColor}"></div>`;
      html += `<div class="detail-ex-name">${safeName}</div>`;
      html += `<div class="detail-ex-sets">${safeSets}</div>`;
      html += `<div class="detail-ex-edit-tag">${editing ? '收起' : '编辑'}</div>`;
      html += '</div>';
      html += '<div class="detail-ex-editor">';
      html += '<div class="detail-editor-label">动作名称</div>';
      html += `<input class="detail-ex-edit-name" value="${escapeHtml(actualEx.name)}" data-edit-field="name" />`;
      html += '<div class="detail-editor-type-row">';
      html += '<div class="detail-editor-label" style="margin-bottom:0;">动作类型</div>';
      html += `<select class="detail-ex-edit-mode" data-edit-field="mode">`;
      html += `<option value="counted"${mode === 'counted' ? ' selected' : ''}>计数动作（如 12 次）</option>`;
      html += `<option value="timed"${mode === 'timed' ? ' selected' : ''}>计时动作（如 30 秒）</option>`;
      html += `</select></div>`;
      html += '<div class="detail-editor-label">组数</div>';
      html += `<input class="detail-ex-edit-sets" type="number" min="1" step="1" value="${setsValue}" data-edit-field="sets" />`;
      html += `<div class="detail-mode-panel${mode === 'counted' ? '' : ' hidden'}" data-mode-panel="counted">`;
      html += '<div class="detail-editor-label">次数 / 描述</div>';
      html += `<input class="detail-ex-edit-reps" value="${escapeHtml(repsValue)}" data-edit-field="reps" placeholder="例如：15次 或 8-10/侧" />`;
      html += '</div>';
      html += `<div class="detail-mode-panel${mode === 'timed' ? '' : ' hidden'}" data-mode-panel="timed">`;
      html += '<div class="detail-editor-label">单组时长（秒）</div>';
      html += `<input class="detail-ex-edit-duration" type="number" min="5" step="5" value="${durationValue}" data-edit-field="duration" />`;
      html += '</div>';
      html += '<div class="detail-editor-label">备注要领</div>';
      html += `<textarea class="detail-ex-edit-tip" data-edit-field="tip">${escapeHtml(actualEx.tip || '')}</textarea>`;
      html += `<button class="detail-ai-btn" data-ai-enrich="${mi}|${ei}" type="button"${isEnriching ? ' disabled' : ''}>${isEnriching ? '🤖 生成中...' : '🤖 使用模型进一步获取更加详细信息'}</button>`;
      html += `<button class="detail-save-btn" data-edit-save="${mi}|${ei}" type="button">保存并收起</button>`;
      html += '</div>';
      html += '</div>';
    });
    html += `<button class="detail-add-ex-btn" data-add-ex="${mi}" type="button">+ 新增动作</button>`;
    html += '</div>';

    html += '</div>';
  });

  const prog = getPlanProgress(state.currentPlanId, state.plans, {}, state.runtime.progress);
  const btnText = prog.done > 0 ? `继续训练 (${prog.done}/${prog.total})` : '开始训练';
  html += `<button class="start-training-btn" data-start-training="${safeCurrentPlanId}">💪 ${btnText}</button>`;
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

export async function enrichDetailWithModel(mi, ei) {
  if (enrichingKey) return;
  const plan = getPlan(state.currentPlanId, state.plans);
  const mod = plan?.modules?.[mi];
  if (!plan || !mod) return;

  const ex = getExercise(state.currentPlanId, mi, ei, state.plans, {});
  if (!ex) return;

  const key = editorKey(mi, ei);
  if (activeEditorKey && activeEditorKey !== key) {
    persistEditorByKey(activeEditorKey);
  }
  activeEditorKey = key;
  enrichingKey = key;
  renderDetail();

  const result = await enrichExerciseDetailByAI({
    apiKey: state.settings?.aiConfig?.deepseekApiKey || '',
    model: state.settings?.aiConfig?.deepseekModel || 'deepseek-v4-flash',
    planName: plan.name,
    moduleName: mod.name,
    exerciseName: ex.name,
    mode: ex.mode === 'timed' ? 'timed' : 'counted',
    sets: getSetCount(ex),
    reps: ex.reps || '',
    duration: getDuration(ex),
    currentTip: ex.tip || '',
  });

  if (!result.ok) {
    enrichingKey = null;
    renderDetail();
    showToast(`❌ ${result.msg}`);
    return;
  }

  ex.tip = result.tip;
  ex.enrichment = result.enrichment || ex.enrichment || null;
  saveToStorage();

  enrichingKey = null;
  renderDetail();
  showToast('🤖 已生成更详细执行要点');
}

function appendExtraExercise(mi, exercise) {
  const plan = getPlan(state.currentPlanId, state.plans);
  if (!plan || !plan.modules?.[mi] || !exercise) return null;
  const module = plan.modules[mi];
  if (!Array.isArray(module.exercises)) module.exercises = [];
  if (!module.id) module.id = `${plan.id}__m${mi + 1}`;

  const nextIdx = module.exercises.length + 1;
  const existing = new Set(module.exercises.map(ex => ex?.id).filter(Boolean));
  let exId = `${module.id}__e${nextIdx}`;
  let counter = nextIdx;
  while (existing.has(exId)) {
    counter++;
    exId = `${module.id}__e${counter}`;
  }

  module.exercises.push({
    ...exercise,
    id: exId,
    enrichment: exercise.enrichment || null,
  });
  return editorKey(mi, module.exercises.length - 1);
}

export function openAddExerciseDialog(mi) {
  const plan = getPlan(state.currentPlanId, state.plans);
  if (!plan || !plan.modules?.[mi]) return;
  if (activeEditorKey) persistEditorByKey(activeEditorKey);

  const els = getAddExerciseDialogEls();
  if (!els.overlay) return;

  const defaults = createDefaultExercise(plan.modules[mi].type);
  pendingAddModuleIdx = mi;
  if (els.moduleName) els.moduleName.textContent = `模块：${plan.modules[mi].name}`;
  if (els.mode) els.mode.value = defaults.mode;
  if (els.name) els.name.value = defaults.name;
  if (els.sets) els.sets.value = defaults.sets;
  if (els.reps) els.reps.value = defaults.reps || '';
  if (els.duration) els.duration.value = defaults.duration || 30;
  if (els.tip) els.tip.value = defaults.tip || '';
  syncAddExerciseDialogMode(defaults.mode);

  els.overlay.classList.add('show');
  if (els.name) setTimeout(() => els.name.focus(), 0);
}

export function closeAddExerciseDialog() {
  const els = getAddExerciseDialogEls();
  if (els.overlay) els.overlay.classList.remove('show');
  pendingAddModuleIdx = null;
}

export function confirmAddExerciseDialog() {
  if (pendingAddModuleIdx === null || pendingAddModuleIdx === undefined) return;
  const plan = getPlan(state.currentPlanId, state.plans);
  if (!plan || !plan.modules?.[pendingAddModuleIdx]) return;

  const els = getAddExerciseDialogEls();
  const mode = els.mode && els.mode.value === 'timed' ? 'timed' : 'counted';
  const name = (els.name?.value || '').trim() || (mode === 'timed' ? '新计时动作' : '新计数动作');
  const sets = asPositiveInt(els.sets?.value, 1);
  const tip = (els.tip?.value || '').trim();

  const exercise = mode === 'timed'
    ? {
      name,
      mode: 'timed',
      sets,
      duration: asPositiveInt(els.duration?.value, 30),
      tip: tip || '例如：保持稳定呼吸，不要耸肩。',
    }
    : {
      name,
      mode: 'counted',
      sets,
      reps: (els.reps?.value || '').trim() || '12次',
      tip: tip || '例如：动作全程匀速，核心保持收紧。',
    };

  const key = appendExtraExercise(pendingAddModuleIdx, exercise);
  if (!key) return;
  activeEditorKey = key;
  saveToStorage();
  closeAddExerciseDialog();
  renderDetail();
  showToast('➕ 已新增动作');
}

export function flushDetailEditorChanges() {
  if (activeEditorKey) persistEditorByKey(activeEditorKey);
  enrichingKey = null;
  closeAddExerciseDialog();
  activeEditorKey = null;
}
