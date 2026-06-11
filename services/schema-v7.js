// ACL schema/migration helpers. Function names keep v7 for compatibility.
import { STAGES } from '../data/config.js';

export const V7_VERSION = 8;
export const SCHEMA_VERSION = V7_VERSION;
export const DEFAULT_AI_MODEL = 'deepseek-v4-flash';

const DEFAULT_CUSTOM_GROUP = {
  id: 'custom',
  name: '自定义计划',
  subtitle: '导入与自建',
  badge: '+',
  coverEmoji: '🧩',
  coverImage: '',
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

function normalizeCoverImage(value) {
  const text = cleanText(value);
  if (!text) return '';
  if (/^data:image\//i.test(text)) return text;
  if (/^https?:\/\//i.test(text)) return text;
  return '';
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

function normalizeTextBlock(raw, fallback = '') {
  const text = cleanText(raw);
  return text || fallback;
}

function inferMovementPattern(name, moduleType) {
  const text = `${name} ${moduleType}`.toLowerCase();
  if (/深蹲|蹲|倒蹬|腿伸展|leg extension|quad|股四/.test(text)) return 'knee-dominant';
  if (/硬拉|rdl|腿弯举|腘绳|髋铰链|臀桥|hamstring|hinge/.test(text)) return 'hip-dominant';
  if (/单腿|分腿|弓步|平衡|侧向|抛接球/.test(text)) return 'single-leg-control';
  if (/卧推|推胸|推举|下压|肩/.test(text)) return 'upper-push';
  if (/划船|下拉|引体|面拉|弯举/.test(text)) return 'upper-pull';
  if (/死虫|帕洛夫|核心|伐木|抬腿|抗旋/.test(text)) return 'core-control';
  if (/泡沫轴|按摩|松解/.test(text) || moduleType === 'warmup') return 'soft-tissue';
  if (/拉伸|stretch/.test(text) || moduleType === 'stretch') return 'mobility';
  if (moduleType === 'activate') return 'activation';
  if (moduleType === 'cardio') return 'conditioning';
  return 'general-strength';
}

function inferTargetTissue(name, tags) {
  const text = `${name} ${asArray(tags).join(' ')}`;
  if (/ACL|膝|股四|腿伸展|倒蹬|蹲|BFR/.test(text)) return '膝关节控制 / 股四头肌';
  if (/腘绳|腿弯举|硬拉|RDL/.test(text)) return '腘绳肌 / 髋后链';
  if (/臀|侧向|髋/.test(text)) return '臀肌 / 髋稳定';
  if (/踝|小腿|提踵|足底/.test(text)) return '踝足小腿链';
  if (/胸|肩|推|卧推/.test(text)) return '上肢推力链';
  if (/背|划船|下拉|引体|面拉/.test(text)) return '上肢拉力链';
  if (/核心|死虫|帕洛夫|伐木|抬腿/.test(text)) return '核心抗伸展/抗旋';
  if (/泡沫轴|按摩|拉伸|放松/.test(text)) return '软组织与活动度';
  return '全身协调';
}

function inferIntensity(raw, moduleType) {
  const text = `${raw.name || ''} ${raw.tip || ''} ${raw.reps || ''}`;
  if (/BFR|血流限制/.test(text)) return '20-30% 1RM / BFR 低负荷';
  if (/极轻|无负重|预演/.test(text)) return '极轻负荷 / 技术质量优先';
  if (/大重量|负重|6-8/.test(text)) return '中高强度 / 保留1-3次余力';
  if (moduleType === 'warmup' || moduleType === 'stretch') return '低强度 / 放松与活动度';
  if (moduleType === 'activate') return '低到中等强度 / 神经激活';
  if (moduleType === 'main') return '中等强度 / 动作质量优先';
  return '舒适可控强度';
}

function inferTargetRpe(raw, moduleType) {
  const text = `${raw.name || ''} ${raw.tip || ''} ${raw.reps || ''}`;
  if (/BFR|血流限制|极轻|无负重/.test(text)) return '5-6';
  if (/大重量|负重|6-8/.test(text)) return '7-8';
  if (moduleType === 'warmup' || moduleType === 'stretch') return '2-4';
  if (moduleType === 'activate') return '4-6';
  return '6-7';
}

function inferTempo(raw, moduleType) {
  const text = `${raw.name || ''} ${raw.tip || ''}`;
  if (/离心|慢放|控制/.test(text)) return '离心2-3秒，向心稳定发力';
  if (/静力|保持/.test(text)) return '静力保持，均匀呼吸';
  if (moduleType === 'warmup' || moduleType === 'stretch') return '缓慢连续，不弹震';
  return '全程可控，避免借力';
}

function inferProgression(raw, moduleType) {
  const text = `${raw.name || ''} ${raw.tip || ''}`;
  if (/BFR|血流限制/.test(text)) return '先完成规定次数与泵感，再小幅增加负荷或张力';
  if (/单腿|平衡|侧向|抛接球/.test(text)) return '先提高稳定时间和质量，再增加速度、扰动或负重';
  if (moduleType === 'stretch' || moduleType === 'warmup') return '以活动度和疼痛反应改善为进阶依据';
  return '连续两次训练完成目标次数且疼痛不升高时小幅进阶';
}

function inferRegression(raw, moduleType) {
  const text = `${raw.name || ''} ${raw.tip || ''}`;
  if (/单腿|平衡|侧向|抛接球/.test(text)) return '减少幅度、改为双腿支撑或增加手扶辅助';
  if (/深蹲|弓步|倒蹬|腿伸展/.test(text)) return '减少屈膝角度、降低负荷或改为等长版本';
  if (moduleType === 'main') return '降低负荷、减少组数或缩小动作幅度';
  return '降低持续时间或改为更舒适版本';
}

function inferTrackingMetric(raw, moduleType) {
  const text = `${raw.name || ''} ${raw.tip || ''}`;
  if (/BFR|血流限制/.test(text)) return '完成质量、疼痛反应、患侧泵感';
  if (/单腿|平衡|侧向/.test(text)) return '稳定时间、膝内扣次数、疼痛反应';
  if (/拉伸|泡沫轴|按摩/.test(text) || moduleType === 'stretch' || moduleType === 'warmup') return '活动度改善、压痛变化、训练后反应';
  return '完成组数、主观用力、疼痛反应';
}

function normalizePrescription(rawPrescription, rawExercise, moduleType) {
  const src = asObject(rawPrescription);
  const exercise = asObject(rawExercise);
  const name = cleanText(exercise.name);
  const painCeiling = Number(src.painCeiling);
  return {
    movementPattern: normalizeTextBlock(src.movementPattern, inferMovementPattern(name, moduleType)),
    targetTissue: normalizeTextBlock(src.targetTissue, inferTargetTissue(name, exercise.tags)),
    intensity: normalizeTextBlock(src.intensity, inferIntensity(exercise, moduleType)),
    targetRpe: normalizeTextBlock(src.targetRpe, inferTargetRpe(exercise, moduleType)),
    tempo: normalizeTextBlock(src.tempo, inferTempo(exercise, moduleType)),
    painCeiling: Number.isFinite(painCeiling) ? Math.max(0, Math.min(10, Math.floor(painCeiling))) : 3,
    stopCriteria: uniqueStrings(asArray(src.stopCriteria)).length
      ? uniqueStrings(asArray(src.stopCriteria))
      : ['疼痛超过3/10', '出现肿胀或不稳感', '动作质量明显下降'],
    progression: normalizeTextBlock(src.progression, inferProgression(exercise, moduleType)),
    regression: normalizeTextBlock(src.regression, inferRegression(exercise, moduleType)),
    trackingMetric: normalizeTextBlock(src.trackingMetric, inferTrackingMetric(exercise, moduleType)),
  };
}

function normalizePlanCoaching(rawCoaching, rawPlan, groupId) {
  const coaching = asObject(rawCoaching);
  const name = cleanText(rawPlan?.name);
  const isRest = groupId === 'restday' || /休息|恢复|rest/i.test(name);
  return {
    objective: normalizeTextBlock(
      coaching.objective,
      isRest ? '降低疲劳、恢复活动度并维持训练连续性' : '在保护膝关节的前提下提升力量、控制与训练容量'
    ),
    frequency: normalizeTextBlock(coaching.frequency, isRest ? '穿插在训练日之间或疲劳较高时执行' : '按周计划执行，疼痛/肿胀异常时优先降级或休息'),
    progressionRule: normalizeTextBlock(coaching.progressionRule, '连续两次完成目标量且疼痛不超过3/10时，再增加负荷、次数或动作复杂度'),
    safetyRule: normalizeTextBlock(coaching.safetyRule, '训练中避免膝内扣、明显代偿、关节肿胀和失稳感'),
    readinessCriteria: uniqueStrings(asArray(coaching.readinessCriteria)).length
      ? uniqueStrings(asArray(coaching.readinessCriteria))
      : ['静息疼痛≤2/10', '训练后24小时无明显肿胀', '动作质量可控'],
  };
}

function normalizeGroupCoaching(rawCoaching, groupId) {
  const coaching = asObject(rawCoaching);
  const defaults = {
    stage1: {
      phaseGoal: '恢复基础活动度、股四头肌激活和低风险力量耐受',
      progressCriteria: ['静息疼痛≤2/10', '训练后24小时无明显肿胀', '基础深蹲/倒蹬力线稳定'],
      caution: '避免高冲击、快速变向和疼痛驱动的硬顶训练',
    },
    stage2: {
      phaseGoal: '建立单腿力量、动态稳定、抗旋控制和渐进负荷能力',
      progressCriteria: ['单腿动作膝盖稳定', '训练容量可恢复', '左右侧主观控制差距缩小'],
      caution: '速度、深度、负荷每次只进阶一个变量',
    },
    restday: {
      phaseGoal: '恢复疲劳、维持活动度并监控疼痛/肿胀反应',
      progressCriteria: ['疲劳下降', '活动度恢复', '下一次训练准备度提升'],
      caution: '休息日不追求训练刺激，优先恢复质量',
    },
  };
  const base = defaults[groupId] || {
    phaseGoal: '保持训练连续性并逐步提高动作质量',
    progressCriteria: ['动作质量稳定', '训练后反应可控'],
    caution: '按疼痛和恢复情况调整训练量',
  };
  return {
    phaseGoal: normalizeTextBlock(coaching.phaseGoal, base.phaseGoal),
    progressCriteria: uniqueStrings(asArray(coaching.progressCriteria)).length
      ? uniqueStrings(asArray(coaching.progressCriteria))
      : base.progressCriteria,
    caution: normalizeTextBlock(coaching.caution, base.caution),
  };
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
    prescription: normalizePrescription(raw.prescription, raw, ctx.moduleType),
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
  const moduleType = cleanText(raw.type) || 'custom';
  const usedExerciseIds = new Set();
  const exercises = asArray(raw.exercises)
    .map((ex, exerciseIndex) => normalizeExercise(ex, {
      moduleId,
      moduleType,
      exerciseIndex,
      usedExerciseIds,
    }));
  return {
    id: moduleId,
    name: cleanText(raw.name) || `模块 ${ctx.moduleIndex + 1}`,
    icon: cleanText(raw.icon) || '•',
    type: moduleType,
    intent: normalizeTextBlock(raw.intent, moduleType === 'main' ? '主要训练刺激' : '为主训练建立更好的动作状态'),
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
    coaching: normalizePlanCoaching(raw.coaching, raw, cleanText(raw.stage || raw.groupId || ctx.groupId) || ctx.groupId || 'custom'),
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
    coverEmoji: cleanText(raw.coverEmoji || raw.badge),
    coverImage: normalizeCoverImage(raw.coverImage),
    color: cleanText(raw.color),
    gradient: cleanText(raw.gradient),
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : ctx.groupIndex + 1,
    coaching: normalizeGroupCoaching(raw.coaching, id),
    plans,
  };
}

function stageToGroup(stage) {
  return {
    id: stage.id,
    name: stage.name,
    subtitle: stage.subtitle,
    badge: stage.badge,
    coverEmoji: stage.badge,
    coverImage: '',
    color: stage.color,
    gradient: stage.gradient,
    order: Number(stage.order) || 1,
    coaching: normalizeGroupCoaching(stage.coaching, stage.id),
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
    coverEmoji: cleanText(groupInfo.coverEmoji || groupInfo.badge),
    coverImage: normalizeCoverImage(groupInfo.coverImage),
    color: cleanText(groupInfo.color),
    gradient: cleanText(groupInfo.gradient),
    order: Number.isFinite(Number(groupInfo.order)) ? Number(groupInfo.order) : 999,
    coaching: normalizeGroupCoaching(groupInfo.coaching, id),
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

function normalizeSyncMeta(rawSyncMeta) {
  const meta = asObject(rawSyncMeta);
  return {
    lastSyncAt: cleanText(meta.lastSyncAt),
    lastSource: cleanText(meta.lastSource),
    lastRemoteHash: cleanText(meta.lastRemoteHash),
    lastSummary: cleanText(meta.lastSummary),
  };
}

function normalizeGitHubBackup(rawGitHubBackup) {
  const cfg = asObject(rawGitHubBackup);
  return {
    owner: cleanText(cfg.owner),
    repo: cleanText(cfg.repo),
    branch: cleanText(cfg.branch) || 'main',
    path: cleanText(cfg.path) || 'acl-training-backup.json',
    lastBackupAt: cleanText(cfg.lastBackupAt),
    lastRestoreAt: cleanText(cfg.lastRestoreAt),
    lastCommitSha: cleanText(cfg.lastCommitSha),
    lastAutoBackupStatus: cleanText(cfg.lastAutoBackupStatus),
  };
}

function normalizeRuntime(rawRuntime) {
  const runtime = asObject(rawRuntime);
  return {
    progress: isObject(runtime.progress) ? runtime.progress : {},
    exerciseRest: isObject(runtime.exerciseRest) ? runtime.exerciseRest : {},
    calendarLogs: isObject(runtime.calendarLogs) ? runtime.calendarLogs : {},
    sessionLogs: asArray(runtime.sessionLogs).map((entry) => {
      const item = asObject(entry);
      return {
        date: cleanText(item.date),
        planId: cleanText(item.planId),
        planName: cleanText(item.planName),
        durationSeconds: asPositiveInt(item.durationSeconds, 0),
        completedSets: asPositiveInt(item.completedSets, 0),
        totalSets: asPositiveInt(item.totalSets, 0),
        completedExercises: asPositiveInt(item.completedExercises, 0),
        totalExercises: asPositiveInt(item.totalExercises, 0),
        completedPlan: !!item.completedPlan,
      };
    }).filter(item => item.date && item.planId),
    readinessLogs: asArray(runtime.readinessLogs).map((entry) => {
      const item = asObject(entry);
      return {
        date: cleanText(item.date),
        pain: Number.isFinite(Number(item.pain)) ? Math.max(0, Math.min(10, Math.floor(Number(item.pain)))) : null,
        swelling: cleanText(item.swelling),
        fatigue: Number.isFinite(Number(item.fatigue)) ? Math.max(0, Math.min(10, Math.floor(Number(item.fatigue)))) : null,
        sleepQuality: Number.isFinite(Number(item.sleepQuality)) ? Math.max(0, Math.min(10, Math.floor(Number(item.sleepQuality)))) : null,
        notes: cleanText(item.notes),
      };
    }).filter(item => item.date),
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
    syncMeta: normalizeSyncMeta(settings.syncMeta),
    githubBackup: normalizeGitHubBackup(settings.githubBackup),
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
      sessionLogs: [],
      readinessLogs: [],
      trainingDate: todayStr(),
      trainingSessionStartAt: null,
    },
    settings: {
      aiConfig: {
        deepseekApiKey: '',
        deepseekModel: DEFAULT_AI_MODEL,
      },
      syncMeta: {
        lastSyncAt: '',
        lastSource: '',
        lastRemoteHash: '',
        lastSummary: '',
      },
      githubBackup: {
        owner: '',
        repo: '',
        branch: 'main',
        path: 'acl-training-backup.json',
        lastBackupAt: '',
        lastRestoreAt: '',
        lastCommitSha: '',
        lastAutoBackupStatus: '',
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
      return { ok: false, msg: 'v8 数据缺少 catalog.planGroups' };
    }
    const snapshot = normalizeV7Snapshot(source);
    const totalPlans = flattenPlansFromCatalog(snapshot.catalog).length;
    if (!totalPlans) {
      return { ok: false, msg: 'v8 catalog 为空，至少需要 1 个计划' };
    }
    return { ok: true, snapshot };
  } catch (_err) {
    return { ok: false, msg: 'v8 数据校验失败，请检查 JSON 结构' };
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
    sessionLogs: [],
    readinessLogs: [],
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
      githubBackup: normalizeGitHubBackup(legacy.githubBackup),
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
