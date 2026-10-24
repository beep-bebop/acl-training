// 训练周期：排班 / 休息周 / 活动阶段。
import { defineStore } from 'pinia';
import { defaultProgram } from '../core/schema.js';
import { weekKeyOf } from '../core/periodization.js';

export const useProgramStore = defineStore('program', {
  state: () => ({ ...defaultProgram({ planGroups: [] }) }),

  actions: {
    hydrate(program) {
      Object.assign(this, defaultProgram({ planGroups: [] }), program || {});
    },
    setCycleStart(dateKey) {
      this.cycleStart = dateKey;
    },
    setWeekdayPlan(dow, planId) {
      if (planId) this.weekdayPlan = { ...this.weekdayPlan, [dow]: planId };
      else {
        const next = { ...this.weekdayPlan };
        delete next[dow];
        this.weekdayPlan = next;
      }
    },
    setDeloadEveryN(n) {
      this.deloadEveryN = n > 0 ? n : null;
    },
    toggleDeloadWeek(dateKey) {
      const wk = weekKeyOf(dateKey);
      const idx = this.deloadWeeks.indexOf(wk);
      if (idx >= 0) this.deloadWeeks.splice(idx, 1);
      else this.deloadWeeks.push(wk);
    },
    setActiveStage(stageId) {
      this.activeStage = stageId;
    }
  }
});
