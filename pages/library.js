// 计划库页面
import { state } from '../core/state.js';
import { saveToStorage } from '../core/storage.js';
import { flattenPlans, getModuleExercises, pruneRuntimeByPlans, showToast } from '../utils/helpers.js';
import { mountLibrarySorters } from '../services/drag-sort.js';

const libraryGroupOpen = {};
let activeGroupSettingsId = null;

const PLAN_EMOJI_CANDIDATES = ['🏋️', '🧗', '🧘', '🤸', '⚡', '💪', '🎯', '🔥', '🌙', '🏃', '🛡️', '🧩'];
const GROUP_PALETTES = [
  { color: '#34C759', gradient: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)' },
  { color: '#5AC8FA', gradient: 'linear-gradient(135deg, #5AC8FA 0%, #0A84FF 100%)' },
  { color: '#FF9500', gradient: 'linear-gradient(135deg, #FF9500 0%, #FF6B35 100%)' },
  { color: '#5856D6', gradient: 'linear-gradient(135deg, #5856D6 0%, #AF52DE 100%)' },
  { color: '#FF2D55', gradient: 'linear-gradient(135deg, #FF2D55 0%, #FF375F 100%)' },
  { color: '#00C7BE', gradient: 'linear-gradient(135deg, #00C7BE 0%, #64D2FF 100%)' },
];
const ART_ACCENTS = ['#ffffff', '#E6F0FF', '#EAFBF8', '#FFEBDC', '#F1E6FF', '#E6FFF3'];

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeToken(token = '') {
  try {
    return decodeURIComponent(String(token));
  } catch (_err) {
    return String(token);
  }
}

function encodeToken(token = '') {
  return encodeURIComponent(String(token));
}

function slugify(text = '') {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';
}

