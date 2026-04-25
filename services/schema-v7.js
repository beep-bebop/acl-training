// ACL v7 schema/migration helpers
import { STAGES } from '../data/config.js';

export const V7_VERSION = 7;
export const DEFAULT_AI_MODEL = 'deepseek-v4-flash';

const DEFAULT_CUSTOM_GROUP = {
  id: 'custom',
  name: '自定义计划',
  subtitle: '导入与自建',
  badge: '+',
  color: '#8E8E93',
  gradient: 'linear-gradient(135deg, #8E8E93 0%, #636366 100%)',
  order: 999,
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asObject(value) {
  return isObject(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value) {
  return String(value || '').trim();
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function asPositiveInt(value, fallback = 1) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return Math.max(1, Math.floor(n));
  return fallback;
}

function uniqueStrings(values) {
  const out = [];
  const seen = new Set();
  values.forEach((item) => {
    const v = cleanText(item);
    if (!v || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  });
  return out;
}

function parseSetCountFromText(text) {
  const raw = cleanText(text);
  if (!raw) return null;
  const mul = raw.match(/(\d+)\s*[×xX*]\s*\d+/);
  if (mul) return asPositiveInt(mul[1], 1);
  const groupCn = raw.match(/(\d+)\s*组/);
  if (groupCn) return asPositiveInt(groupCn[1], 1);
  const groupEn = raw.match(/(\d+)\s*sets?\b/i);
  if (groupEn) return asPositiveInt(groupEn[1], 1);
  const repList = raw.match(/^\d+(?:\s*[-/、]\s*\d+){2,}$/);
  if (repList) return raw.split(/[-/、]/).length;
  return null;
}

function normalizeMode(value, fallback = 'counted') {
  return value === 'timed' || value === 'counted' ? value : fallback;
}

function ensureUniqueId(baseId, used, fallbackPrefix) {
  const cleaned = cleanText(baseId);
  let id = cleaned || `${fallbackPrefix}_${used.size + 1}`;
  if (!used.has(id)) {
    used.add(id);
    return id;
  }
  let counter = 2;
  while (used.has(`${id}_${counter}`)) counter++;
  const finalId = `${id}_${counter}`;
  used.add(finalId);
  return finalId;
}

function normalizeEnrichment(raw) {
  const source = asObject(raw);
  const normalized = {
    keyPoints: uniqueStrings(asArray(source.keyPoints || source.key_points)),
    commonMistakes: uniqueStrings(asArray(source.commonMistakes || source.common_mistakes)),
    progression: cleanText(source.progression),
    references: uniqueStrings(asArray(source.references)),
    videoLinks: uniqueStrings(asArray(source.videoLinks || source.video_links)),
    source: cleanText(source.source),
    updatedAt: cleanText(source.updatedAt),
  };
  const hasData = normalized.keyPoints.length
    || normalized.commonMistakes.length
    || normalized.progression
    || normalized.references.length
    || normalized.videoLinks.length
    || normalized.source
    || normalized.updatedAt;
  return hasData ? normalized : null;
}

function normalizeExercise(rawExercise, ctx) {
  const raw = asObject(rawExercise);
  const mode = normalizeMode(raw.mode, 'counted');
  const repsText = cleanText(raw.reps);
  const setsByText = parseSetCountFromText(raw.sets) ?? parseSetCountFromText(repsText);
  const sets = asPositiveInt(raw.sets, setsByText || 1);
  const baseDuration = parseSetCountFromText(raw.duration) ?? 30;
  const duration = asPositiveInt(raw.duration, baseDuration);
  const enrichment = normalizeEnrichment(raw.enrichment);
  const exercise = {
    id: ensureUniqueId(raw.id || `${ctx.moduleId}__e${ctx.exerciseIndex + 1}`, ctx.usedExerciseIds, 'exercise'),
    name: cleanText(raw.name) || `动作 ${ctx.exerciseIndex + 1}`,
    mode,
    sets,
    tip: cleanText(raw.tip),
    restBetweenSets: Number.isFinite(Number(raw.restBetweenSets)) && Number(raw.restBetweenSets) > 0
      ? Math.max(1, Math.floor(Number(raw.restBetweenSets)))
      : undefined,
    equipment: uniqueStrings(asArray(raw.equipment)),
    tags: uniqueStrings(asArray(raw.tags)),
    enrichment,
  };

  if (mode === 'timed') {
    exercise.duration = duration;
    if (repsText) exercise.reps = repsText;
  } else {
    exercise.reps = repsText || '12次';
    if (Number.isFinite(Number(raw.duration)) && Number(raw.duration) > 0) {
      exercise.duration = asPositiveInt(raw.duration, duration);
    }
  }

  if (cleanText(raw.sides)) exercise.sides = cleanText(raw.sides);
  return exercise;
}

function normalizeModule(rawModule, ctx) {
  const raw = asObject(rawModule);
  const moduleId = ensureUniqueId(raw.id || `${ctx.planId}__m${ctx.moduleIndex + 1}`, ctx.usedModuleIds, 'module');
  const usedExerciseIds = new Set();
  const exercises = asArray(raw.exercises)
    .map((ex, exerciseIndex) => normalizeExercise(ex, {
      moduleId,
      exerciseIndex,
      usedExerciseIds,
    }));
  return {
    id: moduleId,
    name: cleanText(raw.name) || `模块 ${ctx.moduleIndex + 1}`,
    icon: cleanText(raw.icon) || '•',
    type: cleanText(raw.type) || 'custom',
    exercises,
  };
}

function normalizePlan(rawPlan, ctx) {
  const raw = asObject(rawPlan);
  const planId = ensureUniqueId(raw.id || `plan_${ctx.planIndex + 1}`, ctx.usedPlanIds, 'plan');
  const usedModuleIds = new Set();
  const modules = asArray(raw.modules).map((mod, moduleIndex) => normalizeModule(mod, {
    planId,
    moduleIndex,
    usedModuleIds,
  }));
  return {
    id: planId,
    name: cleanText(raw.name) || `计划 ${ctx.planIndex + 1}`,
    icon: cleanText(raw.icon) || '🏋️',
    stage: cleanText(raw.stage || raw.groupId || ctx.groupId) || ctx.groupId || 'custom',
    modules,
  };
}

function normalizeGroup(rawGroup, ctx) {
  const raw = asObject(rawGroup);
  const id = cleanText(raw.id) || `group_${ctx.groupIndex + 1}`;
  const plans = asArray(raw.plans).map((plan, planIndex) => normalizePlan(plan, {
    groupId: id,
    planIndex,
    usedPlanIds: ctx.usedPlanIds,
  }));
  return {
    id,
    name: cleanText(raw.name) || id,
    subtitle: cleanText(raw.subtitle),
    badge: cleanText(raw.badge),
    color: cleanText(raw.color),
    gradient: cleanText(raw.gradient),
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : ctx.groupIndex + 1,
    plans,
  };
}

function stageToGroup(stage) {
  return {
    id: stage.id,
    name: stage.name,
    subtitle: stage.subtitle,
    badge: stage.badge,
    color: stage.color,
    gradient: stage.gradient,
    order: Number(stage.order) || 1,
    plans: [],
  };
}

function ensureGroup(catalog, groupInfo) {
  const id = cleanText(groupInfo.id) || DEFAULT_CUSTOM_GROUP.id;
  let group = asArray(catalog.planGroups).find(g => g.id === id);
  if (group) return group;
  group = {
    id,
    name: cleanText(groupInfo.name) || id,
    subtitle: cleanText(groupInfo.subtitle),
    badge: cleanText(groupInfo.badge),
    color: cleanText(groupInfo.color),
    gradient: cleanText(groupInfo.gradient),
    order: Number.isFinite(Number(groupInfo.order)) ? Number(groupInfo.order) : 999,
    plans: [],
  };
  catalog.planGroups.push(group);
  return group;
}

function normalizeAiConfig(rawAi) {
  const cfg = asObject(rawAi);
  return {
    deepseekApiKey: cleanText(cfg.deepseekApiKey),
    deepseekModel: cleanText(cfg.deepseekModel) || DEFAULT_AI_MODEL,
  };
}

function normalizeRuntime(rawRuntime) {
  const runtime = asObject(rawRuntime);
  return {
    progress: isObject(runtime.progress) ? runtime.progress : {},
    exerciseRest: isObject(runtime.exerciseRest) ? runtime.exerciseRest : {},
    calendarLogs: isObject(runtime.calendarLogs) ? runtime.calendarLogs : {},
    trainingDate: cleanText(runtime.trainingDate),
    trainingSessionStartAt: Number.isFinite(Number(runtime.trainingSessionStartAt))
      ? Number(runtime.trainingSessionStartAt)
      : null,
  };
}

function normalizeSettings(rawSettings) {
  const settings = asObject(rawSettings);
  return {
    aiConfig: normalizeAiConfig(settings.aiConfig),
  };
}

function sortGroups(planGroups) {
  return asArray(planGroups).sort((a, b) => {
    const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : 999;
    const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : 999;
    if (ao !== bo) return ao - bo;
    return String(a.name).localeCompare(String(b.name), 'zh-CN');
  });
}

function makeEmptyCatalogFromStages() {
  return {
    planGroups: STAGES
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(stageToGroup),
  };
}

export function createEmptyV7Snapshot() {
  return {
    version: V7_VERSION,
    catalog: makeEmptyCatalogFromStages(),
    runtime: {
      progress: {},
      exerciseRest: {},
      calendarLogs: {},
      trainingDate: todayStr(),
      trainingSessionStartAt: null,
    },
    settings: {
      aiConfig: {
        deepseekApiKey: '',
        deepseekModel: DEFAULT_AI_MODEL,
      },
    },
  };
}

export function flattenPlansFromCatalog(catalog) {
  const out = [];
  asArray(catalog?.planGroups).forEach((group) => {
    asArray(group.plans).forEach((plan) => {
      plan.stage = plan.stage || group.id;
      out.push(plan);
    });
  });
  return out;
}

function normalizeCatalog(rawCatalog) {
  const source = asObject(rawCatalog);
  const incomingGroups = asArray(source.planGroups);
  const usedPlanIds = new Set();
  const groups = incomingGroups.map((group, groupIndex) => normalizeGroup(group, { groupIndex, usedPlanIds }));
  const catalog = { planGroups: sortGroups(groups) };
  catalog.planGroups.forEach((group) => {
    group.plans.forEach((plan) => {
      plan.stage = plan.stage || group.id;
    });
  });
  return catalog;
}

export function normalizeV7Snapshot(rawSnapshot, options = {}) {
  const source = asObject(rawSnapshot);
  const fallback = asObject(options.fallbackSnapshot);
  const catalog = normalizeCatalog(source.catalog || fallback.catalog || makeEmptyCatalogFromStages());
  const runtime = normalizeRuntime(source.runtime || fallback.runtime);
  const settings = normalizeSettings(source.settings || fallback.settings);
  return {
    version: V7_VERSION,
    catalog,
    runtime,
    settings,
  };
}

export function validateV7Snapshot(rawSnapshot) {
  try {
    const source = asObject(rawSnapshot);
    if (!isObject(source.catalog) || !Array.isArray(source.catalog.planGroups)) {
      return { ok: false, msg: 'v7 数据缺少 catalog.planGroups' };
    }
    const snapshot = normalizeV7Snapshot(source);
    const totalPlans = flattenPlansFromCatalog(snapshot.catalog).length;
    if (!totalPlans) {
      return { ok: false, msg: 'v7 catalog 为空，至少需要 1 个计划' };
    }
    return { ok: true, snapshot };
  } catch (_err) {
    return { ok: false, msg: 'v7 数据校验失败，请检查 JSON 结构' };
  }
}

export function buildCatalogFromLegacyPlans(legacyPlans, stageDefs = STAGES) {
  const plans = asArray(legacyPlans);
  const catalog = {
    planGroups: stageDefs
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(stageToGroup),
  };
  const usedPlanIds = new Set();

  plans.forEach((plan, idx) => {
    const stageId = cleanText(plan?.stage) || DEFAULT_CUSTOM_GROUP.id;
    const normalizedPlan = normalizePlan(plan, { groupId: stageId, planIndex: idx, usedPlanIds });
    const stageMeta = stageDefs.find(s => s.id === stageId);
    const group = ensureGroup(catalog, stageMeta || DEFAULT_CUSTOM_GROUP);
    normalizedPlan.stage = group.id;
    group.plans.push(normalizedPlan);
  });

  catalog.planGroups = sortGroups(catalog.planGroups);
  return catalog;
}

function findPlanLocation(catalog, planId) {
  for (let gi = 0; gi < asArray(catalog.planGroups).length; gi++) {
    const group = catalog.planGroups[gi];
    for (let pi = 0; pi < asArray(group.plans).length; pi++) {
      if (group.plans[pi].id === planId) {
        return { gi, pi, group, plan: group.plans[pi] };
      }
    }
  }
  return null;
}

export function findPlanGroupByPlanId(catalog, planId) {
  const loc = findPlanLocation(catalog, planId);
  return loc ? loc.group : null;
}

function getExerciseByLegacyIndex(catalog, planId, mi, ei) {
  const loc = findPlanLocation(catalog, planId);
  if (!loc) return null;
  const mod = asArray(loc.plan.modules)[mi];
  if (!mod) return null;
  return asArray(mod.exercises)[ei] || null;
}

function parseLegacyProgressKey(key) {
  const m = String(key || '').match(/^(.*)_(\d+)_(\d+)_s(\d+)$/);
  if (!m) return null;
  return {
    planId: m[1],
    mi: parseInt(m[2], 10),
    ei: parseInt(m[3], 10),
    setIdx: parseInt(m[4], 10),
  };
}

function parseLegacyExerciseKey(key) {
  const m = String(key || '').match(/^(.*)_(\d+)_(\d+)$/);
  if (!m) return null;
  return {
    planId: m[1],
    mi: parseInt(m[2], 10),
    ei: parseInt(m[3], 10),
  };
}

function applyLegacyEdit(exercise, edit) {
  if (!exercise || !isObject(edit)) return;
  const name = cleanText(edit.name);
  if (name) exercise.name = name;
  if (edit.mode === 'timed' || edit.mode === 'counted') exercise.mode = edit.mode;

  const setsByText = typeof edit.sets === 'string' ? parseSetCountFromText(edit.sets) : null;
  if (edit.sets !== undefined) {
    exercise.sets = asPositiveInt(edit.sets, setsByText || exercise.sets || 1);
  }

  if (edit.reps !== undefined) {
    const reps = cleanText(edit.reps);
    if (reps) exercise.reps = reps;
  }

  if (edit.duration !== undefined) {
    exercise.duration = asPositiveInt(edit.duration, exercise.duration || 30);
  }

  if (edit.tip !== undefined) {
    exercise.tip = cleanText(edit.tip);
  }

  if (exercise.mode === 'timed' && !exercise.duration) {
    exercise.duration = 30;
  }
  if (exercise.mode === 'counted' && !cleanText(exercise.reps)) {
    exercise.reps = '12次';
  }
}

function appendLegacyExtraExercise(module, extra) {
  if (!module || !isObject(extra)) return;
  const exercise = normalizeExercise(extra, {
    moduleId: module.id || 'module',
    exerciseIndex: asArray(module.exercises).length,
    usedExerciseIds: new Set(asArray(module.exercises).map(ex => ex.id)),
  });
  module.exercises.push(exercise);
}

function applyLegacyUserEdits(catalog, userEdits) {
  const editsByPlan = asObject(userEdits);
  Object.entries(editsByPlan).forEach(([planId, planEditsRaw]) => {
    const loc = findPlanLocation(catalog, planId);
    if (!loc) return;
    const planEdits = asObject(planEditsRaw);

    Object.entries(planEdits).forEach(([key, edit]) => {
      if (key === '__extraExercises') return;
      const match = key.match(/^(\d+)_(\d+)$/);
      if (!match) return;
      const mi = parseInt(match[1], 10);
      const ei = parseInt(match[2], 10);
      const exercise = asArray(loc.plan.modules?.[mi]?.exercises)[ei];
      applyLegacyEdit(exercise, edit);
    });

    const extrasByModule = asObject(planEdits.__extraExercises);
    Object.entries(extrasByModule).forEach(([moduleIdx, extrasRaw]) => {
      const mi = parseInt(moduleIdx, 10);
      if (!Number.isInteger(mi)) return;
      const module = asObject(loc.plan.modules?.[mi]);
      if (!Array.isArray(module.exercises)) return;
      asArray(extrasRaw).forEach(extra => appendLegacyExtraExercise(module, extra));
    });
  });
}

function mergeLegacyPlansIntoCatalog(baseCatalog, legacyPlans) {
  const catalog = normalizeCatalog(baseCatalog);
  const stageDefs = STAGES;
  const usedPlanIds = new Set(flattenPlansFromCatalog(catalog).map(p => p.id));
  asArray(legacyPlans).forEach((legacyPlan, index) => {
    const stageId = cleanText(legacyPlan?.stage) || DEFAULT_CUSTOM_GROUP.id;
    const rawPlanId = cleanText(legacyPlan?.id);
    const existingByRawId = rawPlanId ? findPlanLocation(catalog, rawPlanId) : null;
    const normalized = normalizePlan(legacyPlan, {
      groupId: stageId,
      planIndex: index,
      usedPlanIds: existingByRawId ? new Set() : usedPlanIds,
    });
    if (existingByRawId) normalized.id = rawPlanId;
    const existing = findPlanLocation(catalog, normalized.id);
    const stageMeta = stageDefs.find(s => s.id === normalized.stage) || DEFAULT_CUSTOM_GROUP;
    const targetGroup = ensureGroup(catalog, stageMeta);
    normalized.stage = targetGroup.id;
    if (existing) {
      existing.group.plans.splice(existing.pi, 1);
    }
    targetGroup.plans.push(normalized);
  });
  catalog.planGroups = sortGroups(catalog.planGroups);
  return catalog;
}

function normalizeCalendarLogs(rawLogs) {
  const logs = asObject(rawLogs);
  const out = {};
  Object.entries(logs).forEach(([date, entries]) => {
    const d = cleanText(date);
    if (!d) return;
    const normalizedEntries = asArray(entries)
      .map((entry) => {
        const item = asObject(entry);
        const planId = cleanText(item.planId);
        const name = cleanText(item.name);
        if (!planId || !name) return null;
        return {
          planId,
          planName: cleanText(item.planName) || '未知计划',
          name,
          exerciseId: cleanText(item.exerciseId),
          time: Number.isFinite(Number(item.time)) ? Number(item.time) : Date.now(),
        };
      })
      .filter(Boolean);
    if (normalizedEntries.length) out[d] = normalizedEntries;
  });
  return out;
}

export function migrateLegacyStateToV7(options = {}) {
  const legacy = asObject(options.legacyState);
  const baseCatalog = options.defaultCatalog && isObject(options.defaultCatalog)
    ? options.defaultCatalog
    : makeEmptyCatalogFromStages();

  const legacyPlans = asArray(legacy.plans);
  let catalog = normalizeCatalog(baseCatalog);
  if (legacyPlans.length) {
    catalog = mergeLegacyPlansIntoCatalog(catalog, legacyPlans);
  }

  applyLegacyUserEdits(catalog, legacy.userEdits);

  const progress = {};
  Object.entries(asObject(legacy.trainingProgress)).forEach(([key, value]) => {
    if (!value) return;
    const parsed = parseLegacyProgressKey(key);
    if (!parsed) {
      progress[key] = !!value;
      return;
    }
    const exercise = getExerciseByLegacyIndex(catalog, parsed.planId, parsed.mi, parsed.ei);
    if (!exercise?.id) return;
    progress[`${exercise.id}_s${parsed.setIdx}`] = true;
  });

  const exerciseRest = {};
  Object.entries(asObject(legacy.exerciseRest)).forEach(([key, value]) => {
    const parsed = parseLegacyExerciseKey(key);
    if (!parsed) {
      const rawKey = cleanText(key);
      if (!rawKey) return;
      exerciseRest[rawKey] = asPositiveInt(value, 60);
      return;
    }
    const exercise = getExerciseByLegacyIndex(catalog, parsed.planId, parsed.mi, parsed.ei);
    if (!exercise?.id) return;
    exerciseRest[exercise.id] = asPositiveInt(value, 60);
  });

  const runtime = {
    progress,
    exerciseRest,
    calendarLogs: normalizeCalendarLogs(legacy.calendarLogs),
    trainingDate: cleanText(legacy.trainingDate) || todayStr(),
    trainingSessionStartAt: Number.isFinite(Number(legacy.trainingSessionStartAt))
      ? Number(legacy.trainingSessionStartAt)
      : null,
  };

  const snapshot = {
    version: V7_VERSION,
    catalog,
    runtime,
    settings: {
      aiConfig: normalizeAiConfig(legacy.aiConfig),
    },
  };
  return normalizeV7Snapshot(snapshot);
}

function regeneratePlanTreeIds(plan, nextPlanId) {
  const rawPlan = asObject(plan);
  const draft = deepClone(rawPlan);
  draft.id = nextPlanId;
  draft.modules = asArray(draft.modules).map((module, mi) => {
    const m = asObject(module);
    const moduleId = `${nextPlanId}__m${mi + 1}`;
    return {
      ...m,
      id: moduleId,
      exercises: asArray(m.exercises).map((exercise, ei) => ({
        ...asObject(exercise),
        id: `${moduleId}__e${ei + 1}`,
      })),
    };
  });
  return normalizePlan(draft, {
    groupId: cleanText(draft.stage) || DEFAULT_CUSTOM_GROUP.id,
    planIndex: 0,
    usedPlanIds: new Set(),
  });
}

export function appendPlanWithNewId(catalog, incomingPlan, finalPlanId) {
  const targetCatalog = normalizeCatalog(catalog);
  const groupId = cleanText(incomingPlan?.stage) || DEFAULT_CUSTOM_GROUP.id;
  const stageMeta = STAGES.find(s => s.id === groupId) || DEFAULT_CUSTOM_GROUP;
  const group = ensureGroup(targetCatalog, stageMeta);
  const rebased = regeneratePlanTreeIds(incomingPlan, finalPlanId);
  rebased.stage = group.id;
  group.plans.push(rebased);
  targetCatalog.planGroups = sortGroups(targetCatalog.planGroups);
  return targetCatalog;
}
