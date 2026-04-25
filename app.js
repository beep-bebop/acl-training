// ACL 康复训练 - 入口模块（导航 + 事件委托 + 初始化）
import { state } from './core/state.js';
import { loadState } from './services/plans.js';
import {
  renderLibrary, toggleLibraryStage, togglePlanGroupSettings,
  addPlanGroup, removePlanGroup, updatePlanGroupName,
  setPlanGroupRandomArt,
  addPlanToGroup, removePlanById, updatePlanName, setPlanEmoji, decodeLibraryToken
} from './pages/library.js';
import {
  openPlanDetail, renderDetail, toggleDetailEditor,
  saveDetailEditor, openAddExerciseDialog, closeAddExerciseDialog,
  confirmAddExerciseDialog, syncAddExerciseDialogMode, enrichDetailWithModel, flushDetailEditorChanges,
  openModuleDialog, closeModuleDialog, confirmModuleDialog, pickModuleDialogEmoji, removeDetailModule,
  editModuleName, editModuleEmoji
} from './pages/detail.js';
import {
  startTraining, renderTraining, toggleSet, setExerciseRest, stopTrainingDurationTicker,
  openTrainingTipEditor, handleTrainingTipEditorInput, closeTrainingTipEditor, saveTrainingTipEditor
} from './pages/training.js';
import { toggleInlineTimer } from './components/inline-timer.js';
import { renderCalendar, calPrev, calNext, showDayDetail } from './pages/calendar-page.js';
import {
  resetAllData, resetPlansToDefault, copySchemaTemplate, exportPlans,
  saveAiConfig, clearAiApiKey, hydrateAiConfigInputs, previewRemoteSync, applyRemoteSync
} from './pages/settings.js';
import { showImportDialog, closeImportDialog, previewImport, confirmImport } from './components/import-dialog.js';
import {
  skipTimer, cancelTimer, pauseTimer,
  startRestWithDuration, closeTimerManual
} from './services/timer.js';