function ensureGroupOpen(groupId, defaultOpen = false) {
  if (typeof libraryGroupOpen[groupId] !== 'boolean') {
    libraryGroupOpen[groupId] = defaultOpen;
  }
  return libraryGroupOpen[groupId];
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getSortedGroups() {
  return (state.catalog?.planGroups || [])
    .slice()
    .sort((a, b) => (a.order || 999) - (b.order || 999));
}

function syncCatalogState({ rerender = true, toast = '' } = {}) {
  state.plans = flattenPlans(state.catalog);
  pruneRuntimeByPlans(state.plans, state.runtime);
  saveToStorage();
  if (rerender) renderLibrary();
  if (toast) showToast(toast);
}

function getGroupById(groupId) {
  return (state.catalog?.planGroups || []).find(g => g.id === groupId) || null;
}

function findPlanLocation(planId) {
  const groups = state.catalog?.planGroups || [];
  for (let gi = 0; gi < groups.length; gi++) {
    const plans = Array.isArray(groups[gi].plans) ? groups[gi].plans : [];
    for (let pi = 0; pi < plans.length; pi++) {
      if (plans[pi].id === planId) return { group: groups[gi], groupIdx: gi, plan: plans[pi], planIdx: pi };
    }
  }
  return null;
}

function moveArrayItem(list, from, to) {
  if (!Array.isArray(list)) return;
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
}

function reorderGroupsByIndex(from, to) {
  const groups = state.catalog?.planGroups;
  if (!Array.isArray(groups)) return;
  moveArrayItem(groups, from, to);
  groups.forEach((g, idx) => { g.order = idx + 1; });
  syncCatalogState({ toast: '↕️ 计划组顺序已更新' });
}

function reorderPlansBetweenGroups(fromGroupId, toGroupId, fromIdx, toIdx) {
  const fromGroup = getGroupById(fromGroupId);
  const toGroup = getGroupById(toGroupId);
  if (!fromGroup || !toGroup) return;
  if (!Array.isArray(fromGroup.plans) || !Array.isArray(toGroup.plans)) return;
  if (fromIdx < 0 || fromIdx >= fromGroup.plans.length) return;

  const [plan] = fromGroup.plans.splice(fromIdx, 1);
  if (!plan) return;
  const safeTarget = Math.max(0, Math.min(toIdx, toGroup.plans.length));
  toGroup.plans.splice(safeTarget, 0, plan);
  plan.stage = toGroup.id;
  syncCatalogState({ toast: fromGroupId === toGroupId ? '↕️ 计划顺序已更新' : '↔️ 计划已移动到新分组' });
}

function ensureUniqueGroupId(base) {
  const existing = new Set((state.catalog?.planGroups || []).map(g => g.id));
  let id = slugify(base);
  if (!existing.has(id)) return id;
  let n = 2;
  while (existing.has(`${id}_${n}`)) n++;
  return `${id}_${n}`;
}

function ensureUniquePlanId(base) {
  const existing = new Set(state.plans.map(p => p.id));
  let id = slugify(base);
  if (!existing.has(id)) return id;
  let n = 2;
  while (existing.has(`${id}_${n}`)) n++;
  return `${id}_${n}`;
}

function buildPlanEmojiPicker(planId, selectedEmoji) {
  const token = encodeToken(planId);
  return `<div class="emoji-picker-row">${
    PLAN_EMOJI_CANDIDATES.map((emoji) => {
      const active = emoji === selectedEmoji ? ' active' : '';
      return `<button class="emoji-chip${active}" type="button" data-plan-emoji="${token}|${encodeToken(emoji)}">${escapeHtml(emoji)}</button>`;
    }).join('')
  }</div>`;
}

function buildModernArtDataUrl() {
  const palette = randomPick(GROUP_PALETTES);
  const c1 = palette.color;
  const c2 = randomPick(['#0A84FF', '#AF52DE', '#30D158', '#FF9F0A', '#5AC8FA', '#00C7BE']);
  const c3 = randomPick(['#EAF3FF', '#F3ECFF', '#EAFBF8', '#FFF2E8']);
  const accent = randomPick(ART_ACCENTS);
  const template = randomInt(1, 5);

  let overlay = '';
  if (template === 1) {
    overlay = `
      <path d="M-18 126C28 88 74 74 132 90C188 106 226 78 276 54V276H-18Z" fill="${accent}" fill-opacity="0.34"/>
      <path d="M14 214C62 164 142 172 196 204C226 222 248 238 276 264V276H14Z" fill="${accent}" fill-opacity="0.28"/>
      <circle cx="${randomInt(168, 224)}" cy="${randomInt(42, 88)}" r="${randomInt(20, 38)}" fill="#ffffff" fill-opacity="0.26"/>`;
  } else if (template === 2) {
    overlay = `
      <g transform="rotate(${randomInt(-18, 18)} 128 128)">
        <rect x="${randomInt(14, 36)}" y="${randomInt(26, 44)}" width="${randomInt(180, 214)}" height="${randomInt(26, 38)}" rx="16" fill="${accent}" fill-opacity="0.24"/>
        <rect x="${randomInt(8, 26)}" y="${randomInt(84, 108)}" width="${randomInt(190, 228)}" height="${randomInt(28, 46)}" rx="20" fill="${accent}" fill-opacity="0.22"/>
        <rect x="${randomInt(22, 42)}" y="${randomInt(154, 178)}" width="${randomInt(164, 206)}" height="${randomInt(32, 44)}" rx="18" fill="${accent}" fill-opacity="0.2"/>
      </g>`;
  } else if (template === 3) {
    overlay = `
      <polygon points="${randomInt(20, 76)},${randomInt(16, 58)} ${randomInt(130, 188)},${randomInt(36, 88)} ${randomInt(92, 152)},${randomInt(152, 214)} ${randomInt(16, 50)},${randomInt(120, 190)}" fill="${accent}" fill-opacity="0.26"/>
      <polygon points="${randomInt(160, 236)},${randomInt(96, 146)} ${randomInt(230, 256)},${randomInt(144, 184)} ${randomInt(178, 238)},${randomInt(238, 270)} ${randomInt(126, 174)},${randomInt(194, 246)}" fill="#ffffff" fill-opacity="0.2"/>`;
  } else if (template === 4) {
    overlay = `
      <circle cx="128" cy="128" r="${randomInt(72, 94)}" fill="${accent}" fill-opacity="0.2"/>
      <circle cx="128" cy="128" r="${randomInt(46, 64)}" fill="#ffffff" fill-opacity="0.18"/>
      <circle cx="${randomInt(64, 188)}" cy="${randomInt(60, 196)}" r="${randomInt(18, 30)}" fill="#ffffff" fill-opacity="0.3"/>`;
  } else {
    overlay = `
      <path d="M-10 90C36 66 86 54 132 64C184 76 226 54 266 30V150C226 176 180 198 122 188C74 178 32 186 -10 214Z" fill="${accent}" fill-opacity="0.24"/>
      <path d="M-10 170C36 146 82 132 132 140C180 148 226 130 266 108V278H-10Z" fill="#ffffff" fill-opacity="0.2"/>
      <circle cx="${randomInt(42, 90)}" cy="${randomInt(36, 84)}" r="${randomInt(14, 22)}" fill="#ffffff" fill-opacity="0.35"/>`;
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="${randomInt(0, 30)}%" y1="${randomInt(0, 30)}%" x2="${randomInt(70, 100)}%" y2="${randomInt(70, 100)}%">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="55%" stop-color="${c2}" />
      <stop offset="100%" stop-color="${c3}" />
    </linearGradient>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${randomInt(3, 8)}" />
    </filter>
  </defs>
  <rect width="256" height="256" rx="62" fill="url(#bg)" />
  ${overlay}
  <circle cx="${randomInt(34, 222)}" cy="${randomInt(24, 232)}" r="${randomInt(8, 16)}" fill="#ffffff" fill-opacity="0.22" filter="url(#blur)" />
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function renderGroupBadge(groupMeta, safeGradient, fallbackText, safeGroupName) {
  const cover = String(groupMeta.coverImage || '').trim();
  if (cover) {
    return `<div class="stage-badge stage-badge-image" style="background:${safeGradient}"><img src="${escapeHtml(cover)}" alt="${safeGroupName || 'group'}"></div>`;
  }
  const text = escapeHtml(fallbackText || '组');
  return `<div class="stage-badge" style="background:${safeGradient}">${text}</div>`;
}

function renderGroupManagePanel(groupMeta, encodedGroupId) {
  const safeName = escapeHtml(groupMeta.name || '');
  return `<div class="group-manage-panel">
    <label class="manage-label">计划组名称
      <input class="manage-input" data-group-name-input="${encodedGroupId}" value="${safeName}" />
    </label>
    <div class="manage-subtitle">长按分组标题或计划卡可拖拽排序</div>
    <div class="group-manage-actions">
      <button class="manage-btn" type="button" data-group-random-art="${encodedGroupId}">随机矢量图</button>
      <button class="manage-btn" type="button" data-add-plan="${encodedGroupId}">+ 增加计划</button>
      <button class="manage-btn danger" type="button" data-delete-group="${encodedGroupId}">删除分组</button>
    </div>
  </div>`;
}

function renderPlanManagePanel(plan, encodedPlanId) {
  const safePlanName = escapeHtml(plan.name || '');
  return `<div class="plan-manage-panel">
    <label class="manage-label">计划名称
      <input class="manage-input" data-plan-name-input="${encodedPlanId}" value="${safePlanName}" />
    </label>
    <div class="manage-subtitle">计划 Emoji</div>
    ${buildPlanEmojiPicker(plan.id, plan.icon || '🏋️')}
    <div class="plan-manage-actions">
      <button class="manage-btn danger" type="button" data-delete-plan="${encodedPlanId}">删除计划</button>
    </div>
  </div>`;
}

function renderStageGroup(groupMeta, plans, isOpen) {
  const badgeText = escapeHtml(groupMeta.badge || groupMeta.name || '');
  const encodedGroupId = encodeToken(groupMeta.id || '');
  const safeGroupName = escapeHtml(groupMeta.name || '');
  const safeGroupColor = escapeHtml(groupMeta.color || '#8E8E93');
  const safeGroupGradient = escapeHtml(groupMeta.gradient || safeGroupColor);
  const badgeHtml = renderGroupBadge(groupMeta, safeGroupGradient, badgeText, safeGroupName);
  const settingsOpen = activeGroupSettingsId === groupMeta.id;

  let html = `<div class="stage-section${isOpen ? ' open' : ''}" data-group-id="${encodedGroupId}">`;
  html += '<div class="stage-header">';
  html += `<button class="stage-toggle-btn" data-toggle-stage="${encodedGroupId}" type="button">`;
  html += '<div class="stage-header-main">';
  html += `${badgeHtml}`;
  html += `<div><div class="stage-title">${safeGroupName}</div></div>`;
  html += '</div>';
  html += '<div class="stage-arrow">›</div>';
  html += '</button>';
  html += `<button class="group-settings-btn${settingsOpen ? ' active' : ''}" type="button" data-toggle-group-settings="${encodedGroupId}">${settingsOpen ? '收起' : '设置'}</button>`;
  html += '</div>';

  if (settingsOpen) {
    html += renderGroupManagePanel(groupMeta, encodedGroupId);
  }

  html += `<div class="stage-body"><div class="plan-cards" data-group-plans-list="${encodedGroupId}">`;

  if (!plans.length) {
    html += '<div class="library-empty-tip">当前分组暂无计划，点击“增加计划”即可创建。</div>';
  }

  plans.forEach((plan) => {
    const safePlanId = escapeHtml(plan.id || '');
    const encodedPlanId = encodeToken(plan.id || '');
    const safePlanIcon = escapeHtml(plan.icon || '•');
    const safePlanName = escapeHtml(plan.name || '');
    const modules = Array.isArray(plan.modules) ? plan.modules : [];
    const exCount = modules.reduce((sum, _m, mi) =>
      sum + getModuleExercises(plan.id, mi, state.plans, {}).length
    , 0);
    html += `<div class="plan-card${settingsOpen ? ' manage' : ''}" data-plan-id="${safePlanId}">`;
    html += '<div class="plan-card-main">';
    html += `<div class="plan-card-icon" style="background:${safeGroupColor}20">${safePlanIcon}</div>`;
    html += `<div class="plan-card-info"><div class="plan-card-name">${safePlanName}</div>`;
    html += `<div class="plan-card-desc">${modules.length} 个模块 · ${exCount} 个动作</div></div>`;
    html += '<div class="plan-card-arrow">›</div>';
    html += '</div>';
    if (settingsOpen) {
      html += renderPlanManagePanel(plan, encodedPlanId);
    }
    html += '</div>';
  });

  html += '</div></div></div>';
  return html;
}

export function toggleLibraryStage(groupToken) {
  const stageId = decodeToken(groupToken);
  const current = ensureGroupOpen(stageId, false);
  libraryGroupOpen[stageId] = !current;
  renderLibrary();
}

export function togglePlanGroupSettings(groupId) {
  const id = decodeToken(groupId);
  activeGroupSettingsId = activeGroupSettingsId === id ? null : id;
  if (activeGroupSettingsId) {
    ensureGroupOpen(activeGroupSettingsId, true);
  }
  renderLibrary();
}

export function addPlanGroup() {
  if (!state.catalog) state.catalog = { planGroups: [] };
  if (!Array.isArray(state.catalog.planGroups)) state.catalog.planGroups = [];
  const id = ensureUniqueGroupId(`group_${state.catalog.planGroups.length + 1}`);
  const palette = randomPick(GROUP_PALETTES);
  state.catalog.planGroups.push({
    id,
    name: `新计划组 ${state.catalog.planGroups.length + 1}`,
    subtitle: '',
    badge: '新',
    coverEmoji: '',
    coverImage: buildModernArtDataUrl(),
    color: palette.color,
    gradient: palette.gradient,
    order: state.catalog.planGroups.length + 1,
    plans: [],
  });
  activeGroupSettingsId = id;
  ensureGroupOpen(id, true);
  syncCatalogState({ toast: '➕ 已新增计划组' });
}

export function removePlanGroup(groupId) {
  const id = decodeToken(groupId);
  const groups = state.catalog?.planGroups || [];
  const idx = groups.findIndex(g => g.id === id);
  if (idx < 0) return;
  const group = groups[idx];
  const planCount = Array.isArray(group.plans) ? group.plans.length : 0;
  if (!confirm(`确定删除计划组「${group.name}」吗？将同时删除其中 ${planCount} 个计划。`)) return;
  groups.splice(idx, 1);
  groups.forEach((g, i) => { g.order = i + 1; });
  if (state.currentPlanId && !flattenPlans(state.catalog).some(p => p.id === state.currentPlanId)) {
    state.currentPlanId = null;
  }
  if (activeGroupSettingsId === id) activeGroupSettingsId = null;
  syncCatalogState({ toast: '🗑 已删除计划组' });
}

export function updatePlanGroupName(groupId, value) {
  const group = getGroupById(decodeToken(groupId));
  if (!group) return;
  const v = String(value || '').trim();
  group.name = v || group.name || '未命名分组';
  syncCatalogState();
}

export function setPlanGroupRandomArt(groupId) {
  const group = getGroupById(decodeToken(groupId));
  if (!group) return;
  group.coverImage = buildModernArtDataUrl();
  syncCatalogState({ toast: '🎨 已生成新的矢量图' });
}

export function addPlanToGroup(groupId) {
  const group = getGroupById(decodeToken(groupId));
  if (!group) return;
  if (!Array.isArray(group.plans)) group.plans = [];
  const planId = ensureUniquePlanId(`${group.id}_plan_${group.plans.length + 1}`);
  const moduleId = `${planId}__m1`;
  group.plans.push({
    id: planId,
    name: `新计划 ${group.plans.length + 1}`,
    icon: randomPick(PLAN_EMOJI_CANDIDATES),
    stage: group.id,
    modules: [
      {
        id: moduleId,
        name: '新模块',
        icon: '🧩',
        type: 'custom',
        exercises: [],
      },
    ],
  });
  ensureGroupOpen(group.id, true);
  syncCatalogState({ toast: '➕ 已增加计划' });
}

export function removePlanById(planId) {
  const loc = findPlanLocation(decodeToken(planId));
  if (!loc) return;
  if (!confirm(`确定删除计划「${loc.plan.name}」吗？`)) return;
  loc.group.plans.splice(loc.planIdx, 1);
  if (state.currentPlanId === loc.plan.id) state.currentPlanId = null;
  syncCatalogState({ toast: '🗑 已删除计划' });
}

export function updatePlanName(planId, nextName) {
  const loc = findPlanLocation(decodeToken(planId));
  if (!loc) return;
  const v = String(nextName || '').trim();
  loc.plan.name = v || loc.plan.name || '未命名计划';
  syncCatalogState();
}

export function setPlanEmoji(planId, emoji) {
  const loc = findPlanLocation(decodeToken(planId));
  if (!loc) return;
  loc.plan.icon = String(emoji || '').trim() || loc.plan.icon || '🏋️';
  syncCatalogState();
}

export function renderLibrary() {
  const container = document.getElementById('libraryContent');
  if (!container) return;
  const planCountEl = document.getElementById('planCount');
  if (planCountEl) planCountEl.textContent = state.plans.length;

  const groups = getSortedGroups();
  let html = '';
  if (!groups.length) {
    html += '<div class="library-empty-tip">当前没有计划组，点击底部按钮创建第一个计划组。</div>';
  }

  html += '<div id="libraryGroupList">';
  groups.forEach((group) => {
    const plans = Array.isArray(group.plans) ? group.plans : [];
    const isOpen = ensureGroupOpen(group.id, (group.order || 999) === 1);
    html += renderStageGroup(group, plans, isOpen);
  });
  html += '</div>';
  html += `<div class="library-bottom-add-wrap">
    <button class="library-add-fab" type="button" data-add-group aria-label="新建计划组">＋</button>
    <div class="library-add-label">新建计划组</div>
  </div>`;

  container.innerHTML = html;
  mountLibrarySorters({
    enabled: Boolean(activeGroupSettingsId),
    onReorderGroups: (from, to) => reorderGroupsByIndex(from, to),
    onReorderPlans: (fromGroupToken, toGroupToken, fromIdx, toIdx) => {
      reorderPlansBetweenGroups(
        decodeToken(fromGroupToken),
        decodeToken(toGroupToken),
        fromIdx,
        toIdx
      );
    },
  });
}

export function decodeLibraryToken(token) {
  return decodeToken(token);
}
