// 唯一的数据模式定义。全仓库只允许这一处版本号：SCHEMA_VERSION。
// 快照结构（localStorage 键 'acl-training'，导入导出文件同构）：
// {
//   version: 9,
//   catalog:  { planGroups: [ { id,name,subtitle,color,order,coaching, plans:[…] } ] },
//   program:  { cycleStart, weekdayPlan:{0-6:planId}, deloadEveryN, deloadWeeks:[weekKey], activeStage },
//   logs:     { calendarLogs, sessionLogs, setLogs, readinessLogs },
//   settings: { theme, vibrate, autoRest, dailyReminder, deloadReminder, ai, backup }
// }
import { MODULE_TYPES, LOAD_KINDS, DEFAULT_PAIN_CEILING } from './config.js';
import { uniqueId } from './id.js';

export const SCHEMA_VERSION = 9;

// ---------- 负荷类型推断（种子升级与旧格式导入共用） ----------
const WEIGHT_EQUIP = /哑铃|杠铃|壶铃|绳索|倒蹬|腿弯举机|推胸机|夹胸机|史密斯|哈克|腿屈伸|地雷管|T杠|划船凳|高位下拉/;
const BAND_EQUIP = /弹力带|阻力带/;
const ASSIST_NAME = /辅助引体|助力/;
const BODYWEIGHT_NAME = /深蹲|弓步|分腿蹲|臀桥|桥式|俯卧撑|提踵|硬拉|RDL|死虫|平板|帕洛夫|哥本哈根|单腿|滑盘|滑行|站立|平衡|行走|侧向踢|引体|面拉|Y-T-W/i;

export function inferLoadKind(exercise, moduleType = 'custom') {
  const equip = (exercise.equipment || []).join('/');
  const name = exercise.name || '';
  if (WEIGHT_EQUIP.test(equip)) return 'weight';
  if (BAND_EQUIP.test(equip) || BAND_EQUIP.test(name)) return 'band';
  if (ASSIST_NAME.test(name) || ASSIST_NAME.test(equip)) return 'assisted';
  if (BODYWEIGHT_NAME.test(name)) return 'bodyweight';
  if (moduleType === 'main' || moduleType === 'core') return 'bodyweight';
  return 'none';
}

// ---------- 动作 ----------
export function normalizeExercise(raw, ctx = {}) {
  const ex = raw || {};
  const moduleType = ctx.moduleType || ex.__moduleType || 'custom';
  const out = {
    id: ex.id || uniqueId('ex', ctx.existingIds || []),
    name: String(ex.name || '未命名动作').trim(),
    mode: ex.mode === 'timed' ? 'timed' : 'counted',
    sets: clampInt(ex.sets, 1, 20, 1)
  };
  if (out.mode === 'timed') {
    if (Number(ex.duration) > 0) out.duration = clampInt(ex.duration, 5, 3600, 60);
  } else {
    out.reps = clampInt(ex.reps, 1, 100, 10);
  }
  const defRest = MODULE_TYPES[moduleType]?.defaultRest ?? 60;
  out.rest = clampInt(ex.rest ?? ex.restBetweenSets, 0, 600, defRest);
  if (ex.sides) out.sides = ex.sides;
  if (ex.tip) out.tip = String(ex.tip);
  out.equipment = Array.isArray(ex.equipment) ? ex.equipment.filter(Boolean) : [];
  out.tags = Array.isArray(ex.tags) ? ex.tags.filter(Boolean) : [];

  const kind = LOAD_KINDS[ex.load?.kind] ? ex.load.kind : inferLoadKind(ex, moduleType);
  out.load = { kind };
  if (ex.load?.level != null && Number.isFinite(Number(ex.load.level))) {
    out.load.level = Math.max(0, Number(ex.load.level));
  }

  const p = ex.prescription;
  out.prescription = p && typeof p === 'object'
    ? { ...p, painCeiling: clampInt(p.painCeiling, 0, 10, DEFAULT_PAIN_CEILING) }
    : { painCeiling: DEFAULT_PAIN_CEILING };
  if (ex.enrichment && typeof ex.enrichment === 'object') out.enrichment = ex.enrichment;
  return out;
}

// ---------- 模块 / 计划 / 分组 ----------
export function normalizeModule(raw, ctx = {}) {
  const mod = raw || {};
  const type = MODULE_TYPES[mod.type] ? mod.type : 'custom';
  const exerciseIds = (Array.isArray(mod.exercises) ? mod.exercises : []).map((e) => e?.id).filter(Boolean);
  return {
    id: mod.id || uniqueId('mod', ctx.existingIds || []),
    name: String(mod.name || '未命名模块').trim(),
    type,
    intent: mod.intent ? String(mod.intent) : '',
    exercises: (Array.isArray(mod.exercises) ? mod.exercises : [])
      .filter((e) => e && typeof e === 'object')
      .map((e) => normalizeExercise({ ...e, __moduleType: type }, { existingIds: exerciseIds }))
  };
}

