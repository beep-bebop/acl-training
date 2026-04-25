// 日历记录服务
import { state } from '../core/state.js';
import { saveToStorage } from '../core/storage.js';
import { getPlan, todayStr } from '../utils/helpers.js';

/** 记录动作完成到日历 */
export function logCalendar(planId, exName, exerciseIdOrPersist = '', persist = true) {
  const exerciseId = typeof exerciseIdOrPersist === 'string' ? exerciseIdOrPersist : '';
  const shouldPersist = typeof exerciseIdOrPersist === 'boolean' ? exerciseIdOrPersist : persist;
  const today = todayStr();
  if (!state.runtime.calendarLogs[today]) state.runtime.calendarLogs[today] = [];
  if (!state.runtime.calendarLogs[today].find(l => l.planId === planId && l.name === exName && (l.exerciseId || '') === exerciseId)) {
    const plan = getPlan(planId, state.plans);
    state.runtime.calendarLogs[today].push({
      planId, name: exName,
      exerciseId,
      planName: plan ? plan.name : '未知',
      time: Date.now(),
    });
  }
  if (shouldPersist) saveToStorage();
}
