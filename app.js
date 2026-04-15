// ACL 康复训练 - 入口模块（导航 + 事件委托 + 初始化）
import { state } from './core/state.js';
import { loadState } from './services/plans.js';
import { renderLibrary } from './pages/library.js';
import { openPlanDetail, renderDetail, toggleEditMode } from './pages/detail.js';
import { startTraining, renderTraining, toggleSet, setExerciseRest } from './pages/training.js';
import { toggleInlineTimer } from './components/inline-timer.js';
import { renderCalendar, calPrev, calNext, showDayDetail } from './pages/calendar-page.js';
import { resetAllData, resetPlansToDefault, copySchemaTemplate, exportPlans } from './pages/settings.js';
import { showImportDialog, closeImportDialog, previewImport, confirmImport } from './components/import-dialog.js';
import {
  skipTimer, cancelTimer, pauseTimer,
  startRestWithDuration, openTimerManual, closeTimerManual
} from './services/timer.js';

// ===== 页面导航 =====
function navigateTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  state.currentPage = pageId;

  const navBack = document.getElementById('navBack');
  const navTitle = document.getElementById('navTitle');
  const navAction = document.getElementById('navAction');
  const bottomBar = document.getElementById('bottomBar');

  switch (pageId) {
    case 'pageLibrary':
      navBack.classList.add('hidden'); navTitle.textContent = 'ACL 康复训练';
      navAction.classList.add('hidden'); bottomBar.classList.remove('hidden');
      state.isEditMode = false; break;
    case 'pageDetail':
      navBack.classList.remove('hidden'); navAction.classList.remove('hidden');
      navAction.textContent = state.isEditMode ? '完成' : '编辑';
      bottomBar.classList.add('hidden'); break;
    case 'pageTraining':
      navBack.classList.remove('hidden'); navAction.classList.add('hidden');
      navTitle.textContent = '训练中'; bottomBar.classList.add('hidden'); break;
    case 'pageCalendar':
      navBack.classList.add('hidden'); navTitle.textContent = '训练日历';
      navAction.classList.add('hidden'); bottomBar.classList.remove('hidden'); break;
    case 'pageSettings':
      navBack.classList.add('hidden'); navTitle.textContent = '设置';
      navAction.classList.add('hidden'); bottomBar.classList.remove('hidden'); break;
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageId);
  });
}

function goBack() {
  if (state.currentPage === 'pageTraining') {
    navigateTo('pageDetail'); renderDetail();
  } else if (state.currentPage === 'pageDetail') {
    if (state.isEditMode) { state.isEditMode = false; document.getElementById('navAction').textContent = '编辑'; }
    navigateTo('pageLibrary'); renderLibrary();
  } else {
    navigateTo('pageLibrary'); renderLibrary();
  }
}

function switchTab(pageId) {
  navigateTo(pageId);
  if (pageId === 'pageLibrary') renderLibrary();
  if (pageId === 'pageCalendar') renderCalendar();
}

// ===== 全局事件委托 =====
function setupEventDelegation() {
  // 导航
  document.getElementById('navBack').addEventListener('click', goBack);
  document.getElementById('navAction').addEventListener('click', () => {
    if (state.currentPage === 'pageDetail') toggleEditMode();
  });

  // 底部 Tab
  document.getElementById('bottomBar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (btn) switchTab(btn.dataset.page);
  });

  // 计划库 - 点击计划卡片
  document.getElementById('libraryContent').addEventListener('click', (e) => {
    const card = e.target.closest('[data-plan-id]');
    if (card) {
      const planId = openPlanDetail(card.dataset.planId);
      navigateTo('pageDetail');
      renderDetail();
    }
  });

  // 计划详情 - 开始训练按钮
  document.getElementById('detailContent').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-start-training]');
    if (btn) {
      startTraining(btn.dataset.startTraining);
      navigateTo('pageTraining');
      renderTraining();
    }
  });

  // 训练页面 - 模块折叠
  document.getElementById('trainingContent').addEventListener('click', (e) => {
    // 模块折叠
    const modHead = e.target.closest('[data-toggle-module]');
    if (modHead) {
      modHead.parentElement.classList.toggle('open');
      return;
    }

    // 组按钮
    const setBtn = e.target.closest('[data-toggle-set]');
    if (setBtn) {
      const [planId, mi, ei, si] = setBtn.dataset.toggleSet.split('|');
      toggleSet(planId, parseInt(mi), parseInt(ei), parseInt(si));
      return;
    }

    // 详情展开
    const detailBtn = e.target.closest('[data-toggle-detail]');
    if (detailBtn) {
      const key = detailBtn.dataset.toggleDetail;
      const el = document.getElementById('detail_' + key);
      if (el) el.classList.toggle('open');
      if (detailBtn) detailBtn.classList.toggle('open');
      return;
    }

    // 内联计时器
    const timerEl = e.target.closest('[data-inline-timer]');
    if (timerEl) {
      toggleInlineTimer(timerEl);
      return;
    }

    // 休息时长设置
    const restBtn = e.target.closest('[data-set-rest]');
    if (restBtn) {
      const [planId, mi, ei, secs] = restBtn.dataset.setRest.split('|');
      setExerciseRest(planId, parseInt(mi), parseInt(ei), parseInt(secs));
      return;
    }
  });

  // 日历
  document.getElementById('calendarContent').addEventListener('click', (e) => {
    if (e.target.closest('[data-cal-prev]')) { calPrev(); return; }
    if (e.target.closest('[data-cal-next]')) { calNext(); return; }
    const dayEl = e.target.closest('[data-cal-day]');
    if (dayEl) { showDayDetail(dayEl.dataset.calDay); }
  });

  // 设置页
  document.getElementById('pageSettings').addEventListener('click', (e) => {
    if (e.target.closest('[data-reset-all]')) resetAllData();
    if (e.target.closest('[data-reset-defaults]')) resetPlansToDefault();
    if (e.target.closest('[data-import]')) showImportDialog();
    if (e.target.closest('[data-export]')) exportPlans();
    if (e.target.closest('[data-copy-schema]')) copySchemaTemplate();
  });

  // 导入对话框
  document.getElementById('importOverlay').addEventListener('click', (e) => {
    if (e.target.closest('[data-import-close]')) closeImportDialog();
    if (e.target.closest('[data-import-preview]')) previewImport();
    if (e.target.closest('[data-import-confirm]')) confirmImport();
  });

  // 计时器面板
  document.getElementById('timerPill').addEventListener('click', (e) => {
    if (e.target.closest('[data-timer-skip]')) skipTimer();
    if (e.target.closest('[data-timer-cancel]')) cancelTimer();
    if (e.target.closest('[data-timer-pause]')) pauseTimer();
  });

  document.getElementById('timerOverlay').addEventListener('click', (e) => {
    if (e.target.closest('[data-rest-duration]')) {
      startRestWithDuration(parseInt(e.target.closest('[data-rest-duration]').dataset.restDuration));
      return;
    }
    if (e.target.closest('[data-timer-close]')) closeTimerManual();
  });
}

// ===== 初始化 =====
async function init() {
  await loadState();
  setupEventDelegation();
  renderLibrary();

  const el = document.getElementById('planCount');
  if (el) el.textContent = state.plans.length;
}

document.addEventListener('DOMContentLoaded', init);
