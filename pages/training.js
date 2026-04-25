// 训练页面
import { state } from '../core/state.js';
import { STAGES } from '../data/config.js';
import { saveToStorage } from '../core/storage.js';
import {
  todayStr, exKey, getStage, getPlan, getExercise,
  getModuleExercises,
  getSetsDisplay, getSetCount, isTimedMode, getDuration,
  getExerciseRest, isSetDone, isExerciseDone,
  getPlanProgress, isModuleActive, isModuleDone, getPlanGroupByPlanId,
  showToast
} from '../utils/helpers.js';
import { showTimerPill } from '../services/timer.js';
import { logCalendar } from '../services/calendar.js';

let trainingDurationTicker = null;

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeClassToken(value = '') {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '');
}

function formatElapsed(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

function updateTrainingDurationDisplay() {
  const el = document.getElementById('trainingElapsedValue');
  if (!el || !state.runtime.trainingSessionStartAt) return;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - state.runtime.trainingSessionStartAt) / 1000));
  el.textContent = formatElapsed(elapsedSeconds);
}

function startTrainingDurationTicker() {
  stopTrainingDurationTicker();
  updateTrainingDurationDisplay();
  trainingDurationTicker = setInterval(() => {
    if (state.currentPage !== 'pageTraining') return;
    updateTrainingDurationDisplay();
  }, 1000);
}

export function stopTrainingDurationTicker() {
  if (trainingDurationTicker) {
    clearInterval(trainingDurationTicker);
    trainingDurationTicker = null;
  }
}

export function startTraining(planId) {
  state.currentPlanId = planId;
  state.runtime.trainingSessionStartAt = Date.now();
  const today = todayStr();
  if (state.runtime.trainingDate !== today) {
    state.runtime.progress = {};
    state.runtime.trainingDate = today;
    saveToStorage();
  }
  return planId;
}

