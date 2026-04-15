// 训练页面
import { state } from '../core/state.js';
import { STAGES } from '../data/config.js';
import { saveToStorage } from '../core/storage.js';
import {
  todayStr, exKey, getStage, getPlan, getExercise,
  getSetsDisplay, getSetCount, isTimedMode, getDuration,
  getExerciseRest, isSetDone, isExerciseDone,
  getPlanProgress, isModuleActive, isModuleDone,
  showToast, alertFinish
} from '../utils/helpers.js';
import { showTimerPill } from '../services/timer.js';
import { toggleInlineTimer } from '../components/inline-timer.js';

export function startTraining(planId) {
  state.currentPlanId = planId;
  const today = todayStr();
  if (state.trainingDate !== today) {
    state.trainingProgress = {};
    state.trainingDate = today;
    saveToStorage();
  }
  return planId;
}

export function renderTraining() {
  const plan = getPlan(state.currentPlanId, state.plans);
  if (!plan) return;
  const stage = getStage(plan.stage, STAGES);
  const container = document.getElementById('trainingContent');
  const prog = getPlanProgress(state.currentPlanId, state.plans, state.userEdits, state.trainingProgress);
  const pct = prog.total > 0 ? Math.round(prog.done / prog.total * 100) : 0;

  let html = '<div class="training-header">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;">';
  html += `<div><span style="font-size:20px;font-weight:800;">${plan.icon} ${plan.name}</span>`;
  html += `<span style="font-size:12px;color:var(--text3);margin-left:8px;">${stage.subtitle}</span></div>`;
  html += `<div style="font-size:24px;font-weight:800;color:var(--primary);">${pct}%</div></div>`;
  html += `<div class="training-progress-bar"><div class="training-progress-fill" style="width:${pct}%"></div></div>`;
  html += `<div class="training-progress-text">${prog.done} / ${prog.total} 个动作完成</div></div>`;

  // 找活跃模块
  let activeModuleIdx = -1;
  for (let mi = 0; mi < plan.modules.length; mi++) {
    if (isModuleActive(state.currentPlanId, mi, state.plans, state.userEdits, state.trainingProgress)) { activeModuleIdx = mi; break; }
  }
  if (activeModuleIdx === -1) {
    for (let mi = 0; mi < plan.modules.length; mi++) {
      if (!isModuleDone(state.currentPlanId, mi, state.plans, state.userEdits, state.trainingProgress)) { activeModuleIdx = mi; break; }
    }
  }

  plan.modules.forEach((mod, mi) => {
    let modDone = 0;
    mod.exercises.forEach((_, ei) => { if (isExerciseDone(state.currentPlanId, mi, ei, state.plans, state.userEdits, state.trainingProgress)) modDone++; });
    html += `<div class="training-module${mi === activeModuleIdx ? ' open' : ''}">`;
    html += '<div class="training-module-head" data-toggle-module>';
    html += `<div class="training-module-icon ${mod.type}">${mod.icon}</div>`;
    html += `<div class="training-module-info"><div class="training-module-name">${mod.name}</div>`;
    html += `<div class="training-module-progress">${modDone}/${mod.exercises.length} 完成</div></div>`;
    html += `<div class="training-module-arrow">▶</div></div>`;
    html += `<div class="training-module-body"><div class="training-module-inner" data-module-inner="${mi}"></div></div></div>`;
  });

  container.innerHTML = html;

  // 渲染动作
  plan.modules.forEach((mod, mi) => {
    const inner = container.querySelector(`[data-module-inner="${mi}"]`);
    if (!inner) return;

    mod.exercises.forEach((ex, ei) => {
      const actualEx = getExercise(state.currentPlanId, mi, ei, state.plans, state.userEdits);
      const done = isExerciseDone(state.currentPlanId, mi, ei, state.plans, state.userEdits, state.trainingProgress);
      const totalSets = getSetCount(actualEx);
      const key = exKey(state.currentPlanId, mi, ei);
      const restSecs = getExerciseRest(state.currentPlanId, mi, ei, state.exerciseRest);
      const isTimed = isTimedMode(actualEx);
      const setsStr = getSetsDisplay(actualEx);

      let doneSets = 0;
      for (let s = 0; s < totalSets; s++) { if (isSetDone(state.currentPlanId, mi, ei, s, state.trainingProgress)) doneSets++; }

      let nextSet = -1;
      for (let s = 0; s < totalSets; s++) { if (!isSetDone(state.currentPlanId, mi, ei, s, state.trainingProgress)) { nextSet = s; break; } }

      // 组按钮
      let setHtml = '';
      if (totalSets > 1 || doneSets > 0) {
        setHtml = '<div class="ex-sets-row">';
        for (let s = 0; s < totalSets; s++) {
          const sd = isSetDone(state.currentPlanId, mi, ei, s, state.trainingProgress);
          const isNext = s === nextSet && !done;
          setHtml += `<button class="set-btn${sd ? ' done' : ''}${isNext ? ' next' : ''}" data-toggle-set="${state.currentPlanId}|${mi}|${ei}|${s}">第${s + 1}组${sd ? ' ✓' : ''}</button>`;
        }
        setHtml += '</div>';
      } else {
        setHtml = `<div class="ex-sets-row"><button class="set-btn${done ? ' done' : ' next'}" data-toggle-set="${state.currentPlanId}|${mi}|${ei}|0">${done ? '✓ 已完成' : '点击完成'}</button></div>`;
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
        restHtml += `<button class="${s === restSecs ? 'active' : ''}" data-set-rest="${state.currentPlanId}|${mi}|${ei}|${s}">${label}</button>`;
      });
      restHtml += '</div></div>';

      const exEl = document.createElement('div');
      exEl.className = 'exercise' + (done ? ' done' : '');
      exEl.innerHTML = `
        <div class="ex-header">
          <div class="ex-name">${actualEx.name}</div>
          <button class="ex-detail-btn" data-toggle-detail="${key}">📋详情 <span class="arrow">▶</span></button>
        </div>
        <div style="font-size:12px;color:var(--text3);margin-top:2px;">${setsStr}${totalSets > 1 ? ' · 已完成 ' + doneSets + '/' + totalSets + ' 组' : ''}</div>
        ${setHtml}${timerHtml}
        <div class="ex-detail" id="detail_${key}">
          <div class="ex-detail-inner">
            <div class="tip-label">📋 执行要点</div>
            <div class="tip-text">${actualEx.tip}</div>
            ${totalSets > 1 ? restHtml : ''}
          </div>
        </div>`;
      inner.appendChild(exEl);
    });
  });
}

