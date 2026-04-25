// 工具函数

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 计划数据查询
export function getStage(stageId, STAGES) {
  const stage = STAGES.find(s => s.id === stageId);
  if (!stage) console.warn('[getStage] 未找到阶段:', stageId);
  return stage || STAGES[0];
}

export function getPlan(planId, plans) {
  const list = Array.isArray(plans) ? plans : [];
  return list.find(p => p.id === planId) || null;
}

export function getModuleExercises(planId, mi, plans, userEdits) {
  const plan = getPlan(planId, plans);
  if (!plan) return [];
  return Array.isArray(plan.modules?.[mi]?.exercises) ? plan.modules[mi].exercises : [];
}

function asPositiveInt(value, fallback = 1) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return Math.max(1, Math.floor(n));
  return fallback;
}

export function getExercise(planId, mi, ei, plans, userEdits) {
  return getModuleExercises(planId, mi, plans, userEdits)[ei] || null;
}

// 显示用组数描述
export function getSetsDisplay(ex) {
  if (ex.mode === 'timed') {
    const secsTotal = getDuration(ex);
    const mins = Math.floor(secsTotal / 60);
    const secs = secsTotal % 60;
    const single = mins > 0 && secs > 0
      ? `${mins}分${secs}秒`
      : mins > 0
        ? `${mins}分钟`
        : `${secs}秒`;
    const sets = getSetCount(ex);
    return sets > 1 ? `${sets}组 × ${single}` : single;
  }
  const sets = getSetCount(ex);
  if (sets > 1) return `${sets}\u00d7${ex.reps}`;
  return ex.reps || '';
}

function parseSetCountFromText(text) {
  if (text === undefined || text === null) return null;
  const raw = String(text).trim();
  if (!raw) return null;

  // 3×15次 / 3x15 / 3*15
  const leadingMul = raw.match(/^(\d+)\s*[×xX*]\s*\d+/);
  if (leadingMul) return Math.max(1, parseInt(leadingMul[1], 10));

  // 3组 / 3 sets
  const leadingGroupCn = raw.match(/^(\d+)\s*组/);
  if (leadingGroupCn) return Math.max(1, parseInt(leadingGroupCn[1], 10));
  const leadingGroupEn = raw.match(/^(\d+)\s*sets?\b/i);
  if (leadingGroupEn) return Math.max(1, parseInt(leadingGroupEn[1], 10));

  // "每侧3×10次" 这类前缀文字
  const embeddedMul = raw.match(/(\d+)\s*[×xX*]\s*\d+/);
  if (embeddedMul) return Math.max(1, parseInt(embeddedMul[1], 10));

  // BFR 风格：30-15-15-15 => 4 组（要求至少 3 段，避免把 8-12 当成 2 组）
  const repList = raw.match(/^\d+(?:\s*[-/、]\s*\d+){2,}$/);
  if (repList) {
    return raw.split(/[-/、]/).length;
  }

  return null;
}

// 获取实际组数
export function getSetCount(ex) {
  if (typeof ex.sets === 'number' && Number.isFinite(ex.sets) && ex.sets > 0) {
    return Math.max(1, Math.floor(ex.sets));
  }
  if (typeof ex.sets === 'string') {
    const inferredBySetText = parseSetCountFromText(ex.sets);
    if (inferredBySetText !== null) return inferredBySetText;
    const onlyNum = ex.sets.trim().match(/^(\d+)$/);
    if (onlyNum) return Math.max(1, parseInt(onlyNum[1], 10));
  }

  // 兜底：从 reps 描述提取显式组数
  const inferredByReps = parseSetCountFromText(ex.reps);
  if (inferredByReps !== null) return inferredByReps;

  return 1;
}

export function isTimedMode(ex) {
  return ex.mode === 'timed';
}

export function getDuration(ex) {
  return asPositiveInt(ex.duration, 45);
}

export function exKey(planId, mi, ei, plans = [], userEdits = {}) {
  const ex = getExercise(planId, mi, ei, plans, userEdits);
  if (ex?.id) return ex.id;
  return `${planId}_${mi}_${ei}`;
}

// 训练进度
export function isSetDone(planId, mi, ei, setIdx, trainingProgress, plans = [], userEdits = {}) {
  return !!trainingProgress[`${exKey(planId, mi, ei, plans, userEdits)}_s${setIdx}`];
}