export function renderTraining() {
  const container = document.getElementById('trainingContent');
  if (!container) return;
  const plan = getPlan(state.currentPlanId, state.plans);
  if (!plan) {
    stopTrainingDurationTicker();
    container.innerHTML = `
      <div style="margin:14px 8px;padding:14px;border-radius:16px;background:var(--glass-heavy);border:1px solid var(--glass-border);">
        <div style="font-weight:700;">当前计划不可用</div>
        <div style="font-size:13px;color:var(--text3);margin-top:6px;">可能已被替换或删除，请返回计划库重新选择。</div>
      </div>`;
    return;
  }
  const stage = getPlanGroupByPlanId(plan.id, state.catalog, STAGES) || getStage(plan.stage, STAGES);
  const prog = getPlanProgress(state.currentPlanId, state.plans, {}, state.runtime.progress);
  const pct = prog.total > 0 ? Math.round(prog.done / prog.total * 100) : 0;
  const elapsedSeconds = state.runtime.trainingSessionStartAt
    ? Math.max(0, Math.floor((Date.now() - state.runtime.trainingSessionStartAt) / 1000))
    : 0;
  const safePlanIcon = escapeHtml(plan.icon || '•');
  const safePlanName = escapeHtml(plan.name);
  const safeStageSubtitle = escapeHtml(stage.subtitle || stage.name || '');
  const encodedPlanId = encodeURIComponent(state.currentPlanId || '');

  let html = '<div class="training-header">';
  html += '<div class="training-top-row">';
  html += `<div class="training-plan-main"><span class="training-plan-title">${safePlanIcon} ${safePlanName}</span>`;
  html += `<span class="training-stage-subtitle">${safeStageSubtitle}</span></div>`;
  html += `<div class="training-progress-num">${pct}%</div></div>`;
  html += '<div class="training-meta-row">';
  html += `<div class="training-elapsed"><span class="dot"></span><span class="label">总时长</span>`;
  html += `<span class="value" id="trainingElapsedValue">${formatElapsed(elapsedSeconds)}</span></div>`;
  html += `<div class="training-count-mini">${prog.done}/${prog.total} 完成</div></div>`;
  html += `<div class="training-progress-bar"><div class="training-progress-fill" style="width:${pct}%"></div></div>`;
  html += `<div class="training-progress-text">${prog.done} / ${prog.total} 个动作完成</div></div>`;

  // 找活跃模块
  let activeModuleIdx = -1;
  for (let mi = 0; mi < plan.modules.length; mi++) {
    if (isModuleActive(state.currentPlanId, mi, state.plans, {}, state.runtime.progress)) { activeModuleIdx = mi; break; }
  }
  if (activeModuleIdx === -1) {
    for (let mi = 0; mi < plan.modules.length; mi++) {
      if (!isModuleDone(state.currentPlanId, mi, state.plans, {}, state.runtime.progress)) { activeModuleIdx = mi; break; }
    }
  }

  plan.modules.forEach((mod, mi) => {
    const moduleExercises = getModuleExercises(state.currentPlanId, mi, state.plans, {});
    let modDone = 0;
    moduleExercises.forEach((_, ei) => {
      if (isExerciseDone(state.currentPlanId, mi, ei, state.plans, {}, state.runtime.progress)) modDone++;
    });
    const safeModIcon = escapeHtml(mod.icon || '•');
    const safeModName = escapeHtml(mod.name);
    const safeModType = sanitizeClassToken(mod.type || 'custom');
    html += `<div class="training-module${mi === activeModuleIdx ? ' open' : ''}">`;
    html += '<div class="training-module-head" data-toggle-module>';
    html += `<div class="training-module-icon ${safeModType}">${safeModIcon}</div>`;
    html += `<div class="training-module-info"><div class="training-module-name">${safeModName}</div>`;
    html += `<div class="training-module-progress">${modDone}/${moduleExercises.length} 完成</div></div>`;
    html += `<div class="training-module-arrow">▶</div></div>`;
    html += `<div class="training-module-body"><div class="training-module-inner" data-module-inner="${mi}"></div></div></div>`;
  });

  // 重绘前先清理旧的内联计时器，避免 interval 残留
  container.querySelectorAll('[data-inline-timer]').forEach((el) => {
    if (el._interval) {
      clearInterval(el._interval);
      el._interval = null;
    }
  });
  container.innerHTML = html;

  // 渲染动作
  plan.modules.forEach((mod, mi) => {
    const moduleExercises = getModuleExercises(state.currentPlanId, mi, state.plans, {});
    const inner = container.querySelector(`[data-module-inner="${mi}"]`);
    if (!inner) return;

    moduleExercises.forEach((_ex, ei) => {
      const actualEx = getExercise(state.currentPlanId, mi, ei, state.plans, {});
      if (!actualEx) return;
      const done = isExerciseDone(state.currentPlanId, mi, ei, state.plans, {}, state.runtime.progress);
      const totalSets = getSetCount(actualEx);
      const key = exKey(state.currentPlanId, mi, ei, state.plans, {});
      const keyToken = encodeURIComponent(key);
      const restSecs = getExerciseRest(state.currentPlanId, mi, ei, state.runtime.exerciseRest, state.plans, {});
      const isTimed = isTimedMode(actualEx);
      const setsStr = getSetsDisplay(actualEx);
      const safeExName = escapeHtml(actualEx.name || '');
      const safeSetsStr = escapeHtml(setsStr || '');
      const safeTip = escapeHtml(actualEx.tip || '');

      let doneSets = 0;
      for (let s = 0; s < totalSets; s++) {
        if (isSetDone(state.currentPlanId, mi, ei, s, state.runtime.progress, state.plans, {})) doneSets++;
      }

      let nextSet = -1;
      for (let s = 0; s < totalSets; s++) {
        if (!isSetDone(state.currentPlanId, mi, ei, s, state.runtime.progress, state.plans, {})) { nextSet = s; break; }
      }

      // 组按钮
      let setHtml = '';
      if (totalSets > 1 || doneSets > 0) {
        setHtml = '<div class="ex-sets-row">';
        for (let s = 0; s < totalSets; s++) {
          const sd = isSetDone(state.currentPlanId, mi, ei, s, state.runtime.progress, state.plans, {});
          const isNext = s === nextSet && !done;
          setHtml += `<button class="set-btn${sd ? ' done' : ''}${isNext ? ' next' : ''}" data-toggle-set="${encodedPlanId}|${mi}|${ei}|${s}">第${s + 1}组${sd ? ' ✓' : ''}</button>`;
        }
        setHtml += '</div>';
      } else {
        setHtml = `<div class="ex-sets-row"><button class="set-btn${done ? ' done' : ' next'}" data-toggle-set="${encodedPlanId}|${mi}|${ei}|0">${done ? '✓ 已完成' : '点击完成'}</button></div>`;
      }

      // 计时
      let timerHtml = '';
      if (isTimed) {
        const secs = getDuration(actualEx);
        timerHtml = `<div class="inline-timer">`;
        timerHtml += `<div class="it-circle" data-inline-timer data-state="idle" data-secs="${secs}">${secs}</div>`;
        timerHtml += '<span class="it-label">点击计时</span></div>';
      }

      // 休息预设
      const restPresets = [45, 60, 90, 120];
      let restHtml = '<div class="rest-setting"><div class="rest-label">⏱ 组间休息时长</div><div class="rest-presets">';
      restPresets.forEach(s => {
        const label = s >= 60 ? `${s / 60}分钟` : `${s}秒`;
        restHtml += `<button class="${s === restSecs ? 'active' : ''}" data-set-rest="${encodedPlanId}|${mi}|${ei}|${s}">${label}</button>`;
      });
      restHtml += '</div></div>';

      const exEl = document.createElement('div');
      exEl.className = 'exercise' + (done ? ' done' : '');
      exEl.innerHTML = `
        <div class="ex-header">
          <div class="ex-name">${safeExName}</div>
          <button class="ex-detail-btn" data-toggle-detail="${keyToken}">📋详情 <span class="arrow">▶</span></button>
        </div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px;">${safeSetsStr}${totalSets > 1 ? ' · 已完成 ' + doneSets + '/' + totalSets + ' 组' : ''}</div>
        ${setHtml}${timerHtml}
        <div class="ex-detail" id="detail_${keyToken}">
          <div class="ex-detail-inner">
            <div class="tip-head-row">
              <div class="tip-label">📋 执行要点（训练中可直接编辑）</div>
              <button class="tip-save-btn" data-save-tip="${encodedPlanId}|${mi}|${ei}" type="button">保存</button>
            </div>
            <textarea class="tip-edit-input" data-tip-input="${encodedPlanId}|${mi}|${ei}" placeholder="例如：膝盖保持对齐第二脚趾，避免内扣。">${safeTip}</textarea>
            ${totalSets > 1 ? restHtml : ''}
          </div>
        </div>`;
      inner.appendChild(exEl);
    });
  });

  startTrainingDurationTicker();
}

