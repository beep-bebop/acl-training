// 旧版本数据迁移。旧 localStorage 键只读不删，天然保留回滚能力。
// 支持：'acl_v7'（载荷 version 8，含 catalog.planGroups）
//      'acl_v6'（载荷 version 6，plans 扁平 + stage 字段）
// 以及导入的旧导出文件（v8 catalog 包装 / v6 扁平 plans）。
import { normalizeSnapshot, normalizeCatalog, validateCatalog, SCHEMA_VERSION } from './schema.js';

const LEGACY_STAGE_DEFS = [
  { id: 'stage1', name: '基础恢复期', subtitle: '阶段一', color: '#4ADE80' },
  { id: 'stage2', name: '进阶强化期', subtitle: '阶段二', color: '#FB923C' },
  { id: 'restday', name: '休息日', subtitle: '阶段休', color: '#818CF8' }
];

/** 探测旧存储键并迁移为 v9 快照；找不到返回 null */
export function migrateFromLegacyStorage(getStorage = safeStorage) {
  const store = getStorage();
  if (!store) return null;
  for (const key of ['acl_v7', 'acl_v6']) {
    let raw = null;
    try {
      raw = JSON.parse(store.getItem(key) || 'null');
    } catch {
      raw = null;
    }
    if (raw && typeof raw === 'object') {
      const snapshot = migrateSnapshot(raw);
      if (snapshot) return snapshot;
    }
  }
  return null;
}

/** 任意已知历史结构 → v9 快照；无法识别返回 null */
export function migrateSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const version = Number(raw.version);
  // v6 扁平结构
  if (version === 6 || (!raw.catalog && Array.isArray(raw.plans))) {
    const grouped = regroupLegacy(raw.plans || []);
    return normalizeSnapshot({
      version: SCHEMA_VERSION,
      catalog: { planGroups: grouped },
      logs: raw.runtime || {},
      settings: raw.settings || {}
    });
  }
  // v7/v8 结构：catalog.planGroups
  if (raw.catalog?.planGroups || version === 7 || version === 8) {
    return normalizeSnapshot({
      version: SCHEMA_VERSION,
      catalog: raw.catalog || { planGroups: [] },
      program: raw.program,
      logs: raw.logs || raw.runtime || {},
      settings: raw.settings || {}
    });
  }
  // 已是 v9
  if (version >= SCHEMA_VERSION || raw.planGroups) {
    return normalizeSnapshot(raw);
  }
  return null;
}

/** 迁移导入文件中的目录部分（可能只是 catalog 而非完整快照） */
export function migrateCatalogInput(input) {
  if (!input || typeof input !== 'object') return null;
  // 完整快照 / 备份载荷
  const candidate = input.snapshot?.catalog ? { planGroups: input.snapshot.catalog.planGroups } : null;
  const direct = input.planGroups || input.catalog?.planGroups;
  const groups = candidate || direct;
  if (!groups) return null;
  const catalog = normalizeCatalog(typeof groups === 'object' && !Array.isArray(groups) ? groups : { planGroups: groups }, LEGACY_STAGE_DEFS);
  const valid = validateCatalog(catalog);
  return valid.ok ? catalog : null;
}

function regroupLegacy(plans) {
  return regroupPlans(plans, LEGACY_STAGE_DEFS);
}

export function regroupPlans(plans, stageDefs) {
  const byStage = new Map();
  for (const plan of plans) {
    const stage = plan?.stage || 'stage1';
    if (!byStage.has(stage)) byStage.set(stage, []);
    byStage.get(stage).push(plan);
  }
  return stageDefs
    .filter((s) => byStage.has(s.id))
    .map((s, i) => ({ ...s, order: i + 1, plans: byStage.get(s.id) }));
}

function safeStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
