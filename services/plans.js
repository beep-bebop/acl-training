// 计划加载与管理
import { PLAN_FILES } from '../data/config.js';
import { state } from '../core/state.js';
import { loadFromStorage, saveToStorage } from '../core/storage.js';
import { todayStr } from '../utils/helpers.js';

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function validateImportData(data) {
  if (!isPlainObject(data)) {
    return { ok: false, msg: '数据格式不正确，需要 { version: 6, plans: [...] }' };
  }

  if (data.version !== 6) {
    return { ok: false, msg: '仅支持 v6 格式数据（需要 "version": 6）' };
  }

  if (!Array.isArray(data.plans)) {
    return { ok: false, msg: '数据格式不正确，需要 plans 数组' };
  }

  for (let pi = 0; pi < data.plans.length; pi++) {
    const plan = data.plans[pi];
    if (!isPlainObject(plan) || !plan.id || !plan.name || !Array.isArray(plan.modules)) {
      return { ok: false, msg: `第 ${pi + 1} 个计划结构不完整（需包含 id/name/modules）` };
    }

    for (let mi = 0; mi < plan.modules.length; mi++) {
      const mod = plan.modules[mi];
      if (!isPlainObject(mod) || !mod.name || !Array.isArray(mod.exercises)) {
        return { ok: false, msg: `计划「${plan.name}」的第 ${mi + 1} 个模块结构不完整` };
      }

      for (let ei = 0; ei < mod.exercises.length; ei++) {
        const ex = mod.exercises[ei];
        if (!isPlainObject(ex) || !ex.name || !ex.mode) {
          return { ok: false, msg: `计划「${plan.name}」中存在无效动作（缺少 name/mode）` };
        }
        if (ex.mode === 'timed' && typeof ex.duration !== 'number') {
          return { ok: false, msg: `动作「${ex.name}」为计时模式，但缺少数字 duration` };
        }
      }
    }
  }

  return { ok: true };
}

function extractPlanIdFromExKey(key) {
  const m = String(key).match(/^(.*)_\d+_\d+(?:_s\d+)?$/);
  return m ? m[1] : null;
}

function pruneStateByPlanIds(validPlanIds) {
  state.userEdits = Object.fromEntries(
    Object.entries(state.userEdits).filter(([planId]) => validPlanIds.has(planId))
  );

  state.exerciseRest = Object.fromEntries(
    Object.entries(state.exerciseRest).filter(([key]) => {
      const planId = extractPlanIdFromExKey(key);
      return planId && validPlanIds.has(planId);
    })
  );

  state.trainingProgress = Object.fromEntries(
    Object.entries(state.trainingProgress).filter(([key]) => {
      const planId = extractPlanIdFromExKey(key);
      return planId && validPlanIds.has(planId);
    })
  );

  if (state.currentPlanId && !validPlanIds.has(state.currentPlanId)) {
    state.currentPlanId = null;
    state.trainingSessionStartAt = null;
  }
}

// 异步加载默认计划（从 JSON 文件）
export async function loadDefaultPlans() {
  if (state.defaultPlansCache) return state.defaultPlansCache;
  const allPlans = [];
  for (const file of PLAN_FILES) {
    try {
      const resp = await fetch(file + '?v=' + Date.now());
      if (!resp.ok) { console.warn(`加载 ${file} 失败: ${resp.status}`); continue; }
      const data = await resp.json();
      if (data && Array.isArray(data.plans)) {
        allPlans.push(...data.plans);
      }
    } catch (e) {
      console.warn(`加载 ${file} 出错:`, e);
    }
  }
  state.defaultPlansCache = allPlans;
  return allPlans;
}

// 完整状态加载（初始化时调用）
export async function loadState() {
  try {
    const defaults = await loadDefaultPlans();

    const s = loadFromStorage();
    if (s) {
      state.exerciseRest = s.exerciseRest || {};
      state.calendarLogs = s.calendarLogs || {};
      state.userEdits = s.userEdits || {};
      state.trainingProgress = s.trainingProgress || {};
      state.trainingDate = s.trainingDate || null;
      state.trainingSessionStartAt = typeof s.trainingSessionStartAt === 'number'
        ? s.trainingSessionStartAt
        : null;
    }

    // 每日清零
    const today = todayStr();
    if (state.trainingDate !== today) {
      state.trainingProgress = {};
      state.trainingDate = today;
    }

    // 合并：默认计划 + localStorage 新增的自定义计划
    state.plans = defaults;
    if (s && Array.isArray(s.plans)) {
      const defaultIds = new Set(defaults.map(p => p.id));
      const customPlans = s.plans.filter(p => !defaultIds.has(p.id));
      if (customPlans.length) state.plans.push(...customPlans);
    }

    saveToStorage();
    state.dataLoaded = true;
  } catch (e) {
    console.error('[loadState] 出错:', e);
    state.plans = await loadDefaultPlans();
    state.dataLoaded = true;
  }
}

// 导入计划
export function importPlans(json, mergeStrategy = 'merge') {
  let data;
  try {
    data = typeof json === 'string' ? JSON.parse(json) : json;
  } catch (e) {
    return { ok: false, msg: 'JSON 格式错误' };
  }

  if (!data || !Array.isArray(data.plans)) {
    return { ok: false, msg: '数据格式不正确，需要 { version: 6, plans: [...] }' };
  }
  const validated = validateImportData(data);
  if (!validated.ok) return validated;

  let imported = 0, updated = 0;

  if (mergeStrategy === 'replace') {
    state.plans = data.plans;
    const validPlanIds = new Set(state.plans.map(p => p.id));
    pruneStateByPlanIds(validPlanIds);
    imported = data.plans.length;
  } else if (mergeStrategy === 'merge') {
    data.plans.forEach(newPlan => {
      const idx = state.plans.findIndex(p => p.id === newPlan.id);
      if (idx >= 0) { state.plans[idx] = newPlan; updated++; }
      else { state.plans.push(newPlan); imported++; }
    });
  } else { // append
    data.plans.forEach(newPlan => {
      let finalId = newPlan.id;
      let counter = 2;
      while (state.plans.some(p => p.id === finalId)) {
        finalId = `${newPlan.id}_${counter++}`;
      }
      state.plans.push({ ...newPlan, id: finalId });
      imported++;
    });
  }

  saveToStorage();
  return { ok: true, imported, updated };
}
