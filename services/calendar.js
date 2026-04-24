// 日历记录服务
import { state } from '../core/state.js';
import { saveToStorage } from '../core/storage.js';
import { getPlan, todayStr } from '../utils/helpers.js';

/** 记录动作完成到日历 */
export function logCalendar(planId, exName, persist = true) {
  const today = todayStr();
  if (!state.calendarLogs[today]) state.calendarLogs[today] = [];
  if (!state.calendarLogs[today].find(l => l.planId === planId && l.name === exName)) {
    const plan = getPlan(planId, state.plans);
    state.calendarLogs[today].push({
      planId, name: exName,
      planName: plan ? plan.name : '未知',
      time: Date.now(),
    });
  }
  if (persist) saveToStorage();
}