const COACHING_KEYS = ['objective', 'frequency', 'progressionRule', 'safetyRule', 'readinessCriteria'];
const GROUP_COACHING_KEYS = ['phaseGoal', 'progressCriteria', 'caution'];

function normalizeCoaching(raw, keys) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const k of keys) {
    if (Array.isArray(src[k])) out[k] = src[k].filter(Boolean).map(String);
    else if (src[k] != null && String(src[k]).trim()) out[k] = String(src[k]).trim();
  }
  return out;
}

export function normalizePlan(raw, ctx = {}) {
  const plan = raw || {};
  const moduleIds = (Array.isArray(plan.modules) ? plan.modules : []).map((m) => m?.id).filter(Boolean);
  return {
    id: plan.id || uniqueId('plan', ctx.existingIds || []),
    name: String(plan.name || '未命名计划').trim(),
    stage: plan.stage || ctx.groupId || '',
    coaching: normalizeCoaching(plan.coaching, COACHING_KEYS),
    modules: (Array.isArray(plan.modules) ? plan.modules : [])
      .filter((m) => m && typeof m === 'object')
      .map((m) => normalizeModule(m, { existingIds: moduleIds }))
  };
}

const STAGE_FALLBACK_COLORS = ['#4ADE80', '#FB923C', '#818CF8', '#B4F34D'];

export function normalizeGroup(raw, index = 0) {
  const group = raw || {};
  const planIds = (Array.isArray(group.plans) ? group.plans : []).map((p) => p?.id).filter(Boolean);
  return {
    id: group.id || uniqueId('stage', []),
    name: String(group.name || `阶段 ${index + 1}`).trim(),
    subtitle: group.subtitle ? String(group.subtitle) : '',
    color: group.color || STAGE_FALLBACK_COLORS[index % STAGE_FALLBACK_COLORS.length],
    order: Number.isFinite(Number(group.order)) ? Number(group.order) : index + 1,
    coaching: normalizeCoaching(group.coaching, GROUP_COACHING_KEYS),
    plans: (Array.isArray(group.plans) ? group.plans : [])
      .filter((p) => p && typeof p === 'object')
      .map((p) => normalizePlan(p, { groupId: group.id, existingIds: planIds }))
  };
}

// ---------- 目录（catalog） ----------
// 兼容输入：v9 {version:9, planGroups} / 旧文件 {version:8, catalog:{planGroups}} / 旧 v6 扁平 {plans:[…]}
export function normalizeCatalog(raw, legacyStageDefs = []) {
  let groups = raw?.planGroups || raw?.catalog?.planGroups;
  if (!Array.isArray(groups) && Array.isArray(raw?.plans)) {
    groups = regroupFlatPlans(raw.plans, legacyStageDefs);
  }
  if (!Array.isArray(groups)) groups = [];
  const catalog = { planGroups: groups.map((g, i) => normalizeGroup(g, i)) };
  catalog.planGroups.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
  return catalog;
}

function regroupFlatPlans(plans, stageDefs) {
  const byStage = new Map();
  for (const plan of plans) {
    const stage = plan?.stage || 'stage1';
    if (!byStage.has(stage)) byStage.set(stage, []);
    byStage.get(stage).push(plan);
  }
  const stages = stageDefs.length ? stageDefs : [...byStage.keys()].map((id, i) => ({ id, name: id, subtitle: '', color: STAGE_FALLBACK_COLORS[i % 4] }));
  return stages
    .filter((s) => byStage.has(s.id))
    .map((s, i) => ({ ...s, order: i + 1, plans: byStage.get(s.id) }));
}

export function validateCatalog(catalog) {
  if (!catalog || !Array.isArray(catalog.planGroups) || !catalog.planGroups.length) {
    return { ok: false, msg: '数据缺少计划分组（planGroups）' };
  }
  const ids = new Set();
  for (const g of catalog.planGroups) {
    if (!g.id || !g.name) return { ok: false, msg: '存在缺少 id 或名称的计划分组' };
    if (ids.has(g.id)) return { ok: false, msg: `计划分组 id 重复：${g.id}` };
    ids.add(g.id);
    for (const p of g.plans) {
      if (ids.has(p.id)) return { ok: false, msg: `计划 id 重复：${p.id}` };
      ids.add(p.id);
      if (!Array.isArray(p.modules)) return { ok: false, msg: `计划 ${p.name} 缺少模块列表` };
      for (const m of p.modules) {
        if (ids.has(m.id)) return { ok: false, msg: `模块 id 重复：${m.id}` };
        ids.add(m.id);
        for (const e of m.exercises) {
          if (ids.has(e.id)) return { ok: false, msg: `动作 id 重复：${e.id}` };
          ids.add(e.id);
        }
      }
    }
  }
  return { ok: true, msg: '' };
}