export function isExerciseDone(planId, mi, ei, plans, userEdits, trainingProgress) {
  const ex = getExercise(planId, mi, ei, plans, userEdits);
  if (!ex) return false;
  const totalSets = getSetCount(ex);
  for (let s = 0; s < totalSets; s++) {
    if (!isSetDone(planId, mi, ei, s, trainingProgress, plans, userEdits)) return false;
  }
  return true;
}

export function getPlanProgress(planId, plans, userEdits, trainingProgress) {
  const plan = getPlan(planId, plans);
  if (!plan) return { done: 0, total: 0 };
  let done = 0, total = 0;
  plan.modules.forEach((mod, mi) => {
    const exercises = getModuleExercises(planId, mi, plans, userEdits);
    exercises.forEach((_, ei) => {
      total++;
      if (isExerciseDone(planId, mi, ei, plans, userEdits, trainingProgress)) done++;
    });
  });
  return { done, total };
}

export function isModuleActive(planId, mi, plans, userEdits, trainingProgress) {
  const exercises = getModuleExercises(planId, mi, plans, userEdits);
  if (!exercises.length) return false;
  for (let ei = 0; ei < exercises.length; ei++) {
    const ex = getExercise(planId, mi, ei, plans, userEdits);
    const totalSets = getSetCount(ex);
    if (isExerciseDone(planId, mi, ei, plans, userEdits, trainingProgress)) continue;
    for (let s = 0; s < totalSets; s++) {
      if (isSetDone(planId, mi, ei, s, trainingProgress, plans, userEdits)) return true;
    }
  }
  return false;
}

export function isModuleDone(planId, mi, plans, userEdits, trainingProgress) {
  const exercises = getModuleExercises(planId, mi, plans, userEdits);
  if (!exercises.length) return true;
  return exercises.every((_, ei) =>
    isExerciseDone(planId, mi, ei, plans, userEdits, trainingProgress)
  );
}

// 休息时长
export function getExerciseRest(planId, mi, ei, exerciseRest, plans = [], userEdits = {}) {
  return exerciseRest[exKey(planId, mi, ei, plans, userEdits)] || 60;
}

export function getPlanGroupByPlanId(planId, catalog, fallbackStages = []) {
  const groups = Array.isArray(catalog?.planGroups) ? catalog.planGroups : [];
  for (const group of groups) {
    if ((group.plans || []).some(p => p.id === planId)) return group;
  }
  const plan = getPlan(planId, flattenPlans(catalog));
  const fallback = fallbackStages.find(s => s.id === plan?.stage);
  return fallback || null;
}

export function flattenPlans(catalog) {
  const out = [];
  (catalog?.planGroups || []).forEach((group) => {
    (group.plans || []).forEach((plan) => out.push(plan));
  });
  return out;
}

export function pruneRuntimeByPlans(plans, runtime) {
  const safePlans = Array.isArray(plans) ? plans : [];
  const safeRuntime = runtime && typeof runtime === 'object' ? runtime : {};
  const planIds = new Set(safePlans.map(p => p?.id).filter(Boolean));
  const exerciseIds = new Set();
  safePlans.forEach((plan) => {
    (plan?.modules || []).forEach((mod) => {
      (mod?.exercises || []).forEach((ex) => {
        if (ex?.id) exerciseIds.add(ex.id);
      });
    });
  });

  safeRuntime.progress = Object.fromEntries(
    Object.entries(safeRuntime.progress || {}).filter(([key, value]) => {
      if (!value) return false;
      const m = String(key).match(/^(.*)_s\d+$/);
      if (!m) return false;
      return exerciseIds.has(m[1]);
    })
  );

  safeRuntime.exerciseRest = Object.fromEntries(
    Object.entries(safeRuntime.exerciseRest || {}).filter(([key]) => exerciseIds.has(key))
  );

  safeRuntime.calendarLogs = Object.fromEntries(
    Object.entries(safeRuntime.calendarLogs || {}).map(([date, logs]) => {
      const kept = (Array.isArray(logs) ? logs : []).filter((log) => {
        if (!planIds.has(log?.planId)) return false;
        if (!log?.exerciseId) return true;
        return exerciseIds.has(log.exerciseId);
      });
      return [date, kept];
    }).filter(([, logs]) => logs.length)
  );

  return safeRuntime;
}

// UI 反馈
export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

export function alertFinish() {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  const flash = document.getElementById('flashOverlay');
  flash.classList.add('flash');
  setTimeout(() => flash.classList.remove('flash'), 300);
}

// 剪贴板
export function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text)
      .then(() => true)
      .catch(() => fallbackCopy(text));
  }
  return fallbackCopy(text);
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    return true;
  } catch (e) {
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}