export function toggleSet(planId, mi, ei, setIdx) {
  const key = exKey(planId, mi, ei);
  const setKey = `${key}_s${setIdx}`;
  const ex = getExercise(planId, mi, ei, state.plans, state.userEdits);
  const totalSets = getSetCount(ex);

  if (isSetDone(planId, mi, ei, setIdx, state.trainingProgress)) {
    delete state.trainingProgress[setKey];
  } else {
    state.trainingProgress[setKey] = true;
    let doneCount = 0;
    for (let s = 0; s < totalSets; s++) { if (isSetDone(planId, mi, ei, s, state.trainingProgress)) doneCount++; }
    if (doneCount >= totalSets) {
      showToast('✅ 所有组完成！');
      logCalendar(planId, ex.name);
    } else {
      const restSecs = getExerciseRest(planId, mi, ei, state.exerciseRest);
      showTimerPill(doneCount, restSecs);
    }
  }
  saveToStorage();
  renderTraining();
}

export function setExerciseRest(planId, mi, ei, secs) {
  state.exerciseRest[exKey(planId, mi, ei)] = secs;
  saveToStorage();
  renderTraining();
}

function logCalendar(planId, exName) {
  const today = todayStr();
  if (!state.calendarLogs[today]) state.calendarLogs[today] = [];
  if (!state.calendarLogs[today].find(l => l.planId === planId && l.name === exName)) {
    const plan = getPlan(planId, state.plans);
    state.calendarLogs[today].push({ planId, name: exName, planName: plan.name, time: Date.now() });
  }
  saveToStorage();
}

// 导出供事件委托使用
export { toggleInlineTimer };