export function toggleSet(planId, mi, ei, setIdx) {
  const key = exKey(planId, mi, ei, state.plans, {});
  const setKey = `${key}_s${setIdx}`;
  const ex = getExercise(planId, mi, ei, state.plans, {});
  const totalSets = getSetCount(ex);

  if (isSetDone(planId, mi, ei, setIdx, state.runtime.progress, state.plans, {})) {
    delete state.runtime.progress[setKey];
  } else {
    state.runtime.progress[setKey] = true;
    let doneCount = 0;
    for (let s = 0; s < totalSets; s++) {
      if (isSetDone(planId, mi, ei, s, state.runtime.progress, state.plans, {})) doneCount++;
    }
    if (doneCount >= totalSets) {
      showToast('✅ 所有组完成！');
      logCalendar(planId, ex.name, ex.id, false);
    } else {
      const restSecs = getExerciseRest(planId, mi, ei, state.runtime.exerciseRest, state.plans, {});
      showTimerPill(doneCount, restSecs);
    }
  }
  saveToStorage();
  renderTraining();
}

export function setExerciseRest(planId, mi, ei, secs) {
  state.runtime.exerciseRest[exKey(planId, mi, ei, state.plans, {})] = secs;
  saveToStorage();
  renderTraining();
}

export function saveExerciseTip(planId, mi, ei, tipText, silent = false) {
  if (!planId) return;
  const ex = getExercise(planId, mi, ei, state.plans, {});
  if (!ex) return;
  const normalizedTip = String(tipText ?? '').replace(/\r\n/g, '\n').trim();
  ex.tip = normalizedTip;

  saveToStorage();
  if (!silent) showToast('📝 执行要点已保存');
}
