// 日历页面
import { state } from '../core/state.js';
import { saveToStorage } from '../core/storage.js';
import { todayStr } from '../utils/helpers.js';

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

export function renderCalendar() {
  const container = document.getElementById('calendarContent');
  const now = new Date();
  if (!state.calYear) { state.calYear = now.getFullYear(); state.calMonth = now.getMonth(); }
  const firstDay = new Date(state.calYear, state.calMonth, 1).getDay();
  const daysInMonth = new Date(state.calYear, state.calMonth + 1, 0).getDate();
  const today = todayStr();
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  let html = `<div class="calendar-header">
    <button data-cal-prev>◀</button>
    <div class="month">${state.calYear}年 ${monthNames[state.calMonth]}</div>
    <button data-cal-next>▶</button>
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
