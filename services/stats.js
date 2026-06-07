function toDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDateRange(today, days) {
  const end = toDate(today);
  const start = new Date(end);
  start.setDate(end.getDate() - Math.max(1, days) + 1);
  const result = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    result.push(isoDate(cursor));
  }
  return result;
}

function emptyWindow(days) {
  return {
    days,
    trainingDays: 0,
    sessions: 0,
    durationSeconds: 0,
    completedSets: 0,
    completedExercises: 0,
    completedPlans: 0,
    calendarEntries: 0,
  };
}

function summarizeWindow(runtime, dates) {
  const dateSet = new Set(dates);
  const summary = emptyWindow(dates.length);
  dates.forEach((date) => {
    const logs = runtime.calendarLogs?.[date] || [];
    summary.calendarEntries += logs.length;
    if (logs.length) summary.trainingDays += 1;
  });
  (runtime.sessionLogs || []).forEach((session) => {
    if (!dateSet.has(session.date)) return;
    summary.sessions += 1;
    summary.durationSeconds += Number(session.durationSeconds) || 0;
    summary.completedSets += Number(session.completedSets) || 0;
    summary.completedExercises += Number(session.completedExercises) || 0;
    if (session.completedPlan) summary.completedPlans += 1;
  });
  return summary;
}

function summarizePlans(plans, runtime) {
  return (plans || []).map((plan) => {
    const sessions = (runtime.sessionLogs || []).filter((session) => session.planId === plan.id);
    const calendarEntries = Object.values(runtime.calendarLogs || {})
      .flat()
      .filter((log) => log.planId === plan.id);
    return {
      planId: plan.id,
      name: plan.name || '未命名计划',
      sessions: sessions.length,
      completedPlans: sessions.filter((session) => session.completedPlan).length,
      completedSets: sessions.reduce((sum, session) => sum + (Number(session.completedSets) || 0), 0),
      completedExercises: sessions.reduce((sum, session) => sum + (Number(session.completedExercises) || 0), 0),
      calendarEntries: calendarEntries.length,
    };
  }).sort((a, b) => b.sessions - a.sessions || b.calendarEntries - a.calendarEntries);
}

export function formatTrendLabel(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) return c === 0 ? '0%' : `+${c}`;
  const pct = Math.round(((c - p) / p) * 100);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

export function buildTrainingStats({ plans = [], runtime = {}, today = isoDate(new Date()) } = {}) {
  const last7Dates = getDateRange(today, 7);
  const last30Dates = getDateRange(today, 30);
  const previous7End = toDate(last7Dates[0]);
  previous7End.setDate(previous7End.getDate() - 1);
  const previous7Dates = getDateRange(isoDate(previous7End), 7);
  const last7 = summarizeWindow(runtime, last7Dates);
  const previous7 = summarizeWindow(runtime, previous7Dates);
  const last30 = summarizeWindow(runtime, last30Dates);

  return {
    today,
    last7,
    previous7,
    last30,
    trends: {
      sets: formatTrendLabel(last7.completedSets, previous7.completedSets),
      exercises: formatTrendLabel(last7.completedExercises, previous7.completedExercises),
      sessions: formatTrendLabel(last7.sessions, previous7.sessions),
    },
    planSummaries: summarizePlans(plans, runtime),
  };
}
