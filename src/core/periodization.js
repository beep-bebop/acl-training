// 周期与休息周计算（纯函数，周一为一周之始）
import { toDateKey } from './schema.js';

export function parseDate(dateKey) {
  return new Date(dateKey + 'T00:00:00');
}

export function todayKey(now = new Date()) {
  return toDateKey(now);
}

/** 给定日期所在周的周一（Date） */
export function mondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

export function addDays(dateKey, days) {
  const d = parseDate(dateKey);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** ISO 周标识 'YYYY-Wnn' */
export function weekKeyOf(dateKey) {
  const d = parseDate(dateKey);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  const week = 1 + Math.round((diff / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function diffDays(fromKey, toKey) {
  return Math.round((parseDate(toKey) - parseDate(fromKey)) / 86400000);
}

/**
 * 某天的周期状态。
 * 返回 { weekIndex(从周期起点计,1起), isDeload, deloadReason('auto'|'manual'|null), label }
 */
export function weekStatus(program, dateKey) {
  const start = mondayOf(parseDate(program.cycleStart)).getTime();
  const cur = mondayOf(parseDate(dateKey)).getTime();
  const weekIndex = Math.floor((cur - start) / (7 * 86400000)) + 1;
  const wk = weekKeyOf(dateKey);
  const manual = (program.deloadWeeks || []).includes(wk);
  const auto = program.deloadEveryN > 0 && weekIndex > 0 && weekIndex % program.deloadEveryN === 0;
  const isDeload = manual || auto;
  return {
    weekIndex,
    weekKey: wk,
    isDeload,
    deloadReason: manual ? 'manual' : auto ? 'auto' : null,
    label: isDeload ? '休息周' : weekIndex > 0 ? `渐进周 ${weekIndex}` : '周期前'
  };
}

/** 下一个休息周的周一与剩余天数；无规则返回 null */
export function nextDeload(program, dateKey) {
  if (!program || !(program.deloadEveryN > 0) || !program.cycleStart) return null;
  const start = mondayOf(parseDate(program.cycleStart));
  const today = mondayOf(parseDate(dateKey));
  let weeksFromStart = Math.floor((today - start) / (7 * 86400000));
  for (let i = 0; i < 200; i++) {
    const candidate = new Date(start);
    candidate.setDate(candidate.getDate() + (weeksFromStart + i) * 7);
    const idx = Math.floor((candidate - start) / (7 * 86400000)) + 1;
    if (idx % program.deloadEveryN === 0) {
      const daysAway = Math.round((candidate - parseDate(dateKey)) / 86400000);
      if (daysAway < 0) continue;
      return { monday: toDateKey(candidate), weekIndex: idx, daysAway };
    }
  }
  return null;
}

function findPlan(catalog, planId) {
  for (const g of catalog.planGroups || []) {
    for (const p of g.plans) if (p.id === planId) return p;
  }
  return null;
}

function restPlans(catalog) {
  const group = (catalog.planGroups || []).find((g) => /rest|休息/.test(g.id + g.name));
  return group ? group.plans : [];
}

/**
 * 今日推荐：休息周 → 休息日计划轮换；排班日 → weekdayPlan；否则 → 活动阶段轮换。
 * 返回 { plan|null, source: 'rest'|'schedule'|'stage'|null, reason }
 */
export function suggestPlanForDay(program, catalog, dateKey) {
  const dow = (parseDate(dateKey).getDay() + 6) % 7; // 周一=0
  const status = weekStatus(program, dateKey);

  if (status.isDeload) {
    const plans = restPlans(catalog);
    if (plans.length) {
      const pick = plans[dow % plans.length];
      return { plan: pick, source: 'rest', reason: '休息周：以恢复为主' };
    }
    return { plan: null, source: 'rest', reason: '休息周：主动恢复，散步/拉伸即可' };
  }

  const scheduledId = program.weekdayPlan?.[dow];
  if (scheduledId) {
    const plan = findPlan(catalog, scheduledId);
    if (plan) return { plan, source: 'schedule', reason: '按本周排班' };
  }

  const stageGroup = (catalog.planGroups || []).find((g) => g.id === program.activeStage);
  const plans = stageGroup?.plans || [];
  if (plans.length) {
    const daysSinceStart = diffDays(program.cycleStart, dateKey);
    const pick = plans[Math.abs(daysSinceStart) % plans.length];
    return { plan: pick, source: 'stage', reason: `按「${stageGroup.name}」轮换` };
  }
  return { plan: null, source: null, reason: '还没有可训练的计划' };
}

/**
 * 本周条带（周一→周日）。
 * state: done(有会话) / planned(排班且未到) / missed(排班已过且无会话) / rest(无排班) / today / future
 */
export function weekStrip(program, catalog, sessionLogs, dateKey) {
  const monday = mondayOf(parseDate(dateKey));
  const today = dateKey;
  const doneDays = new Set(sessionLogs.map((s) => s.date));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const key = toDateKey(d);
    const dow = i;
    const scheduledId = program.weekdayPlan?.[dow];
    const scheduled = scheduledId ? findPlan(catalog, scheduledId) : null;
    const done = doneDays.has(key);
    let state;
    if (key === today) state = done ? 'done' : 'today';
    else if (done) state = 'done';
    else if (key < today) state = scheduled ? 'missed' : 'rest';
    else state = scheduled ? 'planned' : 'future';
    return { dateKey: key, dow, state, planName: scheduled?.name || '' };
  });
}

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
