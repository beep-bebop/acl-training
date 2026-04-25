// 计划库页面
import { state } from '../core/state.js';
import { saveToStorage } from '../core/storage.js';
import { flattenPlans, getModuleExercises, pruneRuntimeByPlans, showToast } from '../utils/helpers.js';
import { mountLibrarySorters } from '../services/drag-sort.js';

const libraryGroupOpen = {};
let libraryManageMode = false;

const GROUP_EMOJI_CANDIDATES = ['一', '二', '三', '休', '🧩', '🎯', '⚡', '🔥', '🌙', '🌿', '🛡️', '🌀'];
const PLAN_EMOJI_CANDIDATES = ['🏋️', '🧗', '🧘', '🤸', '⚡', '💪', '🎯', '🔥', '🌙', '🏃', '🛡️', '🧩'];
const GROUP_PALETTES = [
  { color: '#34C759', gradient: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)' },
  { color: '#5AC8FA', gradient: 'linear-gradient(135deg, #5AC8FA 0%, #0A84FF 100%)' },
  { color: '#FF9500', gradient: 'linear-gradient(135deg, #FF9500 0%, #FF6B35 100%)' },
  { color: '#5856D6', gradient: 'linear-gradient(135deg, #5856D6 0%, #AF52DE 100%)' },
  { color: '#FF2D55', gradient: 'linear-gradient(135deg, #FF2D55 0%, #FF375F 100%)' },
];

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

function buildGroupEmojiPicker(groupId, selectedEmoji) {
  const token = encodeToken(groupId);
  return `<div class="emoji-picker-row">${
    GROUP_EMOJI_CANDIDATES.map((emoji) => {
      const active = emoji === selectedEmoji ? ' active' : '';
      return `<button class="emoji-chip${active}" type="button" data-group-emoji="${token}|${encodeToken(emoji)}">${escapeHtml(emoji)}</button>`;
    }).join('')
  }</div>`;
}

function buildModernArtDataUrl(group) {
  const palette = randomPick(GROUP_PALETTES);
  const c1 = palette.color;
  const c2 = randomPick(['#0A84FF', '#AF52DE', '#30D158', '#FF9F0A', '#5AC8FA']);
  const bubble1 = randomInt(18, 40);
  const bubble2 = randomInt(10, 28);
  const bubble3 = randomInt(8, 20);
  const rot = randomInt(-20, 22);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="100%" stop-color="${c2}" />
    </linearGradient>
    <linearGradient id="shape" x1="20%" y1="10%" x2="80%" y2="90%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.72" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.14" />
    </linearGradient>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" />
    </filter>
  </defs>
  <rect width="256" height="256" rx="60" fill="url(#bg)" />
  <circle cx="${randomInt(50, 84)}" cy="${randomInt(46, 90)}" r="${bubble1}" fill="#fff" fill-opacity="0.2" filter="url(#blur)" />
  <circle cx="${randomInt(160, 210)}" cy="${randomInt(44, 104)}" r="${bubble2}" fill="#fff" fill-opacity="0.3" />
  <circle cx="${randomInt(164, 222)}" cy="${randomInt(150, 206)}" r="${bubble3}" fill="#fff" fill-opacity="0.24" />
  <g transform="rotate(${rot} 128 128)">
    <rect x="${randomInt(54, 86)}" y="${randomInt(116, 146)}" width="${randomInt(98, 132)}" height="${randomInt(42, 64)}" rx="${randomInt(18, 28)}" fill="url(#shape)" />
  </g>
  <text x="128" y="136" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system, Segoe UI, sans-serif" font-size="64" font-weight="800" fill="#fff" fill-opacity="0.9">${escapeHtml(group?.coverEmoji || group?.badge || '◆')}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function fileToCompressedImageDataUrl(file) {
  const readAsDataURL = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(blob);
  });

  const original = await readAsDataURL(file);
  const img = new Image();
  const loaded = new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('无法解析图片'));
  });
  img.src = original;
  await loaded;

  const maxSide = 256;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(48, Math.round(img.width * scale));
  const h = Math.max(48, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/webp', 0.86);
}

function renderGroupBadge(groupMeta, safeGradient, fallbackText, safeGroupName) {
  const cover = String(groupMeta.coverImage || '').trim();
  if (cover) {
    return `<div class="stage-badge stage-badge-image" style="background:${safeGradient}"><img src="${escapeHtml(cover)}" alt="${safeGroupName || 'group'}"></div>`;
  }
  const text = escapeHtml(groupMeta.coverEmoji || fallbackText || '🧩');
  return `<div class="stage-badge" style="background:${safeGradient}">${text}</div>`;
}

