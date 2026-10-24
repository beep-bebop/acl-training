// 渐进负荷引擎：基于最近一次训练记录 + 动作处方，给出确定性的下一步建议。
// 规则简单可解释：疼痛超上限 → 退阶；全部达标且疼痛可控 → 进阶一步；否则维持。
import { LOAD_KINDS, BAND_MAX, DEFAULT_PAIN_CEILING } from './config.js';

/**
 * 某动作最近一次训练的组记录。
 * setLogs: [{date, planId, exerciseId, setIndex, reps, duration, loadKind, loadLevel, pain}]
 */
export function lastSessionForExercise(setLogs, exerciseId, beforeDate = null) {
  const own = setLogs
    .filter((l) => l.exerciseId === exerciseId)
    .filter((l) => !beforeDate || l.date < beforeDate)
    .sort((a, b) => (a.date === b.date ? (a.time || 0) - (b.time || 0) : a.date < b.date ? -1 : 1));
  if (!own.length) return null;
  const lastDate = own[own.length - 1].date;
  return own.filter((l) => l.date === lastDate);
}

export function summarizePerformance(exercise, logs) {
  if (!logs || !logs.length) {
    return { hasHistory: false };
  }
  const painCeiling = exercise.prescription?.painCeiling ?? DEFAULT_PAIN_CEILING;
  const target = exercise.mode === 'timed' ? (exercise.duration || 0) : (exercise.reps || 0);
  const achieved = logs.filter((l) => {
    const actual = exercise.mode === 'timed' ? (l.duration || 0) : (l.reps || 0);
    return actual >= target;
  }).length;
  const pains = logs.map((l) => Number(l.pain) || 0);
  const maxPain = pains.length ? Math.max(...pains) : 0;
  const loads = logs.map((l) => Number(l.loadLevel)).filter((v) => Number.isFinite(v));
  return {
    hasHistory: true,
    lastDate: logs[0].date,
    sets: logs.length,
    targetSets: exercise.sets || 1,
    achieved,
    allHit: achieved >= (exercise.sets || 1) && achieved === logs.length,
    maxPain,
    avgPain: pains.length ? pains.reduce((a, b) => a + b, 0) / pains.length : 0,
    painCeiling,
    topLoad: loads.length ? Math.max(...loads) : null,
    summary: exercise.mode === 'timed'
      ? `${logs.length} 组 × ${target}s`
      : `${logs.length} 组 × ${target} 次`
  };
}

/**
 * 返回 null（无建议）或
 * { type:'baseline'|'maintain'|'increase'|'regress', title, detail, target:{reps?,duration?,level?} }
 */
export function suggestProgression(exercise, setLogs, beforeDate = null) {
  const logs = lastSessionForExercise(setLogs, exercise.id, beforeDate);
  const perf = summarizePerformance(exercise, logs);
  if (!perf.hasHistory) {
    return {
      type: 'baseline',
      title: '首次执行',
      detail: `按处方 ${perfSummaryText(exercise)} 开始，训练中记录负荷与疼痛作为基线`,
      target: {}
    };
  }

  const kind = exercise.load?.kind || 'none';
  const kindCfg = LOAD_KINDS[kind] || LOAD_KINDS.none;
  const lastLevel = perf.topLoad;
  const levelText = lastLevel != null && kindCfg.unit ? ` @${lastLevel}${kindCfg.unit}` : '';

  if (perf.maxPain > perf.painCeiling) {
    const target = regressTarget(exercise, kind, lastLevel);
    return {
      type: 'regress',
      title: `上次疼痛 ${perf.maxPain}/10 超过上限 ${perf.painCeiling}`,
      detail: exercise.prescription?.regression || '降低强度或换成更简单的版本，疼痛稳定后再进阶',
      target
    };
  }

  if (perf.allHit) {
    const target = progressTarget(exercise, kind, lastLevel);
    const from = `${perf.summary}${levelText}`;
    return {
      type: 'increase',
      title: '上次全部达标，可以进阶',
      detail: `${from} → ${describeTarget(exercise, target)}`,
      target
    };
  }

  return {
    type: 'maintain',
    title: '继续巩固',
    detail: `上次 ${perf.achieved}/${logs.length} 组达标${levelText}，全部达标且疼痛 ≤${perf.painCeiling} 后自动建议进阶`,
    target: {}
  };
}

function progressTarget(exercise, kind, lastLevel) {
  const cfg = LOAD_KINDS[kind] || LOAD_KINDS.none;
  const base = Number.isFinite(lastLevel) ? lastLevel : null;
  if (kind === 'none' || cfg.step === 0 || base === null) {
    // 无负荷或尚无基线：先加次数/时长
    return exercise.mode === 'timed'
      ? { duration: (exercise.duration || 30) + 15 }
      : { reps: (exercise.reps || 10) + 2 };
  }
  let level = base + cfg.step * cfg.dir;
  if (kind === 'band') level = Math.min(BAND_MAX, Math.max(1, level));
  if (kind === 'assisted') level = Math.max(0, level);
  if (kind === 'weight' || kind === 'bodyweight') level = Math.round(level * 2) / 2;
  // 档位类负荷到达边界时退回加次数
  if ((kind === 'band' && level === base) || (kind === 'assisted' && level === base)) {
    return exercise.mode === 'timed'
      ? { duration: (exercise.duration || 30) + 15, level: base }
      : { reps: (exercise.reps || 10) + 2, level: base };
  }
  return { level };
}

function regressTarget(exercise, kind, lastLevel) {
  const cfg = LOAD_KINDS[kind] || LOAD_KINDS.none;
  const base = Number.isFinite(lastLevel) ? lastLevel : null;
  if (base === null || cfg.step === 0) {
    return exercise.mode === 'timed'
      ? { duration: Math.max(10, (exercise.duration || 30) - 15) }
      : { reps: Math.max(3, (exercise.reps || 10) - 2) };
  }
  const level = kind === 'assisted'
    ? base + cfg.step // 退阶 = 增加辅助
    : Math.max(0, base - cfg.step);
  return { level: Math.round(level * 2) / 2 };
}

export function describeTarget(exercise, target) {
  const parts = [];
  if (target.level != null) {
    const cfg = LOAD_KINDS[exercise.load?.kind] || {};
    parts.push(`${target.level}${cfg.unit || ''}`);
  }
  if (target.reps != null) parts.push(`${exercise.sets}×${target.reps}`);
  if (target.duration != null) parts.push(`${exercise.sets}×${target.duration}s`);
  if (!parts.length) parts.push('维持上次');
  return parts.join(' · ');
}

function perfSummaryText(exercise) {
  return exercise.mode === 'timed'
    ? `${exercise.sets}×${exercise.duration}s`
    : `${exercise.sets}×${exercise.reps}次`;
}
