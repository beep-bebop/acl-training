import { state } from '../core/state.js';
import { showToast } from '../utils/helpers.js';
import { loadDefaultCatalogSnapshot } from '../services/plans.js';

export const USER_STORAGE_KEY = 'acl_users';
export const CURRENT_USER_KEY = 'acl_current_user';
export const LEGACY_STORAGE_KEYS = [
  'acl_catalog',
  'acl_runtime',
  'acl_settings',
  'training_progress',
  'exercise_rest'
];

export function getAllUsers() {
  try {
    const data = localStorage.getItem(USER_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveUsers(users) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
}

export function getCurrentUserId() {
  return localStorage.getItem(CURRENT_USER_KEY) || null;
}

export function setCurrentUserId(userId) {
  if (userId) {
    localStorage.setItem(CURRENT_USER_KEY, userId);
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

export function generateUid() {
  return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export async function createUser(username, migrateLegacy = false) {
  const users = getAllUsers();
  const userId = generateUid();
  
  let catalog = { planGroups: [] };
  const defaults = await loadDefaultCatalogSnapshot();
  if (defaults?.catalog?.planGroups?.length > 0) {
    catalog = defaults.catalog;
  }
  
  let runtime = {
    currentPlanId: null,
    progress: {},
    exerciseRest: {},
    trainingSessionStartAt: null
  };
  let settings = {
    theme: 'auto',
    aiConfig: {}
  };
  
  if (migrateLegacy) {
    const legacyData = loadLegacyData();
    if (legacyData.catalog) catalog = legacyData.catalog;
    if (legacyData.plans) plans = legacyData.plans;
    if (legacyData.runtime) runtime = { ...runtime, ...legacyData.runtime };
    if (legacyData.settings) settings = { ...settings, ...legacyData.settings };
  }
  
  users[userId] = {
    id: userId,
    username: username || '用户',
    createdAt: Date.now(),
    settings,
    catalog,
    runtime
  };
  
  saveUsers(users);
  return userId;
}

export function loadLegacyData() {
  const data = {};
  
  const catalog = localStorage.getItem('acl_catalog');
  if (catalog) {
    try {
      data.catalog = JSON.parse(catalog);
      if (data.catalog && data.catalog.planGroups) {
        data.plans = [];
        data.catalog.planGroups.forEach(group => {
          if (group.plans) {
            data.plans = data.plans.concat(group.plans);
          }
        });
      }
    } catch {}
  }
  
  const runtime = localStorage.getItem('acl_runtime');
  if (runtime) {
    try {
      data.runtime = JSON.parse(runtime);
    } catch {}
  }
  
  const settings = localStorage.getItem('acl_settings');
  if (settings) {
    try {
      data.settings = JSON.parse(settings);
    } catch {}
  }
  
  const progress = localStorage.getItem('training_progress');
  if (progress) {
    try {
      if (!data.runtime) data.runtime = {};
      data.runtime.progress = JSON.parse(progress);
    } catch {}
  }
  
  const exerciseRest = localStorage.getItem('exercise_rest');
  if (exerciseRest) {
    try {
      if (!data.runtime) data.runtime = {};
      data.runtime.exerciseRest = JSON.parse(exerciseRest);
    } catch {}
  }
  
  return data;
}

export function clearLegacyData() {
  LEGACY_STORAGE_KEYS.forEach(key => {
    localStorage.removeItem(key);
  });
}

export function getUserData(userId) {
  const users = getAllUsers();
  return users[userId] || null;
}

export function saveUserData(userId, userData) {
  const users = getAllUsers();
  if (users[userId]) {
    const existing = users[userId];
    users[userId] = {
      ...existing,
      ...userData,
      catalog: userData.catalog || existing.catalog,
      runtime: { ...(existing.runtime || {}), ...(userData.runtime || {}) },
      settings: { ...(existing.settings || {}), ...(userData.settings || {}) }
    };
    saveUsers(users);
  }
}

export function deleteUser(userId) {
  const users = getAllUsers();
  delete users[userId];
  saveUsers(users);
  if (getCurrentUserId() === userId) {
    setCurrentUserId(null);
  }
}

export async function login(userId) {
  const user = getUserData(userId);
  if (!user) {
    showToast('用户不存在');
    return false;
  }
  
  setCurrentUserId(userId);
  await loadUserState(userId);
  showToast(`欢迎回来, ${user.username}`);
  return true;
}

export async function logout() {
  saveCurrentUserState();
  setCurrentUserId(null);
  state.user = null;
  state.settings = {};
  state.catalog = { planGroups: [] };
  state.plans = [];
  state.runtime = {
    currentPlanId: null,
    progress: {},
    exerciseRest: {},
    trainingSessionStartAt: null
  };
  showToast('已退出登录');
}

export async function loadUserState(userId) {
  const user = getUserData(userId);
  if (!user) return;
  
  state.user = user;
  state.settings = user.settings || {};
  
  if (user.catalog && user.catalog.planGroups && user.catalog.planGroups.length > 0) {
    state.catalog = user.catalog;
  } else {
    const defaults = await loadDefaultCatalogSnapshot();
    if (defaults?.catalog) {
      state.catalog = defaults.catalog;
    } else {
      state.catalog = { planGroups: [] };
    }
  }
  
  state.plans = [];
  if (state.catalog?.planGroups) {
    state.catalog.planGroups.forEach(group => {
      if (group.plans) {
        group.plans.forEach(plan => {
          plan.stage = plan.stage || group.id;
          state.plans.push(plan);
        });
      }
    });
  }
  
  state.runtime = user.runtime || {
    currentPlanId: null,
    progress: {},
    exerciseRest: {},
    trainingSessionStartAt: null
  };
}

export function saveCurrentUserState() {
  const userId = getCurrentUserId();
  if (!userId) return;
  
  const userData = {
    settings: state.settings,
    catalog: state.catalog,
    runtime: state.runtime
  };
  saveUserData(userId, userData);
}

export function hasLegacyData() {
  return LEGACY_STORAGE_KEYS.some(key => localStorage.getItem(key));
}

export async function ensureDefaultUser() {
  const userId = getCurrentUserId();
  
  if (userId && getUserData(userId)) {
    await login(userId);
    return userId;
  }
  
  const users = getAllUsers();
  const userIds = Object.keys(users);
  
  if (userIds.length > 0) {
    await login(userIds[0]);
    return userIds[0];
  }
  
  const migrateLegacy = hasLegacyData();
  const newUserId = await createUser('默认用户', migrateLegacy);
  
  if (migrateLegacy) {
    showToast('🔄 已自动迁移旧数据');
  }
  
  await login(newUserId);
  return newUserId;
}