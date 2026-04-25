// 计划加载与管理
import { CATALOG_V7_FILE, PLAN_FILES, STAGES } from '../data/config.js';
import { state } from '../core/state.js';
import { loadFromStorage, saveToStorage } from '../core/storage.js';
import { todayStr } from '../utils/helpers.js';
import {
  V7_VERSION,
  createEmptyV7Snapshot,
  normalizeV7Snapshot,
  validateV7Snapshot,
  buildCatalogFromLegacyPlans,
  flattenPlansFromCatalog,
  migrateLegacyStateToV7,
  appendPlanWithNewId,
  findPlanGroupByPlanId,
} from './schema-v7.js';

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildSyncSummary({ remoteAdded, remoteUpdated, localOnlyKept }) {
  return `新增 ${remoteAdded}，覆盖 ${remoteUpdated}，保留本地 ${localOnlyKept}`;
}

async function computeSha256(text) {
  try {
    const bytes = new TextEncoder().encode(String(text || ''));
    const buffer = await crypto.subtle.digest('SHA-256', bytes);
    const array = Array.from(new Uint8Array(buffer));
    return array.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (_err) {
    return '';
  }
}

function normalizeCoverImage(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^data:image\//i.test(text)) return text;
  if (/^https?:\/\//i.test(text)) return text;
  return '';
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
    order: stage.order,
    plans: [],
  };
}

function ensureGroup(catalog, sourceGroup) {
  const id = String(sourceGroup?.id || '').trim() || 'custom';
  let group = (catalog.planGroups || []).find(g => g.id === id);
  if (group) return group;
  group = {
    id,
    name: String(sourceGroup?.name || id),
    subtitle: String(sourceGroup?.subtitle || ''),
    badge: String(sourceGroup?.badge || ''),
    coverEmoji: String(sourceGroup?.coverEmoji || sourceGroup?.badge || ''),
    coverImage: normalizeCoverImage(sourceGroup?.coverImage),
    color: String(sourceGroup?.color || '#8E8E93'),
    gradient: String(sourceGroup?.gradient || '#8E8E93'),
    order: Number(sourceGroup?.order) || 999,
    plans: [],
  };
  catalog.planGroups.push(group);
  return group;
}

function findPlanLocation(catalog, planId) {
  for (let gi = 0; gi < (catalog.planGroups || []).length; gi++) {
    const group = catalog.planGroups[gi];
    for (let pi = 0; pi < (group.plans || []).length; pi++) {
      if (group.plans[pi].id === planId) {
        return { gi, pi, group };
      }
    }
  }
  return null;
}

function collectExerciseIds(catalog) {
  const ids = new Set();
  (catalog.planGroups || []).forEach((group) => {
    (group.plans || []).forEach((plan) => {
      (plan.modules || []).forEach((module) => {
        (module.exercises || []).forEach((ex) => {
          if (ex?.id) ids.add(ex.id);
        });
      });
    });
  });
  return ids;
}

function collectPlanIds(catalog) {
  const ids = new Set();
  (catalog.planGroups || []).forEach((group) => {
    (group.plans || []).forEach((plan) => ids.add(plan.id));
  });
  return ids;
}

function mergeRemoteCatalogWithLocalExtras(remoteCatalog, localCatalog) {
  const merged = deepClone(remoteCatalog || { planGroups: [] });
  const remotePlanIds = collectPlanIds(remoteCatalog || { planGroups: [] });
  const localPlans = flattenPlansFromCatalog(localCatalog || { planGroups: [] });
  localPlans.forEach((plan) => {
    if (!plan?.id || remotePlanIds.has(plan.id)) return;
    const localGroup = findPlanGroupByPlanId(localCatalog, plan.id);
    const targetGroup = ensureGroup(
      merged,
      localGroup || {
        id: plan.stage || 'custom',
        name: plan.stage || 'custom',
        subtitle: '',
        order: 999,
      }
    );
    const nextPlan = deepClone(plan);
    nextPlan.stage = targetGroup.id;
    targetGroup.plans.push(nextPlan);
  });
  merged.planGroups.sort((a, b) => (a.order || 999) - (b.order || 999));
  return merged;
}

function pruneRuntimeByCatalog(runtime, catalog) {
  const exerciseIds = collectExerciseIds(catalog);
  const planIds = collectPlanIds(catalog);
  const nextRuntime = deepClone(runtime || {});
  nextRuntime.progress = Object.fromEntries(
    Object.entries(nextRuntime.progress || {}).filter(([key, value]) => {
      if (!value) return false;
      const m = String(key).match(/^(.*)_s\d+$/);
      if (!m) return false;
      return exerciseIds.has(m[1]);
    })
  );
  nextRuntime.exerciseRest = Object.fromEntries(
    Object.entries(nextRuntime.exerciseRest || {}).filter(([key]) => exerciseIds.has(key))
  );
  nextRuntime.calendarLogs = Object.fromEntries(
    Object.entries(nextRuntime.calendarLogs || {}).map(([date, logs]) => {
      const nextLogs = (Array.isArray(logs) ? logs : []).filter(log => planIds.has(log.planId));
      return [date, nextLogs];
    }).filter(([, logs]) => logs.length)
  );
  return nextRuntime;
}

function rebuildFlattenPlans() {
  state.plans = flattenPlansFromCatalog(state.catalog);
}

function applySnapshotToState(snapshotInput) {
  const snapshot = normalizeV7Snapshot(snapshotInput, { fallbackSnapshot: createEmptyV7Snapshot() });
  state.catalog = snapshot.catalog;
  state.runtime = snapshot.runtime;
  state.settings = snapshot.settings;
  rebuildFlattenPlans();

  if (state.currentPlanId && !state.plans.some(p => p.id === state.currentPlanId)) {
    state.currentPlanId = null;
    state.runtime.trainingSessionStartAt = null;
  }
}

function validateLegacyImportData(data) {
  if (!isPlainObject(data) || !Array.isArray(data.plans)) {
    return { ok: false, msg: '数据格式不正确，需要 { version: 6, plans: [...] }' };
  }
  for (let pi = 0; pi < data.plans.length; pi++) {
    const plan = data.plans[pi];
    if (!isPlainObject(plan) || !plan.id || !Array.isArray(plan.modules)) {
      return { ok: false, msg: `第 ${pi + 1} 个计划结构不完整（缺少 id/modules）` };
    }
  }
  return { ok: true };
}

async function fetchLegacyDefaultPlans() {
  const allPlans = [];
  for (const file of PLAN_FILES) {
    try {
      const resp = await fetch(file);
      if (!resp.ok) continue;
      const data = await resp.json();
      if (Array.isArray(data?.plans)) allPlans.push(...data.plans);
    } catch (_err) {
      // ignore and continue
    }
  }
  return allPlans;
}

async function loadDefaultSnapshot() {
  if (state.defaultCatalogCache) return deepClone(state.defaultCatalogCache);

  let snapshot = null;

  // 1) 优先读取 v7 canonical 文件
  try {
    const resp = await fetch(CATALOG_V7_FILE);
    if (resp.ok) {
      const data = await resp.json();
      const validated = validateV7Snapshot(data);
      if (validated.ok) {
        snapshot = validated.snapshot;
      }
    }
  } catch (_err) {
    // fallback to legacy files
  }

  // 2) 若 v7 文件暂无计划，回退到 legacy 默认计划自动升维
  if (!snapshot || !flattenPlansFromCatalog(snapshot.catalog).length) {
    const legacyPlans = await fetchLegacyDefaultPlans();
    const catalog = buildCatalogFromLegacyPlans(legacyPlans, STAGES);
    snapshot = normalizeV7Snapshot({
      version: V7_VERSION,
      catalog,
      runtime: createEmptyV7Snapshot().runtime,
      settings: createEmptyV7Snapshot().settings,
    });
  }

  state.defaultCatalogCache = deepClone(snapshot);
  return deepClone(snapshot);
}

export async function loadDefaultCatalogSnapshot() {
  return loadDefaultSnapshot();
}

export async function loadDefaultPlans() {
  const snapshot = await loadDefaultSnapshot();
  return flattenPlansFromCatalog(snapshot.catalog);
}

export function getCurrentSnapshot() {
  return normalizeV7Snapshot({
    version: V7_VERSION,
    catalog: state.catalog,
    runtime: state.runtime,
    settings: state.settings,
  });
}

function ensureDailyReset() {
  const today = todayStr();
  if (state.runtime.trainingDate !== today) {
    state.runtime.progress = {};
    state.runtime.trainingDate = today;
    state.runtime.trainingSessionStartAt = null;
  }
}

function mergeCalendarLogs(baseLogs, incomingLogs) {
  const merged = deepClone(baseLogs || {});
  Object.entries(incomingLogs || {}).forEach(([date, logs]) => {
    const current = Array.isArray(merged[date]) ? merged[date] : [];
    const seen = new Set(current.map(l => `${l.planId}|${l.name}|${l.time}`));
    (Array.isArray(logs) ? logs : []).forEach((log) => {
      const key = `${log.planId}|${log.name}|${log.time}`;
      if (seen.has(key)) return;
      seen.add(key);
      current.push(log);
    });
    merged[date] = current;
  });
  return merged;
}

function normalizeIncomingSnapshot(data) {
  // v7
  if (isPlainObject(data?.catalog) || data?.version === 7) {
    const validated = validateV7Snapshot(data);
    return validated.ok ? validated : { ok: false, msg: validated.msg };
  }

  // v6
  const legacy = validateLegacyImportData(data);
  if (!legacy.ok) return legacy;
  const migrated = migrateLegacyStateToV7({
    defaultCatalog: { planGroups: STAGES.map(stageToGroup) },
    legacyState: data,
  });
  return { ok: true, snapshot: migrated };
}

function buildRemoteMergePreviewStats(localCatalog, remoteCatalog) {
  const localIds = collectPlanIds(localCatalog || { planGroups: [] });
  const remoteIds = collectPlanIds(remoteCatalog || { planGroups: [] });
  let remoteAdded = 0;
  let remoteUpdated = 0;
  let localOnlyKept = 0;

  remoteIds.forEach((id) => {
    if (localIds.has(id)) remoteUpdated++;
    else remoteAdded++;
  });
  localIds.forEach((id) => {
    if (!remoteIds.has(id)) localOnlyKept++;
  });

  return {
    remoteTotal: remoteIds.size,
    remoteAdded,
    remoteUpdated,
    localOnlyKept,
  };
}

export async function previewRemoteCatalogMerge(sourceUrl = CATALOG_V7_FILE) {
  const source = String(sourceUrl || CATALOG_V7_FILE).trim() || CATALOG_V7_FILE;
  const reqUrl = source.includes('?') ? `${source}&_sync=${Date.now()}` : `${source}?_sync=${Date.now()}`;
  let rawText = '';
  let parsed;

  try {
    const resp = await fetch(reqUrl, { cache: 'no-store' });
    if (!resp.ok) {
      return { ok: false, msg: `拉取失败（HTTP ${resp.status}）` };
    }
    rawText = await resp.text();
    parsed = JSON.parse(rawText);
  } catch (_err) {
    return { ok: false, msg: '拉取或解析远程数据失败，请检查地址与网络。' };
  }

  const defaults = createEmptyV7Snapshot();
  const candidate = isPlainObject(parsed?.catalog) || parsed?.version === 7
    ? parsed
    : {
      version: V7_VERSION,
      catalog: parsed,
      runtime: defaults.runtime,
      settings: defaults.settings,
    };
  const validated = validateV7Snapshot(candidate);
  if (!validated.ok) return { ok: false, msg: `远程数据不符合 v7：${validated.msg}` };

  const remoteCatalog = validated.snapshot.catalog;
  const mergedCatalog = mergeRemoteCatalogWithLocalExtras(remoteCatalog, state.catalog);
  const stats = buildRemoteMergePreviewStats(state.catalog, remoteCatalog);
  const remoteHash = await computeSha256(rawText);
  const fetchedAt = new Date().toISOString();

  return {
    ok: true,
    sourceUrl: source,
    fetchedAt,
    remoteHash,
    remoteCatalog,
    mergedCatalog,
    ...stats,
    summary: buildSyncSummary(stats),
  };
}

export function applyRemoteCatalogMerge(preview) {
  if (!preview?.ok || !preview?.mergedCatalog) {
    return { ok: false, msg: '没有可应用的远程预览数据' };
  }

  const current = getCurrentSnapshot();
  const next = deepClone(current);
  next.catalog = deepClone(preview.mergedCatalog);
  next.runtime = pruneRuntimeByCatalog(current.runtime, next.catalog);
  if (!next.settings) next.settings = {};
  if (!next.settings.syncMeta || typeof next.settings.syncMeta !== 'object') {
    next.settings.syncMeta = {};
  }
  next.settings.syncMeta.lastSyncAt = String(preview.fetchedAt || new Date().toISOString());
  next.settings.syncMeta.lastSource = String(preview.sourceUrl || CATALOG_V7_FILE);
  next.settings.syncMeta.lastRemoteHash = String(preview.remoteHash || '');
  next.settings.syncMeta.lastSummary = buildSyncSummary({
    remoteAdded: Number(preview.remoteAdded) || 0,
    remoteUpdated: Number(preview.remoteUpdated) || 0,
    localOnlyKept: Number(preview.localOnlyKept) || 0,
  });

  applySnapshotToState(next);
  saveToStorage();
  return {
    ok: true,
    ...buildRemoteMergePreviewStats(current.catalog, preview.remoteCatalog || { planGroups: [] }),
    summary: next.settings.syncMeta.lastSummary,
  };
}

export async function loadState() {
  try {
    const defaults = await loadDefaultSnapshot();
    const stored = loadFromStorage();
    let snapshot;

    if (!stored) {
      snapshot = defaults;
    } else if (stored.__storageVersion === 7 || stored.version === 7 || stored.catalog) {
      const validated = validateV7Snapshot(stored);
      snapshot = validated.ok ? validated.snapshot : defaults;
    } else {
      snapshot = migrateLegacyStateToV7({
        defaultCatalog: defaults.catalog,
        legacyState: stored,
      });
    }

    applySnapshotToState(snapshot);
    ensureDailyReset();
    saveToStorage();
    state.dataLoaded = true;
  } catch (e) {
    console.error('[loadState] 出错:', e);
    const defaults = await loadDefaultSnapshot();
    applySnapshotToState(defaults);
    ensureDailyReset();
    state.dataLoaded = true;
  }
}

export function importPlans(json, mergeStrategy = 'merge') {
  let data;
  try {
    data = typeof json === 'string' ? JSON.parse(json) : json;
  } catch (_e) {
    return { ok: false, msg: 'JSON 格式错误' };
  }

  const incoming = normalizeIncomingSnapshot(data);
  if (!incoming.ok) return incoming;

  const current = getCurrentSnapshot();
  const next = deepClone(current);
  const incomingSnapshot = incoming.snapshot;
  const incomingPlans = flattenPlansFromCatalog(incomingSnapshot.catalog);
  let imported = 0;
  let updated = 0;

  if (mergeStrategy === 'replace') {
    next.catalog = deepClone(incomingSnapshot.catalog);
    next.runtime = deepClone(incomingSnapshot.runtime);
    next.settings = deepClone(incomingSnapshot.settings);
    imported = incomingPlans.length;
  } else if (mergeStrategy === 'merge') {
    const catalog = deepClone(current.catalog);
    incomingPlans.forEach((plan) => {
      const incomingGroup = findPlanGroupByPlanId(incomingSnapshot.catalog, plan.id);
      const existing = findPlanLocation(catalog, plan.id);
      const targetGroup = ensureGroup(catalog, incomingGroup || { id: plan.stage || 'custom', name: plan.stage || 'custom' });
      const nextPlan = deepClone(plan);
      nextPlan.stage = targetGroup.id;
      if (existing) {
        if (existing.group.id === targetGroup.id) {
          existing.group.plans.splice(existing.pi, 1, nextPlan);
        } else {
          existing.group.plans.splice(existing.pi, 1);
          targetGroup.plans.push(nextPlan);
        }
        updated++;
      } else {
        targetGroup.plans.push(nextPlan);
        imported++;
      }
    });
    catalog.planGroups.sort((a, b) => (a.order || 999) - (b.order || 999));
    next.catalog = catalog;
    next.runtime = {
      ...current.runtime,
      progress: { ...(current.runtime.progress || {}), ...(incomingSnapshot.runtime.progress || {}) },
      exerciseRest: { ...(current.runtime.exerciseRest || {}), ...(incomingSnapshot.runtime.exerciseRest || {}) },
      calendarLogs: mergeCalendarLogs(current.runtime.calendarLogs, incomingSnapshot.runtime.calendarLogs),
    };
    next.settings = {
      ...current.settings,
      aiConfig: {
        ...(current.settings.aiConfig || {}),
        ...(incomingSnapshot.settings.aiConfig || {}),
      },
    };
  } else {
    let catalog = deepClone(current.catalog);
    const existingIds = collectPlanIds(catalog);
    incomingPlans.forEach((plan) => {
      let finalId = plan.id;
      let counter = 2;
      while (existingIds.has(finalId)) {
        finalId = `${plan.id}_${counter++}`;
      }
      existingIds.add(finalId);
      catalog = appendPlanWithNewId(catalog, plan, finalId);
      imported++;
    });
    next.catalog = catalog;
  }

  next.runtime = pruneRuntimeByCatalog(next.runtime, next.catalog);
  applySnapshotToState(next);
  saveToStorage();
  return { ok: true, imported, updated };
}
