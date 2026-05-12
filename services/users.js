import { state } from '../core/state.js';
import { showToast } from '../utils/helpers.js';
import { loadState, saveToStorage, clearAllProgress } from '../core/storage.js';

export const USER_STORAGE_KEY = 'acl_users';
export const CURRENT_USER_KEY = 'acl_current_user';

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

export function createUser(username) {
  const users = getAllUsers();
  const userId = generateUid();
  users[userId] = {
    id: userId,
    username: username || '用户',
    createdAt: Date.now(),
    settings: {
      theme: 'auto',
      aiConfig: {}
    },
    catalog: {
      version: 7,
      planGroups: []
    },
    plans: [],
    runtime: {
      currentPlanId: null,
      progress: {},
      exerciseRest: {},
      trainingSessionStartAt: null
    }
  };
  saveUsers(users);
  return userId;
}

export function getUserData(userId) {
  const users = getAllUsers();
  return users[userId] || null;
}

export function saveUserData(userId, userData) {
  const users = getAllUsers();
  users[userId] = { ...users[userId], ...userData };
  saveUsers(users);
}

export function deleteUser(userId) {
  const users = getAllUsers();
  delete users[userId];
  saveUsers(users);
  if (getCurrentUserId() === userId) {
    setCurrentUserId(null);
  }
}

export function login(userId) {
  const user = getUserData(userId);
  if (!user) {
    showToast('用户不存在');
    return false;
  }
  setCurrentUserId(userId);
  loadUserState(userId);
  showToast(`欢迎回来, ${user.username}`);
  return true;
}

export function logout() {
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

export function loadUserState(userId) {
  const user = getUserData(userId);
  if (!user) return;
  
  state.user = user;
  state.settings = user.settings || {};
  state.catalog = user.catalog || { planGroups: [] };
  state.plans = user.plans || [];
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
    plans: state.plans,
    runtime: state.runtime
  };
  saveUserData(userId, userData);
}

export function ensureDefaultUser() {
  const userId = getCurrentUserId();
  if (userId && getUserData(userId)) {
    login(userId);
    return userId;
  }
  
  const users = getAllUsers();
  const userIds = Object.keys(users);
  if (userIds.length > 0) {
    login(userIds[0]);
    return userIds[0];
  }
  
  const newUserId = createUser('默认用户');
  login(newUserId);
  return newUserId;
}