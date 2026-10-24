// 训练执行会话：进度 / 模块展开 / 休息计时 / 建议采纳 / 会话收尾。
import { defineStore } from 'pinia';
import { todayKey } from '../core/periodization.js';

function emptySession() {
  return null;
}

export const useTrainingStore = defineStore('training', {
  state: () => ({
    session: emptySession(), // { planId, planName, date, startedAt, progress:{exId_s0:true}, openModules:{}, adopted:{}, focusExId }
    rest: null // { endsAt, total, remaining(暂停时), sourceExId, setNo }
  }),

  getters: {
    isActive: (state) => Boolean(state.session),
    elapsedSec(state) {
      if (!state.session) return 0;
      return Math.max(0, Math.round((Date.now() - state.session.startedAt) / 1000));
    }
  },

  actions: {
    start(plan) {
      const firstModule = plan.modules?.[0];
      this.session = {
        planId: plan.id,
        planName: plan.name,
        date: todayKey(),
        startedAt: Date.now(),
        progress: {},
        openModules: firstModule ? { [firstModule.id]: true } : {},
        adopted: {},
        focusExId: firstModule?.exercises?.[0]?.id || null
      };
      this.rest = null;
    },

    exit() {
      this.session = null;
      this.rest = null;
    },

    keyOf(exerciseId, setIndex) {
      return `${exerciseId}_s${setIndex}`;
    },

    isDone(exerciseId, setIndex) {
      return Boolean(this.session?.progress[this.keyOf(exerciseId, setIndex)]);
    },

    toggleSet(exerciseId, setIndex) {
      if (!this.session) return false;
      const key = this.keyOf(exerciseId, setIndex);
      if (this.session.progress[key]) delete this.session.progress[key];
      else this.session.progress[key] = true;
      return Boolean(this.session.progress[key]);
    },

    setOpenModule(moduleId, open) {
      if (!this.session) return;
      this.session.openModules = { ...this.session.openModules, [moduleId]: open };
    },

    setFocusExercise(exerciseId) {
      if (!this.session) return;
      this.session.focusExId = exerciseId;
    },

    adoptSuggestion(exerciseId, target) {
      if (!this.session) return;
      this.session.adopted = { ...this.session.adopted, [exerciseId]: target || {} };
    },

    startRest(seconds, sourceExId = '', setNo = 0) {
      if (!seconds || seconds <= 0) return;
      this.rest = { endsAt: Date.now() + seconds * 1000, total: seconds, remaining: null, sourceExId, setNo };
    },
    pauseRest() {
      if (!this.rest || this.rest.remaining != null) return;
      this.rest.remaining = Math.max(0, Math.round((this.rest.endsAt - Date.now()) / 1000));
    },
    resumeRest() {
      if (!this.rest || this.rest.remaining == null) return;
      this.rest.endsAt = Date.now() + this.rest.remaining * 1000;
      this.rest.remaining = null;
    },
    adjustRest(deltaSec) {
      if (!this.rest) return;
      const base = this.rest.remaining != null ? this.rest.remaining : Math.max(0, (this.rest.endsAt - Date.now()) / 1000);
      const next = Math.max(0, Math.round(base + deltaSec));
      this.rest.remaining = null;
      this.rest.total = Math.max(this.rest.total, next);
      this.rest.endsAt = Date.now() + next * 1000;
    },
    skipRest() {
      this.rest = null;
    }
  }
});
