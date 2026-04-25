// localStorage 持久化
import { state } from './state.js';
import { V7_VERSION } from '../services/schema-v7.js';

const STORAGE_KEY_V7 = 'acl_v7';
const STORAGE_KEY_V6 = 'acl_v6';

let storageOK = false;
try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); storageOK = true; } catch (e) {}

export { storageOK };

export function loadFromStorage() {
  if (!storageOK) return null;
  try {
    const v7Raw = localStorage.getItem(STORAGE_KEY_V7);
    if (v7Raw) {
      const parsed = JSON.parse(v7Raw);
      if (parsed && typeof parsed === 'object') {
        return { ...parsed, __storageVersion: 7 };
      }
    }

    const v6Raw = localStorage.getItem(STORAGE_KEY_V6);
    if (v6Raw) {
      const parsed = JSON.parse(v6Raw);
      if (parsed && typeof parsed === 'object') {
        return { ...parsed, version: 6, __storageVersion: 6 };
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function buildSnapshotFromState() {
  return {
    version: V7_VERSION,
    catalog: state.catalog,
    runtime: state.runtime,
    settings: state.settings,
  };
}

export function saveToStorage() {
  try {
    if (!storageOK) return;
    const snapshot = buildSnapshotFromState();
    localStorage.setItem(STORAGE_KEY_V7, JSON.stringify(snapshot));
  } catch (e) { /* quota exceeded, silently fail */ }
}

export function clearAllProgress() {
  state.runtime.progress = {};
  state.runtime.exerciseRest = {};
  state.runtime.calendarLogs = {};
  state.runtime.trainingDate = null;
  state.runtime.trainingSessionStartAt = null;
}

export { STORAGE_KEY_V7, STORAGE_KEY_V6 };
