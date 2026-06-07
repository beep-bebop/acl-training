// 日历与训练统计页面
import { state } from '../core/state.js';
import { todayStr } from '../utils/helpers.js';
import { buildTrainingStats } from '../services/stats.js';

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeClassToken(text = '') {
  return String(text).replace(/[^a-zA-Z0-9_-]/g, '');
}

function formatDuration(seconds = 0) {
  const total = Number(seconds) || 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}小时${m}分`;
  return `${m}分钟`;
}

export function renderStatsDashboard(stats) {
  const topPlans = (stats.planSummaries || []).slice(0, 4);
  const planRows = topPlans.length
    ? topPlans.map(plan => `
      <div class="plan-stat-row">
        <span>${escapeHtml(plan.name)}</span>
        <strong>${plan.sessions} 次 · ${plan.completedSets} 组</strong>
      </div>`).join('')
    : '<div class="plan-stat-empty">暂无训练记录</div>';

  return `
    <section class="stats-dashboard">
      <div class="stats-card strong">
        <span class="stats-label">最近 7 天</span>
        <strong>${stats.last7.trainingDays} 天</strong>
        <span>${stats.last7.completedSets} 组 · ${formatDuration(stats.last7.durationSeconds)}</span>
      </div>
      <div class="stats-card">
        <span class="stats-label">最近 30 天</span>
        <strong>${stats.last30.trainingDays} 天</strong>
        <span>${stats.last30.sessions} 次训练 · ${stats.last30.completedSets} 组</span>
      </div>
      <div class="stats-card">
        <span class="stats-label">渐进增长</span>
        <strong>${escapeHtml(stats.trends.sets)}</strong>
        <span>本周组数变化 · 训练次数 ${escapeHtml(stats.trends.sessions)}</span>
      </div>
      <div class="stats-card plan-stat-card">
        <span class="stats-label">计划统计</span>
        <div class="plan-stat-list">${planRows}</div>
      </div>
    </section>`;
}

export function renderCalendar() {
  const container = document.getElementById('calendarContent');
  const now = new Date();
  if (!state.calYear) { state.calYear = now.getFullYear(); state.calMonth = now.getMonth(); }
  const firstDay = new Date(state.calYear, state.calMonth, 1).getDay();
  const daysInMonth = new Date(state.calYear, state.calMonth + 1, 0).getDate();
  const today = todayStr();
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const stats = buildTrainingStats({ plans: state.plans, runtime: state.runtime, today });

  let html = renderStatsDashboard(stats);
  html += `<div class="calendar-header">
    <button data-cal-prev>上月</button>
    <div class="month">${state.calYear}年${monthNames[state.calMonth]}</div>
    <button data-cal-next>下月</button>
  </div><div class="calendar-grid">`;

  ['日', '一', '二', '三', '四', '五', '六'].forEach(w => { html += `<div class="cal-weekday">${w}</div>`; });
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${state.calYear}-${String(state.calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const logs = state.runtime.calendarLogs[dateStr];
    let cls = 'cal-day';
    if (isToday) cls += ' today';
    if (logs && logs.length) {
      cls += ' has-log';
      logs.forEach(l => {
        const plan = state.plans.find(p => p.id === l.planId);
        const stageId = plan ? plan.stage : '';
        if (stageId) cls += ` ${sanitizeClassToken(stageId)}`;
      });
    }
    html += `<div class="${cls}" data-cal-day="${dateStr}">${d}</div>`;
  }
  html += '</div><div id="dayDetail"></div>';
  container.innerHTML = html;
}

export function calPrev() {
  state.calMonth--;
  if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
  renderCalendar();
}

export function calNext() {
  state.calMonth++;
  if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
  renderCalendar();
}

export function showDayDetail(dateStr) {
  const logs = state.runtime.calendarLogs[dateStr] || [];
  const el = document.getElementById('dayDetail');
  if (!el) return;
  if (!logs.length) {
    el.innerHTML = '<div class="day-detail"><div class="no-log">这一天没有训练记录</div></div>';
    return;
  }
  let html = `<div class="day-detail"><h3>${dateStr} 训练记录</h3>`;
  logs.forEach(log => {
    const time = new Date(log.time);
    html += `<div class="log-item">${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')} · ${escapeHtml(log.planName)} · ${escapeHtml(log.name)}</div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}
