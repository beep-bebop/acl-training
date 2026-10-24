// 动作目录：阶段分组 → 计划 → 模块 → 动作 的全部 CRUD 与导入合并。
import { defineStore } from 'pinia';
import { normalizeGroup, normalizePlan, normalizeModule, normalizeExercise } from '../core/schema.js';
import { uniqueId } from '../core/id.js';

export const useCatalogStore = defineStore('catalog', {
  state: () => ({ planGroups: [], loaded: false }),

  getters: {
    flatPlans(state) {
      const out = [];
      for (const group of state.planGroups) {
        for (const plan of group.plans) {
          out.push({ ...plan, groupId: group.id, groupName: group.name, groupColor: group.color });
        }
      }
      return out;
    },
    planCount(state) {
      return state.planGroups.reduce((s, g) => s + g.plans.length, 0);
    },
    exerciseCount(state) {
      return state.planGroups.reduce(
        (s, g) => s + g.plans.reduce((s2, p) => s2 + p.modules.reduce((s3, m) => s3 + m.exercises.length, 0), 0),
        0
      );
    }
  },

  actions: {
    hydrate(catalog) {
      this.planGroups = catalog?.planGroups || [];
      this.loaded = true;
    },

    // ---------- 定位 ----------
    findPlan(planId) {
      for (const group of this.planGroups) {
        const plan = group.plans.find((p) => p.id === planId);
        if (plan) return { group, plan };
      }
      return null;
    },
    findModule(moduleId) {
      for (const { group, plan } of this.allEntries()) {
        const module = plan.modules.find((m) => m.id === moduleId);
        if (module) return { group, plan, module };
      }
      return null;
    },
    findExercise(exerciseId) {
      for (const { plan, module } of this.allEntries()) {
        const exercise = module.exercises.find((e) => e.id === exerciseId);
        if (exercise) return { plan, module, exercise };
      }
      return null;
    },
    allEntries() {
      const out = [];
      for (const group of this.planGroups) {
        for (const plan of group.plans) {
          for (const module of plan.modules) out.push({ group, plan, module });
        }
      }
      return out;
    },

    // ---------- 分组 ----------
    addGroup(name, subtitle = '') {
      const group = normalizeGroup(
        { id: uniqueId('stage', this.planGroups.map((g) => g.id)), name, subtitle, order: this.planGroups.length + 1 },
        this.planGroups.length
      );
      this.planGroups.push(group);
      return group;
    },
    updateGroup(groupId, patch) {
      const group = this.planGroups.find((g) => g.id === groupId);
      if (!group) return;
      if (patch.name != null) group.name = String(patch.name).trim() || group.name;
      if (patch.subtitle != null) group.subtitle = String(patch.subtitle);
      if (patch.color != null) group.color = patch.color;
      if (patch.coaching != null) group.coaching = { ...group.coaching, ...patch.coaching };
    },
    removeGroup(groupId) {
      const idx = this.planGroups.findIndex((g) => g.id === groupId);
      if (idx >= 0) this.planGroups.splice(idx, 1);
    },

    // ---------- 计划 ----------
    addPlan(groupId, name, coaching = {}) {
      const group = this.planGroups.find((g) => g.id === groupId);
      if (!group) return null;
      const plan = normalizePlan(
        { id: uniqueId('plan', this.flatPlans.map((p) => p.id)), name, stage: groupId, coaching, modules: [] },
        { groupId }
      );
      group.plans.push(plan);
      return plan;
    },
    updatePlan(planId, patch) {
      const found = this.findPlan(planId);
      if (!found) return;
      if (patch.name != null) found.plan.name = String(patch.name).trim() || found.plan.name;
      if (patch.coaching != null) found.plan.coaching = { ...found.plan.coaching, ...patch.coaching };
    },
    removePlan(planId) {
      for (const group of this.planGroups) {
        const idx = group.plans.findIndex((p) => p.id === planId);
        if (idx >= 0) {
          group.plans.splice(idx, 1);
          return true;
        }
      }
      return false;
    },
    duplicatePlan(planId) {
      const found = this.findPlan(planId);
      if (!found) return null;
      const copy = JSON.parse(JSON.stringify(found.plan));
      const allIds = this.collectIds();
      copy.id = uniqueId('plan', allIds);
      copy.name = `${found.plan.name} 副本`;
      const renameIds = (node) => {
        for (const mod of node.modules || []) {
          mod.id = uniqueId('mod', allIds);
          for (const ex of mod.exercises || []) ex.id = uniqueId('ex', allIds);
        }
      };
      renameIds(copy);
      found.group.plans.push(copy);
      return copy;
    },
    movePlan(planId, toGroupId, toIndex) {
      const found = this.findPlan(planId);
      const target = this.planGroups.find((g) => g.id === toGroupId);
      if (!found || !target) return;
      found.group.plans.splice(found.group.plans.indexOf(found.plan), 1);
      target.plans.splice(Math.max(0, Math.min(toIndex, target.plans.length)), 0, found.plan);
      found.plan.stage = toGroupId;
    },

    // ---------- 模块 ----------
    addModule(planId, { name, type = 'custom', intent = '' }) {
      const found = this.findPlan(planId);
      if (!found) return null;
      const module = normalizeModule(
        { id: uniqueId('mod', this.collectIds()), name, type, intent, exercises: [] },
        {}
      );
      found.plan.modules.push(module);
      return module;
    },
    updateModule(moduleId, patch) {
      const found = this.findModule(moduleId);
      if (!found) return;
      if (patch.name != null) found.module.name = String(patch.name).trim() || found.module.name;
      if (patch.type != null) found.module.type = patch.type;
      if (patch.intent != null) found.module.intent = String(patch.intent);
    },
    removeModule(moduleId) {
      for (const group of this.planGroups) {
        for (const plan of group.plans) {
          const idx = plan.modules.findIndex((m) => m.id === moduleId);
          if (idx >= 0) {
            plan.modules.splice(idx, 1);
            return true;
          }
        }
      }
      return false;
    },
    moveModule(planId, fromIndex, toIndex) {
      const found = this.findPlan(planId);
      if (!found) return;
      const mods = found.plan.modules;
      const [moved] = mods.splice(fromIndex, 1);
      mods.splice(Math.max(0, Math.min(toIndex, mods.length)), 0, moved);
    },

    // ---------- 动作 ----------
    addExercise(moduleId, preset = {}) {
      const found = this.findModule(moduleId);
      if (!found) return null;
      const exercise = normalizeExercise(
        { id: uniqueId('ex', this.collectIds()), sets: 3, reps: 10, ...preset },
        { moduleType: found.module.type }
      );
      found.module.exercises.push(exercise);
      return exercise;
    },
    updateExercise(exerciseId, patch) {
      const found = this.findExercise(exerciseId);
      if (!found) return;
      const merged = normalizeExercise(
        { ...found.exercise, ...patch, id: found.exercise.id },
        { moduleType: found.module.type }
      );
      found.module.exercises.splice(found.module.exercises.indexOf(found.exercise), 1, merged);
    },
    removeExercise(exerciseId) {
      const found = this.findExercise(exerciseId);
      if (!found) return false;
      found.module.exercises.splice(found.module.exercises.indexOf(found.exercise), 1);
      return true;
    },
    duplicateExercise(exerciseId) {
      const found = this.findExercise(exerciseId);
      if (!found) return null;
      const copy = normalizeExercise(
        { ...JSON.parse(JSON.stringify(found.exercise)), id: uniqueId('ex', this.collectIds()), name: `${found.exercise.name} 副本` },
        { moduleType: found.module.type }
      );
      found.module.exercises.splice(found.module.exercises.indexOf(found.exercise) + 1, 0, copy);
      return copy;
    },
    moveExercise(moduleId, fromIndex, toIndex) {
      const found = this.findModule(moduleId);
      if (!found) return;
      const list = found.module.exercises;
      const [moved] = list.splice(fromIndex, 1);
      list.splice(Math.max(0, Math.min(toIndex, list.length)), 0, moved);
    },
    copyExerciseToModule(exerciseId, moduleId) {
      const found = this.findExercise(exerciseId);
      const target = this.findModule(moduleId);
      if (!found || !target) return null;
      const copy = normalizeExercise(
        { ...JSON.parse(JSON.stringify(found.exercise)), id: uniqueId('ex', this.collectIds()) },
        { moduleType: target.module.type }
      );
      target.module.exercises.push(copy);
      return copy;
    },

    // ---------- 导入合并 ----------
    // strategy: 'merge'（按 id 覆盖/新增）| 'append'（全部新增，id 冲突自动重命名）
    importCatalog(incoming, strategy = 'merge') {
      let added = 0;
      let updated = 0;
      const existingPlanIds = new Set(this.flatPlans.map((p) => p.id));
      for (const group of incoming.planGroups || []) {
        let targetGroup = this.planGroups.find((g) => g.id === group.id);
        if (!targetGroup) {
          targetGroup = this.addGroup(group.name, group.subtitle);
          targetGroup.color = group.color || targetGroup.color;
          targetGroup.coaching = group.coaching || targetGroup.coaching;
        }
        for (const plan of group.plans) {
          const normalized = normalizePlan(plan, { groupId: targetGroup.id });
          if (strategy === 'append' && existingPlanIds.has(normalized.id)) {
            normalized.id = uniqueId('plan', [...existingPlanIds]);
            existingPlanIds.add(normalized.id);
            targetGroup.plans.push(normalized);
            added++;
          } else {
            const idx = targetGroup.plans.findIndex((p) => p.id === normalized.id);
            if (idx >= 0) {
              targetGroup.plans.splice(idx, 1, normalized);
              updated++;
            } else {
              targetGroup.plans.push(normalized);
              existingPlanIds.add(normalized.id);
              added++;
            }
          }
        }
      }
      return { added, updated };
    },

    collectIds() {
      const ids = [];
      for (const { plan, module } of this.allEntries()) {
        ids.push(plan.id, module.id);
        for (const ex of module.exercises) ids.push(ex.id);
      }
      for (const g of this.planGroups) ids.push(g.id);
      return ids;
    }
  }
});