function renderGroupManagePanel(groupMeta, encodedGroupId) {
  const safeName = escapeHtml(groupMeta.name || '');
  const safeSubtitle = escapeHtml(groupMeta.subtitle || '');
  return `<div class="group-manage-panel">
    <div class="group-manage-grid">
      <label class="manage-label">计划组名称
        <input class="manage-input" data-group-name-input="${encodedGroupId}" value="${safeName}" />
      </label>
      <label class="manage-label">副标题
        <input class="manage-input" data-group-subtitle-input="${encodedGroupId}" value="${safeSubtitle}" />
      </label>
    </div>
    <div class="manage-subtitle">图例 Emoji</div>
    ${buildGroupEmojiPicker(groupMeta.id, groupMeta.coverEmoji || groupMeta.badge || '🧩')}
    <div class="group-manage-actions">
      <label class="manage-upload-btn">
        上传图例
        <input type="file" accept="image/*" data-group-upload="${encodedGroupId}" />
      </label>
      <button class="manage-btn" type="button" data-group-random-art="${encodedGroupId}">随机矢量图</button>
      <button class="manage-btn" type="button" data-group-clear-art="${encodedGroupId}">改回 Emoji</button>
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
      <button class="manage-btn" type="button" data-open-plan="${encodedPlanId}">进入计划</button>
      <button class="manage-btn danger" type="button" data-delete-plan="${encodedPlanId}">删除计划</button>
    </div>
  </div>`;
}

function renderStageGroup(groupMeta, plans, isOpen) {
  const badgeText = escapeHtml(groupMeta.badge || groupMeta.subtitle || groupMeta.name || '');
  const safeGroupId = escapeHtml(groupMeta.id || '');
  const encodedGroupId = encodeToken(groupMeta.id || '');
  const safeGroupName = escapeHtml(groupMeta.name || '');
  const safeGroupSubtitle = escapeHtml(groupMeta.subtitle || '');
  const safeGroupColor = escapeHtml(groupMeta.color || '#8E8E93');
  const safeGroupGradient = escapeHtml(groupMeta.gradient || safeGroupColor);
  const previewIcons = plans.slice(0, 3).map(plan => `<span class="stage-preview-icon">${escapeHtml(plan.icon || '•')}</span>`).join('');
  const badgeHtml = renderGroupBadge(groupMeta, safeGroupGradient, badgeText, safeGroupName);

  let html = `<div class="stage-section${isOpen ? ' open' : ''}">`;
  html += `<button class="stage-header" data-toggle-stage="${safeGroupId}" type="button">`;
  html += '<div class="stage-header-main">';
  html += `${badgeHtml}`;
  html += `<div><div class="stage-title">${safeGroupName}</div><div class="stage-subtitle">${safeGroupSubtitle}</div></div>`;
  html += '</div>';
  html += '<div class="stage-header-side">';
  if (libraryManageMode) {
    html += '<span class="drag-handle drag-handle-group" title="拖拽排序">⋮⋮</span>';
  }
  html += `<div class="stage-mini-icons">${previewIcons}</div>`;
  html += `<div class="stage-count">${plans.length} 套计划</div>`;
  html += '<div class="stage-arrow">›</div>';
  html += '</div></button>';
  if (libraryManageMode) {
    html += renderGroupManagePanel(groupMeta, encodedGroupId);
  }
  html += `<div class="stage-body"><div class="plan-cards" data-group-plans-list="${encodedGroupId}">`;

  if (!plans.length && libraryManageMode) {
    html += '<div class="library-empty-tip">当前分组暂无计划，点击上方“+ 增加计划”即可创建。</div>';
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
    const planCardAttr = libraryManageMode ? '' : ` data-plan-id="${safePlanId}"`;
    html += `<div class="plan-card${libraryManageMode ? ' manage' : ''}"${planCardAttr}>`;
    html += `<div class="plan-card-icon" style="background:${safeGroupColor}20">${safePlanIcon}</div>`;
    html += `<div class="plan-card-info"><div class="plan-card-name">${safePlanName}</div>`;
    html += `<div class="plan-card-desc">${modules.length} 个模块 · ${exCount} 个动作</div></div>`;
    if (libraryManageMode) {
      html += '<button class="drag-handle drag-handle-plan" type="button" title="拖拽排序">⋮⋮</button>';
      html += '<div class="plan-card-arrow">⚙️</div>';
    } else {
      html += '<div class="plan-card-arrow">›</div>';
    }
    if (libraryManageMode) {
      html += renderPlanManagePanel(plan, encodedPlanId);
    }
    html += '</div>';
  });

  html += '</div></div></div>';
  return html;
}

export function isLibraryManageMode() {
  return libraryManageMode;
}

