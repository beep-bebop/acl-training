// 训练指标汇总（纯函数）：训练量 / 周汇总 / 动作趋势 / 疼痛趋势 / 坚持度
import { weekKeyOf, mondayOf, parseDate, todayKey } from './periodization.js';

/** 单条组记录的负荷量（kg·次 近似；无负荷类型计 0） */
export function setLoadVolume(log) {
  const kind = log.loadKind;
  const level = Number(log.loadLevel) || 0;
  const reps = Number(log.reps) || (Number(log.duration) ? Math.max(1, Math.round(log.duration / 10)) : 1);
  if (kind === 'weight' || kind === 'bodyweight') return reps * level;
  if (kind === 'band') return reps * level * 3; // 档位折算为等效负荷
  return 0;
}

export function sessionVolume(setLogs, sessionKey) {
  return setLogs
    .filter((l) => `${l.date}_${l.planId}` === sessionKey || l.__sessionId === sessionKey)
    .reduce((sum, l) => sum + setLoadVolume(l), 0);
}

/** 最近 N 周的周汇总（含本周），按周一升序 */
export function weeklySummary(logs, weeks = 12, today = todayKey()) {
  const { sessionLogs, setLogs } = logs;
  const thisMonday = mondayOf(parseDate(today));
  const list = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = new Date(thisMonday);
    monday.setDate(monday.getDate() - i * 7);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const mKey = dateKeyOf(monday), sKey = dateKeyOf(sunday);
    const sessions = sessionLogs.filter((s) => s.date >= mKey && s.date <= sKey);
    const sets = setLogs.filter((l) => l.date >= mKey && l.date <= sKey);
    list.push({
      weekKey: weekKeyOf(mKey),
      monday: mKey,
      sessions: sessions.length,
      sets: sets.length,
      volume: Math.round(sets.reduce((sum, l) => sum + setLoadVolume(l), 0))
    });
  }
  return list;
}

/** 动作负荷趋势：每次训练日的顶级负荷与总量 */
export function exerciseTrend(setLogs, exerciseId) {
  const own = setLogs
    .filter((l) => l.exerciseId === exerciseId)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || 0) - (b.time || 0)));
  const byDate = new Map();
  for (const l of own) {
    if (!byDate.has(l.date)) byDate.set(l.date, []);
    byDate.get(l.date).push(l);
  }
  return [...byDate.entries()].map(([date, logs]) => {
    const levels = logs.map((l) => Number(l.loadLevel)).filter(Number.isFinite);
    const pains = logs.map((l) => Number(l.pain) || 0);
    return {
      date,
      topLoad: levels.length ? Math.max(...levels) : null,
      reps: logs.reduce((s, l) => s + (Number(l.reps) || 0), 0),
      sets: logs.length,
      volume: Math.round(logs.reduce((s, l) => s + setLoadVolume(l), 0)),
      avgPain: pains.length ? +(pains.reduce((a, b) => a + b, 0) / pains.length).toFixed(1) : null
    };
  });
}

/** 疼痛趋势（训练组记录 + 晨检合并，按天平均） */
export function painTrend(logs, days = 90, today = todayKey()) {
  const points = new Map();
  const since = new Date(parseDate(today));
  since.setDate(since.getDate() - days);
  const sinceKey = dateKeyOf(since);
  for (const l of logs.setLogs || []) {
    if (l.date < sinceKey) continue;
    const p = Number(l.pain) || 0;
    if (!p) continue;
    if (!points.has(l.date)) points.set(l.date, []);
    points.get(l.date).push(p);
  }
  for (const r of logs.readinessLogs || []) {
    if (r.date < sinceKey || r.date > today) continue;
    const p = Number(r.pain) || 0;
    if (!p) continue;
    if (!points.has(r.date)) points.set(r.date, []);
    points.get(r.date).push(p);
  }
  return [...points.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, arr]) => ({ date, pain: +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) }));
}

/** 热力图数据：dateKey → 强度(0-3)，未来日期 level=-1 */
export function heatmap(logs, weeks = 16, today = todayKey()) {
  const counts = new Map();
  for (const s of logs.sessionLogs || []) counts.set(s.date, (counts.get(s.date) || 0) + 1);
  const thisMonday = mondayOf(parseDate(today));
  const start = new Date(thisMonday);
  start.setDate(start.getDate() - (weeks - 1) * 7);
  const out = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(day.getDate() + w * 7 + d);
      const key = dateKeyOf(day);
      if (key > today) {
        out.push({ dateKey: key, level: -1, sessions: 0 });
        continue;
      }
      const n = counts.get(key) || 0;
      const level = n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : 3;
      out.push({ dateKey: key, level, sessions: n });
    }
  }
  return out;
}

/** 连续训练周数（每周至少 1 次会话，从本周往回数；本周未练不中断，除非上周也没有） */
export function consistencyWeeks(sessionLogs, today = todayKey()) {
  const weeks = new Set(sessionLogs.map((s) => weekKeyOf(s.date)));
  let count = 0;
  const monday = mondayOf(parseDate(today));
  for (let i = 0; i < 520; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() - i * 7);
    const wk = weekKeyOf(dateKeyOf(d));
    if (weeks.has(wk)) count++;
    else if (i > 0) break; // 本周未练不算中断
  }
  return count;
}

export function sessionCounts(sessionLogs, days, today = todayKey()) {
  const since = new Date(parseDate(today));
  since.setDate(since.getDate() - (days - 1));
  const sinceKey = dateKeyOf(since);
  return sessionLogs.filter((s) => s.date >= sinceKey && s.date <= today).length;
}

/** 计划预计时长（分钟）：组耗时 = 动作时长/次数折算 + 组间休息 */
export function estimatePlanMinutes(plan) {
  let sec = 0;
  for (const mod of plan.modules || []) {
    for (const ex of mod.exercises || []) {
      const work = ex.mode === 'timed' ? ex.duration || 60 : Math.max(25, (ex.reps || 10) * 4);
      sec += (ex.sets || 1) * (work + (ex.rest || 0));
    }
  }
  return Math.max(1, Math.round(sec / 60));
}

function dateKeyOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
