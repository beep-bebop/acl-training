// 计划加载与管理
import { PLAN_FILES } from '../data/config.js';
import { state } from '../core/state.js';
import { loadFromStorage, saveToStorage } from '../core/storage.js';
import { todayStr } from '../utils/helpers.js';

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

  let imported = 0, updated = 0;

  if (mergeStrategy === 'replace') {
    state.plans = data.plans;
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