export function toggleLibraryManageMode() {
  libraryManageMode = !libraryManageMode;
  renderLibrary();
  showToast(libraryManageMode ? '🧩 已开启结构编辑模式' : '✅ 已退出结构编辑模式');
}

export function toggleLibraryStage(stageId) {
  const current = ensureGroupOpen(stageId, false);
  libraryGroupOpen[stageId] = !current;
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
    subtitle: '可编辑分组',
    badge: '新',
    coverEmoji: '🧩',
    coverImage: '',
    color: palette.color,
    gradient: palette.gradient,
    order: state.catalog.planGroups.length + 1,
    plans: [],
  });
  ensureGroupOpen(id, true);
  syncCatalogState({ toast: '➕ 已新增计划组' });
}

export function removePlanGroup(groupId) {
  const groups = state.catalog?.planGroups || [];
  const idx = groups.findIndex(g => g.id === groupId);
  if (idx < 0) return;
  const group = groups[idx];
  const planCount = Array.isArray(group.plans) ? group.plans.length : 0;
  if (!confirm(`确定删除计划组「${group.name}」吗？将同时删除其中 ${planCount} 个计划。`)) return;
  groups.splice(idx, 1);
  groups.forEach((g, i) => { g.order = i + 1; });
  if (state.currentPlanId && !flattenPlans(state.catalog).some(p => p.id === state.currentPlanId)) {
    state.currentPlanId = null;
  }
  syncCatalogState({ toast: '🗑 已删除计划组' });
}

export function updatePlanGroupText(groupId, field, value) {
  const group = getGroupById(groupId);
  if (!group) return;
  const v = String(value || '').trim();
  if (field === 'name') {
    group.name = v || group.name || '未命名分组';
  } else if (field === 'subtitle') {
    group.subtitle = v;
  }
  syncCatalogState();
}

export function setPlanGroupEmoji(groupId, emoji) {
  const group = getGroupById(groupId);
  if (!group) return;
  group.coverEmoji = String(emoji || '').trim() || group.coverEmoji || '🧩';
  group.coverImage = '';
  syncCatalogState();
}

export function setPlanGroupRandomArt(groupId) {
  const group = getGroupById(groupId);
  if (!group) return;
  group.coverImage = buildModernArtDataUrl(group);
  syncCatalogState({ toast: '🎨 已生成矢量图图例' });
}

export function clearPlanGroupCoverArt(groupId) {
  const group = getGroupById(groupId);
  if (!group) return;
  group.coverImage = '';
  syncCatalogState({ toast: '🧼 已恢复 Emoji 图例' });
}

export async function setPlanGroupCoverImageFromFile(groupId, file) {
  if (!file) return;
  const group = getGroupById(groupId);
  if (!group) return;
  try {
    const dataUrl = await fileToCompressedImageDataUrl(file);
    group.coverImage = dataUrl;
    syncCatalogState({ toast: '🖼️ 分组图例已更新' });
  } catch (err) {
    showToast(`❌ 上传失败：${err.message}`);
  }
}

export function addPlanToGroup(groupId) {
  const group = getGroupById(groupId);
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
  const loc = findPlanLocation(planId);
  if (!loc) return;
  if (!confirm(`确定删除计划「${loc.plan.name}」吗？`)) return;
  loc.group.plans.splice(loc.planIdx, 1);
  if (state.currentPlanId === planId) state.currentPlanId = null;
  syncCatalogState({ toast: '🗑 已删除计划' });
}

export function updatePlanName(planId, nextName) {
  const loc = findPlanLocation(planId);
  if (!loc) return;
  const v = String(nextName || '').trim();
  loc.plan.name = v || loc.plan.name || '未命名计划';
  syncCatalogState();
}

export function setPlanEmoji(planId, emoji) {
  const loc = findPlanLocation(planId);
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
  let html = `<div class="library-tools">
    <button class="library-tool-btn" type="button" data-toggle-library-manage>${libraryManageMode ? '✅ 完成结构编辑' : '🧩 编辑计划结构'}</button>
    <button class="library-tool-btn" type="button" data-add-group>+ 新建计划组</button>
  </div>`;

  if (!groups.length) {
    html += '<div class="library-empty-tip">当前没有计划组，点击上方“新建计划组”开始搭建你的训练结构。</div>';
  }

  html += '<div id="libraryGroupList">';
  groups.forEach((group) => {
    const plans = Array.isArray(group.plans) ? group.plans : [];
    if (!plans.length && !libraryManageMode) return;
    const isOpen = ensureGroupOpen(group.id, (group.order || 999) === 1);
    html += renderStageGroup(group, plans, isOpen);
  });
  html += '</div>';

  container.innerHTML = html;
  mountLibrarySorters({
    enabled: libraryManageMode,
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
