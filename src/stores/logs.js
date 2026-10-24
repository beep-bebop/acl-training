// 训练日志：组记录 / 会话记录 / 日历记录 / 晨检记录。
import { defineStore } from 'pinia';

function emptyLogs() {
  return { calendarLogs: {}, sessionLogs: [], setLogs: [], readinessLogs: [] };
}

export const useLogsStore = defineStore('logs', {
  state: () => ({ ...emptyLogs(), loaded: false }),

  getters: {
    readinessToday(state) {
      const today = todayKeyLocal();
      return state.readinessLogs.find((r) => r.date === today) || null;
    },
    sessionsToday(state) {
      const today = todayKeyLocal();
      return state.sessionLogs.filter((s) => s.date === today);
    }
  },

  actions: {
    hydrate(logs) {
      Object.assign(this, emptyLogs(), logs || {});
      this.loaded = true;
    },

    /** 训练中记录一组（再次提交同组则覆盖） */
    logSet(entry) {
      const idx = this.setLogs.findIndex(
        (l) => l.date === entry.date && l.planId === entry.planId && l.exerciseId === entry.exerciseId && l.setIndex === entry.setIndex
      );
      const record = { time: Date.now(), ...entry };
      if (idx >= 0) this.setLogs.splice(idx, 1, record);
      else this.setLogs.push(record);
    },

    removeSetLogsFor(exerciseId, date) {
      this.setLogs = this.setLogs.filter((l) => !(l.exerciseId === exerciseId && (!date || l.date === date)));
    },

    /** 撤销单组记录（取消勾选时保持一致性） */
    removeSetLog(exerciseId, setIndex, date) {
      this.setLogs = this.setLogs.filter(
        (l) => !(l.exerciseId === exerciseId && l.setIndex === setIndex && (!date || l.date === date))
      );
    },

    /** 动作完成 → 日历记录（当天详情展示用） */
    logExerciseDone(planId, planName, exercise) {
      const today = todayKeyLocal();
      if (!this.calendarLogs[today]) this.calendarLogs[today] = [];
      const list = this.calendarLogs[today];
      if (!list.some((l) => l.planId === planId && l.exerciseId === exercise.id)) {
        list.push({ planId, exerciseId: exercise.id, name: exercise.name, planName, time: Date.now() });
      }
    },

    /** 会话结束 → 汇总记录 */
    logSession(summary) {
      this.sessionLogs.push({ id: `sess_${Date.now().toString(36)}`, ...summary });
    },

    logReadiness({ pain, swelling, notes = '' }) {
      const today = todayKeyLocal();
      const entry = { date: today, pain, swelling, notes, time: Date.now() };
      const idx = this.readinessLogs.findIndex((r) => r.date === today);
      if (idx >= 0) this.readinessLogs.splice(idx, 1, entry);
      else this.readinessLogs.push(entry);
    },

    clearTrainingHistory() {
      const { readinessLogs } = this;
      Object.assign(this, emptyLogs(), { readinessLogs });
    }
  }
});

function todayKeyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