// ---------- 完整快照 ----------
export function mondayOfISO(dateStr, today = new Date()) {
  // 返回给定日期所在周的周一（YYYY-MM-DD）；空值回退到本周一
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : today;
  const day = (d.getDay() + 6) % 7; // 周一=0
  d.setDate(d.getDate() - day);
  return toDateKey(d);
}

export function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function defaultProgram(catalog) {
  const firstGroup = catalog?.planGroups?.[0];
  return {
    cycleStart: mondayOfISO(null),
    weekdayPlan: {},
    deloadEveryN: 4,
    deloadWeeks: [],
    activeStage: firstGroup?.id || null
  };
}

export function defaultSettings() {
  return {
    theme: 'dark',
    vibrate: true,
    autoRest: true,
    dailyReminder: { enabled: false, time: '19:00' },
    deloadReminder: true,
    ai: { apiKey: '', model: 'deepseek-v4-flash' },
    // 备份仓库已预置：新设备只需粘贴一次 fine-grained Token 即全自动备份
    backup: {
      owner: 'beep-bebop',
      repo: 'acl-training-data',
      branch: 'main',
      path: 'acl-training-backup.json',
      auto: true,
      lastBackupAt: '',
      lastStatus: ''
    }
  };
}

export function createEmptySnapshot() {
  return {
    version: SCHEMA_VERSION,
    catalog: { planGroups: [] },
    program: defaultProgram({ planGroups: [] }),
    logs: { calendarLogs: {}, sessionLogs: [], setLogs: [], readinessLogs: [] },
    settings: defaultSettings()
  };
}

export function normalizeSnapshot(raw, legacyStageDefs = []) {
  const empty = createEmptySnapshot();
  if (!raw || typeof raw !== 'object') return empty;
  const catalog = normalizeCatalog(raw.catalog || raw, legacyStageDefs);

  const program = { ...empty.program, ...(raw.program || {}) };
  program.deloadWeeks = Array.isArray(program.deloadWeeks) ? program.deloadWeeks : [];
  program.weekdayPlan = {};
  for (let d = 0; d <= 6; d++) {
    const v = raw.program?.weekdayPlan?.[d];
    if (v) program.weekdayPlan[d] = v;
  }
  if (!catalog.planGroups.some((g) => g.id === program.activeStage)) {
    program.activeStage = catalog.planGroups[0]?.id || null;
  }

  const rawLogs = raw.logs || raw.runtime || {};
  const logs = {
    calendarLogs: rawLogs.calendarLogs && typeof rawLogs.calendarLogs === 'object' ? rawLogs.calendarLogs : {},
    sessionLogs: Array.isArray(rawLogs.sessionLogs) ? rawLogs.sessionLogs : [],
    setLogs: Array.isArray(rawLogs.setLogs) ? rawLogs.setLogs : [],
    readinessLogs: Array.isArray(rawLogs.readinessLogs) ? rawLogs.readinessLogs : []
  };

  const s = raw.settings || {};
  const mergedBackup = { ...defaultSettings().backup, ...(s.backup || s.githubBackup || {}) };
  // 迁移旧数据时，空配置回落到预置仓库
  if (!String(mergedBackup.owner || '').trim()) mergedBackup.owner = defaultSettings().backup.owner;
  if (!String(mergedBackup.repo || '').trim()) mergedBackup.repo = defaultSettings().backup.repo;
  const settings = {
    ...defaultSettings(),
    ...pick(s, ['theme', 'vibrate', 'autoRest', 'deloadReminder']),
    dailyReminder: { ...defaultSettings().dailyReminder, ...(s.dailyReminder || {}) },
    ai: { ...defaultSettings().ai, ...(s.ai || s.aiConfig ? { ...(s.ai || {}), ...(s.aiConfig ? { apiKey: s.aiConfig.deepseekApiKey || '', model: s.aiConfig.deepseekModel || 'deepseek-v4-flash' } : {}) } : {}) },
    backup: mergedBackup
  };
  if (!['dark', 'light', 'system'].includes(settings.theme)) settings.theme = 'dark';

  return { version: SCHEMA_VERSION, catalog, program, logs, settings };
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
