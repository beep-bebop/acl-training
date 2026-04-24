// 工具函数

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function exKey(planId, mi, ei) {
  return `${planId}_${mi}_${ei}`;
}

// 计划数据查询
export function getStage(stageId, STAGES) {
  const stage = STAGES.find(s => s.id === stageId);
  if (!stage) console.warn('[getStage] 未找到阶段:', stageId);
  return stage || STAGES[0];
}

export function getPlan(planId, plans) {
  return plans.find(p => p.id === planId) || null;
}

export function getExercise(planId, mi, ei, plans, userEdits) {
  const plan = getPlan(planId, plans);
  if (!plan) return null;
  const ex = plan.modules[mi]?.exercises[ei];
  if (!ex) return null;
  const edit = userEdits[planId]?.[`${mi}_${ei}`];
  if (edit) {
    return {
      ...ex,
      name: edit.name ?? ex.name,
      tip: edit.tip ?? ex.tip,
      ...(edit.sets !== undefined ? { _editSets: edit.sets } : {}),
    };
  }
  return ex;
}

// 显示用组数描述
export function getSetsDisplay(ex) {
  if (ex._editSets !== undefined) return ex._editSets;
  if (ex.mode === 'timed') {
    const mins = Math.floor(ex.duration / 60);
    const secs = ex.duration % 60;
    if (mins > 0 && secs > 0) return `${mins}分${secs}秒`;
    if (mins > 0) return `${mins}分钟`;
    return `${secs}秒`;
  }
  if (ex.sets > 1) return `${ex.sets}\u00d7${ex.reps}`;
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
  if (ex._editSets !== undefined) {
    const inferred = parseSetCountFromText(ex._editSets);
    if (inferred !== null) return inferred;
  }

  // 优先从 reps 描述提取显式组数，兜底兼容导入计划中的“3×15次”写法
  const inferredByReps = parseSetCountFromText(ex.reps);
  if (inferredByReps !== null) return inferredByReps;

  return ex.sets || 1;
}

export function isTimedMode(ex) {
  return ex.mode === 'timed';
}

export function getDuration(ex) {
  return ex.duration || 45;
}

// 训练进度
export function isSetDone(planId, mi, ei, setIdx, trainingProgress) {
  return !!trainingProgress[`${exKey(planId, mi, ei)}_s${setIdx}`];
}

export function isExerciseDone(planId, mi, ei, plans, userEdits, trainingProgress) {
  const ex = getExercise(planId, mi, ei, plans, userEdits);
  if (!ex) return false;
  const totalSets = getSetCount(ex);
  for (let s = 0; s < totalSets; s++) {
    if (!isSetDone(planId, mi, ei, s, trainingProgress)) return false;
  }
  return true;
}

export function getPlanProgress(planId, plans, userEdits, trainingProgress) {
  const plan = getPlan(planId, plans);
  if (!plan) return { done: 0, total: 0 };
  let done = 0, total = 0;
  plan.modules.forEach((mod, mi) => {
    mod.exercises.forEach((_, ei) => {
      total++;
      if (isExerciseDone(planId, mi, ei, plans, userEdits, trainingProgress)) done++;
    });
  });
  return { done, total };
}

export function isModuleActive(planId, mi, plans, userEdits, trainingProgress) {
  const plan = getPlan(planId, plans);
  if (!plan) return false;
  for (let ei = 0; ei < plan.modules[mi].exercises.length; ei++) {
    const ex = getExercise(planId, mi, ei, plans, userEdits);
    const totalSets = getSetCount(ex);
    if (isExerciseDone(planId, mi, ei, plans, userEdits, trainingProgress)) continue;
    for (let s = 0; s < totalSets; s++) {
      if (isSetDone(planId, mi, ei, s, trainingProgress)) return true;
    }
  }
  return false;
}

export function isModuleDone(planId, mi, plans, userEdits, trainingProgress) {
  const plan = getPlan(planId, plans);
  if (!plan) return false;
  return plan.modules[mi].exercises.every((_, ei) =>
    isExerciseDone(planId, mi, ei, plans, userEdits, trainingProgress)
  );
}

// 休息时长
export function getExerciseRest(planId, mi, ei, exerciseRest) {
  return exerciseRest[exKey(planId, mi, ei)] || 60;
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