// ===== 页面导航 =====
function navigateTo(pageId) {
  if (state.currentPage === 'pageDetail' && pageId !== 'pageDetail') {
    flushDetailEditorChanges();
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  if (pageId !== 'pageTraining') stopTrainingDurationTicker();
  state.currentPage = pageId;

  const navBack = document.getElementById('navBack');
  const navTitle = document.getElementById('navTitle');
  const navAction = document.getElementById('navAction');
  const bottomBar = document.getElementById('bottomBar');
  const topNav = document.querySelector('.top-nav');
  const content = document.querySelector('.content');

  switch (pageId) {
    case 'pageLibrary':
      navBack.classList.add('hidden'); navTitle.textContent = 'ACL 康复训练';
      navAction.classList.add('hidden'); bottomBar.classList.remove('hidden');
      if (topNav) topNav.classList.add('nav-hidden');
      if (content) content.classList.add('no-top-nav');
      state.isEditMode = false; break;
    case 'pageDetail':
      navBack.classList.remove('hidden'); navAction.classList.add('hidden');
      if (topNav) topNav.classList.remove('nav-hidden');
      if (content) content.classList.remove('no-top-nav');
      bottomBar.classList.add('hidden'); break;
    case 'pageTraining':
      navBack.classList.remove('hidden'); navAction.classList.add('hidden');
      if (topNav) topNav.classList.remove('nav-hidden');
      if (content) content.classList.remove('no-top-nav');
      navTitle.textContent = '训练中'; bottomBar.classList.add('hidden'); break;
    case 'pageCalendar':
      navBack.classList.add('hidden'); navTitle.textContent = '训练日历';
      if (topNav) topNav.classList.remove('nav-hidden');
      if (content) content.classList.remove('no-top-nav');
      navAction.classList.add('hidden'); bottomBar.classList.remove('hidden'); break;
    case 'pageSettings':
      navBack.classList.add('hidden'); navTitle.textContent = '设置';
      if (topNav) topNav.classList.remove('nav-hidden');
      if (content) content.classList.remove('no-top-nav');
      hydrateAiConfigInputs();
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

  // 底部 Tab
  document.getElementById('bottomBar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (btn) switchTab(btn.dataset.page);
  });

  // 计划库 - 点击计划卡片
  document.getElementById('libraryContent').addEventListener('click', (e) => {
    const toggleGroupSettings = e.target.closest('[data-toggle-group-settings]');
    if (toggleGroupSettings) {
      togglePlanGroupSettings(toggleGroupSettings.dataset.toggleGroupSettings || '');
      return;
    }

    const addGroupBtn = e.target.closest('[data-add-group]');
    if (addGroupBtn) {
      addPlanGroup();
      return;
    }

    const addPlanBtn = e.target.closest('[data-add-plan]');
    if (addPlanBtn) {
      addPlanToGroup(addPlanBtn.dataset.addPlan || '');
      return;
    }

    const delGroupBtn = e.target.closest('[data-delete-group]');
    if (delGroupBtn) {
      removePlanGroup(delGroupBtn.dataset.deleteGroup || '');
      return;
    }

    const groupArtBtn = e.target.closest('[data-group-random-art]');
    if (groupArtBtn) {
      setPlanGroupRandomArt(groupArtBtn.dataset.groupRandomArt || '');
      return;
    }

    const planEmojiBtn = e.target.closest('[data-plan-emoji]');
    if (planEmojiBtn) {
      const [planToken, emojiToken] = planEmojiBtn.dataset.planEmoji.split('|');
      setPlanEmoji(planToken, decodeLibraryToken(emojiToken));
      return;
    }

    const delPlanBtn = e.target.closest('[data-delete-plan]');
    if (delPlanBtn) {
      removePlanById(delPlanBtn.dataset.deletePlan || '');
      return;
    }

    const stageToggle = e.target.closest('[data-toggle-stage]');
    if (stageToggle) {
      toggleLibraryStage(stageToggle.dataset.toggleStage || '');
      return;
    }

    if (e.target.closest('.plan-manage-panel')) return;

    const card = e.target.closest('[data-plan-id]');
    if (card) {
      const planId = openPlanDetail(card.dataset.planId);
      navigateTo('pageDetail');
      renderDetail();
    }
  });

  document.getElementById('libraryContent').addEventListener('change', async (e) => {
    const groupNameInput = e.target.closest('[data-group-name-input]');
    if (groupNameInput) {
      updatePlanGroupName(groupNameInput.dataset.groupNameInput || '', groupNameInput.value);
      return;
    }

    const planNameInput = e.target.closest('[data-plan-name-input]');
    if (planNameInput) {
      updatePlanName(planNameInput.dataset.planNameInput || '', planNameInput.value);
      return;
    }
  });

  // 计划详情 - 开始训练按钮
  document.getElementById('detailContent').addEventListener('click', (e) => {
    const editOpen = e.target.closest('[data-edit-open]');
    if (editOpen) {
      const [mi, ei] = editOpen.dataset.editOpen.split('|');
      toggleDetailEditor(parseInt(mi, 10), parseInt(ei, 10));
      return;
    }

    const editSave = e.target.closest('[data-edit-save]');
    if (editSave) {
      const [mi, ei] = editSave.dataset.editSave.split('|');
      saveDetailEditor(parseInt(mi, 10), parseInt(ei, 10));
      return;
    }

    const enrichBtn = e.target.closest('[data-ai-enrich]');
    if (enrichBtn) {
      const [mi, ei] = enrichBtn.dataset.aiEnrich.split('|');
      enrichDetailWithModel(parseInt(mi, 10), parseInt(ei, 10));
      return;
    }

    const addEx = e.target.closest('[data-add-ex]');
    if (addEx) {
      openAddExerciseDialog(parseInt(addEx.dataset.addEx, 10));
      return;
    }

    const addModule = e.target.closest('[data-add-module]');
    if (addModule) {
      openModuleDialog();
      return;
    }

    const moduleNameBtn = e.target.closest('[data-module-edit-name]');
    if (moduleNameBtn) {
      editModuleName(parseInt(moduleNameBtn.dataset.moduleEditName, 10));
      return;
    }

    const moduleEmojiBtn = e.target.closest('[data-module-edit-emoji]');
    if (moduleEmojiBtn) {
      editModuleEmoji(parseInt(moduleEmojiBtn.dataset.moduleEditEmoji, 10));
      return;
    }

    const delModule = e.target.closest('[data-del-module]');
    if (delModule) {
      removeDetailModule(parseInt(delModule.dataset.delModule, 10));
      return;
    }

    const btn = e.target.closest('[data-start-training]');
    if (btn) {
      flushDetailEditorChanges();
      startTraining(decodeURIComponent(btn.dataset.startTraining || ''));
      navigateTo('pageTraining');
      renderTraining();
    }
  });

  document.getElementById('addExerciseOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'addExerciseOverlay') { closeAddExerciseDialog(); return; }
    if (e.target.closest('[data-add-ex-cancel]')) { closeAddExerciseDialog(); return; }
    if (e.target.closest('[data-add-ex-confirm]')) { confirmAddExerciseDialog(); }
  });

  document.getElementById('moduleEditorOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'moduleEditorOverlay') { closeModuleDialog(); return; }
    if (e.target.closest('[data-module-cancel]')) { closeModuleDialog(); return; }
    if (e.target.closest('[data-module-confirm]')) { confirmModuleDialog(); return; }
    const emojiBtn = e.target.closest('[data-module-emoji]');
    if (emojiBtn) {
      pickModuleDialogEmoji(decodeURIComponent(emojiBtn.dataset.moduleEmoji || ''));
    }
  });

  document.getElementById('moduleEditorOverlay').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      confirmModuleDialog();
    }
  });

  document.getElementById('tipEditorOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'tipEditorOverlay') { closeTrainingTipEditor(); return; }
    if (e.target.closest('[data-tip-editor-cancel]')) { closeTrainingTipEditor(); return; }
    if (e.target.closest('[data-tip-editor-save]')) { saveTrainingTipEditor(); }
  });

  document.getElementById('tipEditorInput').addEventListener('input', () => {
    handleTrainingTipEditorInput();
  });

  document.getElementById('tipEditorInput').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeTrainingTipEditor();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveTrainingTipEditor();
    }
  });

  // 计划详情 - 动作类型切换时，动态切换编辑字段
  document.getElementById('detailContent').addEventListener('change', (e) => {
    const modeSelect = e.target.closest('[data-edit-field="mode"]');
    if (!modeSelect) return;
    const item = modeSelect.closest('.detail-ex-item');
    if (!item) return;
    const mode = modeSelect.value === 'timed' ? 'timed' : 'counted';
    item.querySelectorAll('[data-mode-panel]').forEach(panel => {
      panel.classList.toggle('hidden', panel.dataset.modePanel !== mode);
    });
  });

  document.getElementById('addExerciseOverlay').addEventListener('change', (e) => {
    const modeSelect = e.target.closest('[data-add-ex-mode]');
    if (!modeSelect) return;
    syncAddExerciseDialogMode(modeSelect.value);
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
      const [planIdRaw, mi, ei, si] = setBtn.dataset.toggleSet.split('|');
      const planId = decodeURIComponent(planIdRaw || '');
      toggleSet(planId, parseInt(mi), parseInt(ei), parseInt(si));
      return;
    }

    // 详情展开
    const detailBtn = e.target.closest('[data-toggle-detail]');
    if (detailBtn) {
      const key = detailBtn.dataset.toggleDetail;
      const el = document.getElementById('detail_' + key);
      if (el) el.classList.toggle('open');
      detailBtn.classList.toggle('open');
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
      const [planIdRaw, mi, ei, secs] = restBtn.dataset.setRest.split('|');
      const planId = decodeURIComponent(planIdRaw || '');
      setExerciseRest(planId, parseInt(mi), parseInt(ei), parseInt(secs));
      return;
    }

    const openTipEditorBtn = e.target.closest('[data-open-tip-editor]');
    if (openTipEditorBtn) {
      const [planIdRaw, mi, ei] = openTipEditorBtn.dataset.openTipEditor.split('|');
      const planId = decodeURIComponent(planIdRaw || '');
      openTrainingTipEditor(planId, parseInt(mi, 10), parseInt(ei, 10));
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
    if (e.target.closest('[data-preview-remote-sync]')) previewRemoteSync();
    if (e.target.closest('[data-apply-remote-sync]')) applyRemoteSync();
    if (e.target.closest('[data-copy-schema]')) copySchemaTemplate();
    if (e.target.closest('[data-save-ai-config]')) saveAiConfig();
    if (e.target.closest('[data-clear-ai-key]')) clearAiApiKey();
  });

  // 导入对话框
  document.getElementById('importOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'importOverlay') { closeImportDialog(); return; }
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
    if (e.target.id === 'timerOverlay') { closeTimerManual(); return; }
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
  hydrateAiConfigInputs();
  setupEventDelegation();
  navigateTo('pageLibrary');
  renderLibrary();
}

document.addEventListener('DOMContentLoaded', init);
