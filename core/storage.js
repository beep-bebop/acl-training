// localStorage 持久化
import { state } from './state.js';
import { todayStr } from '../utils/helpers.js';

const STORAGE_KEY = 'acl_v6';

let storageOK = false;
try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); storageOK = true; } catch (e) {}

export { storageOK };

export function loadFromStorage() {
  if (!storageOK) return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch (e) {
    return null;
  }
}

export function saveToStorage() {
  try {
    if (!storageOK) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      plans: state.plans,
      exerciseRest: state.exerciseRest,
      calendarLogs: state.calendarLogs,
      userEdits: state.userEdits,
      trainingProgress: state.trainingProgress,
      trainingDate: state.trainingDate,
    }));
  } catch (e) { /* quota exceeded, silently fail */ }
}

export function clearAllProgress() {
  state.trainingProgress = {};
  state.exerciseRest = {};
  state.calendarLogs = {};
  state.userEdits = {};
  state.trainingDate = todayStr();
}

export { STORAGE_KEY };
