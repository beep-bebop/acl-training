// 数据持久化：单键 'acl-training'，载荷含 version。
// 旧键 acl_v7 / acl_v6 只读迁移、不删除，保留回滚能力。
import { SCHEMA_VERSION, normalizeSnapshot } from '../core/schema.js';
import { migrateFromLegacyStorage, migrateSnapshot } from '../core/migration.js';

export const STORAGE_KEY = 'acl-training';

const saveListeners = new Set();

function getStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** 读取并归一化本地快照；首次使用返回 null */
export function loadSnapshot() {
  return loadSnapshotInfo().snapshot;
}

/** 读取快照并报告是否发生了旧版本迁移（用于提示用户） */
export function loadSnapshotInfo() {
  const store = getStorage();
  if (!store) return { snapshot: null, migrated: false };
  let raw = null;
  try {
    raw = JSON.parse(store.getItem(STORAGE_KEY) || 'null');
  } catch {
    raw = null;
  }
  if (raw && typeof raw === 'object') {
    if (Number(raw.version) === SCHEMA_VERSION) return { snapshot: normalizeSnapshot(raw), migrated: false };
    const migrated = migrateSnapshot(raw);
    if (migrated) return { snapshot: migrated, migrated: true };
  }
  const legacy = migrateFromLegacyStorage();
  return legacy ? { snapshot: legacy, migrated: true } : { snapshot: null, migrated: false };
}

export function saveSnapshot(snapshot) {
  const store = getStorage();
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ ...snapshot, version: SCHEMA_VERSION }));
  } catch (err) {
    console.error('[persistence] 保存失败', err);
    return false;
  }
  for (const fn of saveListeners) {
    try {
      fn();
    } catch (err) {
      console.error('[persistence] 保存监听器异常', err);
    }
  }
  return true;
}

export function addAfterSaveListener(fn) {
  saveListeners.add(fn);
  return () => saveListeners.delete(fn);
}

export function clearAllLocal() {
  getStorage()?.removeItem(STORAGE_KEY);
}

/** 拉取种子动作库（构建产物 data/catalog.json） */
export async function fetchSeedCatalog() {
  const base = import.meta.env.BASE_URL || '/';
  const resp = await fetch(`${base}data/catalog.json`, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`无法加载种子数据（HTTP ${resp.status}）`);
  return resp.json();
}
