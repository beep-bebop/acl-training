// 拖拽排序能力（基于 SortableJS，支持触摸）

let sortableLoader = null;
let librarySorters = [];
let detailSorter = null;
let libraryMountToken = 0;
let detailMountToken = 0;
const LONG_PRESS_DELAY = 220;
const TOUCH_THRESHOLD = 4;
const FALLBACK_TOLERANCE = 6;

async function loadSortable() {
  if (!sortableLoader) {
    sortableLoader = import('https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/+esm')
      .then(m => m.default)
      .catch((err) => {
        sortableLoader = null;
        throw err;
      });
  }
  return sortableLoader;
}

function destroyLibrarySorters() {
  librarySorters.forEach((sortable) => {
    try { sortable.destroy(); } catch (_err) {}
  });
  librarySorters = [];
}

function destroyDetailSorter() {
  if (!detailSorter) return;
  try { detailSorter.destroy(); } catch (_err) {}
  detailSorter = null;
}

export async function mountLibrarySorters({
  enabled,
  onReorderGroups,
  onReorderPlans,
}) {
  libraryMountToken += 1;
  const token = libraryMountToken;
  destroyLibrarySorters();
  if (!enabled) return;

  let Sortable;
  try {
    Sortable = await loadSortable();
  } catch (_err) {
    return;
  }
  if (token !== libraryMountToken || !Sortable) return;

  const groupList = document.getElementById('libraryGroupList');
  if (groupList) {
    const instance = Sortable.create(groupList, {
      animation: 170,
      handle: '.stage-toggle-btn',
      draggable: '.stage-section',
      ghostClass: 'drag-ghost',
      chosenClass: 'drag-chosen',
      dragClass: 'drag-dragging',
      filter: '.group-settings-btn',
      preventOnFilter: false,
      delay: LONG_PRESS_DELAY,
      delayOnTouchOnly: false,
      touchStartThreshold: TOUCH_THRESHOLD,
      fallbackTolerance: FALLBACK_TOLERANCE,
      forceFallback: true,
      fallbackOnBody: true,
      onEnd(evt) {
        if (evt.oldIndex === undefined || evt.newIndex === undefined) return;
        if (evt.oldIndex === evt.newIndex) return;
        onReorderGroups?.(evt.oldIndex, evt.newIndex);
      },
    });
    librarySorters.push(instance);
  }

  document.querySelectorAll('[data-group-plans-list]').forEach((planListEl) => {
    const instance = Sortable.create(planListEl, {
      group: 'acl-plan-groups',
      animation: 170,
      handle: '.plan-card-main',
      draggable: '.plan-card.manage',
      ghostClass: 'drag-ghost',
      chosenClass: 'drag-chosen',
      dragClass: 'drag-dragging',
      delay: LONG_PRESS_DELAY,
      delayOnTouchOnly: false,
      touchStartThreshold: TOUCH_THRESHOLD,
      fallbackTolerance: FALLBACK_TOLERANCE,
      forceFallback: true,
      fallbackOnBody: true,
      onEnd(evt) {
        if (evt.oldIndex === undefined || evt.newIndex === undefined) return;
        if (evt.oldIndex === evt.newIndex && evt.from === evt.to) return;
        const fromGroup = evt.from?.dataset?.groupPlansList || '';
        const toGroup = evt.to?.dataset?.groupPlansList || '';
        onReorderPlans?.(fromGroup, toGroup, evt.oldIndex, evt.newIndex);
      },
    });
    librarySorters.push(instance);
  });
}

export async function mountDetailModuleSorter({ enabled, onReorder }) {
  detailMountToken += 1;
  const token = detailMountToken;
  destroyDetailSorter();
  if (!enabled) return;

  let Sortable;
  try {
    Sortable = await loadSortable();
  } catch (_err) {
    return;
  }
  if (token !== detailMountToken || !Sortable) return;

  const moduleList = document.getElementById('detailModuleList');
  if (!moduleList) return;

  detailSorter = Sortable.create(moduleList, {
    animation: 170,
    handle: '.detail-module-head',
    draggable: '.detail-module',
    ghostClass: 'drag-ghost',
    chosenClass: 'drag-chosen',
    dragClass: 'drag-dragging',
    filter: '.detail-module-delete-btn',
    preventOnFilter: false,
    delay: LONG_PRESS_DELAY,
    delayOnTouchOnly: false,
    touchStartThreshold: TOUCH_THRESHOLD,
    fallbackTolerance: FALLBACK_TOLERANCE,
    forceFallback: true,
    fallbackOnBody: true,
    onEnd(evt) {
      if (evt.oldIndex === undefined || evt.newIndex === undefined) return;
      if (evt.oldIndex === evt.newIndex) return;
      onReorder?.(evt.oldIndex, evt.newIndex);
    },
  });
}
