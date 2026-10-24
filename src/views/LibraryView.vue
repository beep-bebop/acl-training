<script setup>
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppIcon from '../components/ui/AppIcon.vue';
import BottomSheet from '../components/ui/BottomSheet.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import SegmentedControl from '../components/ui/SegmentedControl.vue';
import { useCatalogStore } from '../stores/catalog.js';
import { useUiStore } from '../stores/ui.js';
import { MODULE_TYPES } from '../core/config.js';
import { estimatePlanMinutes } from '../core/metrics.js';

const router = useRouter();
const catalog = useCatalogStore();
const ui = useUiStore();

const openCoaching = ref(null); // 展开进阶标准的分组 id

function exCount(plan) {
  return plan.modules.reduce((s, m) => s + m.exercises.length, 0);
}
function modTypeChips(plan) {
  const types = [...new Set(plan.modules.map((m) => m.type))];
  return types.map((t) => MODULE_TYPES[t]?.label || t);
}

// ---------- 分组 / 计划管理 ----------
const groupSheet = reactive({ open: false, mode: 'add-plan', group: null });
const renameForm = ref('');
const newPlanName = ref('');

function openGroupSheet(mode, group) {
  groupSheet.open = true;
  groupSheet.mode = mode;
  groupSheet.group = group;
  renameForm.value = mode === 'rename' ? group.name : '';
  newPlanName.value = '';
}

async function submitGroupSheet() {
  const { mode, group } = groupSheet;
  if (mode === 'rename') {
    if (!renameForm.value.trim()) return;
    catalog.updateGroup(group.id, { name: renameForm.value.trim() });
    ui.toast('已重命名', 'success');
  } else if (mode === 'add-plan') {
    if (!newPlanName.value.trim()) return;
    const plan = catalog.addPlan(group.id, newPlanName.value.trim());
    ui.toast('已创建计划，去添加动作', 'success');
    groupSheet.open = false;
    router.push(`/plan/${plan.id}`);
    return;
  }
  groupSheet.open = false;
}

async function deleteGroup(group) {
  const ok = await ui.confirmAsync({
    title: `删除「${group.name}」？`,
    body: `该分组下 ${group.plans.length} 个计划将一并删除，训练记录保留。`,
    confirmText: '删除',
    danger: true
  });
  if (!ok) return;
  catalog.removeGroup(group.id);
  ui.toast('已删除分组');
}

// ---------- 计划管理 ----------
const planSheet = reactive({ open: false, mode: 'rename', plan: null });
const planName = ref('');

function openPlanSheet(mode, plan) {
  planSheet.open = true;
  planSheet.mode = mode;
  planSheet.plan = plan;
  planName.value = plan.name;
}

async function submitPlanSheet() {
  const { mode, plan } = planSheet;
  if (mode === 'rename') {
    if (!planName.value.trim()) return;
    catalog.updatePlan(plan.id, { name: planName.value.trim() });
    ui.toast('已重命名', 'success');
  }
  planSheet.open = false;
}

async function duplicatePlan(plan) {
  catalog.duplicatePlan(plan.id);
  ui.toast('已复制计划', 'success');
}

async function deletePlan(plan) {
  const ok = await ui.confirmAsync({
    title: `删除计划「${plan.name}」？`,
    body: '训练记录保留，动作配置将被删除。',
    confirmText: '删除',
    danger: true
  });
  if (!ok) return;
  catalog.removePlan(plan.id);
  ui.toast('已删除计划');
}

const addingGroup = ref(false);
const newGroupName = ref('');
async function addGroup() {
  if (!newGroupName.value.trim()) return;
  catalog.addGroup(newGroupName.value.trim());
  newGroupName.value = '';
  addingGroup.value = false;
  ui.toast('已创建分组', 'success');
}
</script>

<template>
  <div class="app-page">
    <div class="lib-hero">
      <div>
        <h1 class="t-display">计划库</h1>
        <p class="t-cap">{{ catalog.planGroups.length }} 个阶段 · {{ catalog.planCount }} 个计划 · {{ catalog.exerciseCount }} 个动作</p>
      </div>
    </div>

    <EmptyState
      v-if="!catalog.planGroups.length"
      icon="library"
      title="计划库是空的"
      desc="创建一个分组开始，或在桌面工作台导入 JSON 动作库"
    >
      <button class="btn btn-primary" @click="addingGroup = true">新建分组</button>
    </EmptyState>

    <section v-for="group in catalog.planGroups" :key="group.id" class="group" :style="{ '--stage': group.color }">
      <header class="group-head">
        <button class="group-info tap-row" @click="openCoaching = openCoaching === group.id ? null : group.id">
          <span class="group-bar stage-bar" />
          <div class="group-text">
            <div class="group-name">
              {{ group.name }}
              <span v-if="group.subtitle" class="t-mini">{{ group.subtitle }}</span>
            </div>
            <div class="t-mini">{{ group.plans.length }} 个计划</div>
          </div>
          <AppIcon name="chevron" :size="16" class="group-chevron" :class="{ open: openCoaching === group.id }" />
        </button>
        <button class="icon-btn" aria-label="分组操作" @click.stop="openGroupSheet('add-plan', group)">
          <AppIcon name="plus" :size="20" />
        </button>
      </header>

      <div v-if="openCoaching === group.id" class="group-coaching">
        <template v-if="group.coaching?.phaseGoal">
          <p class="gc-title">阶段目标</p>
          <p class="gc-text">{{ group.coaching.phaseGoal }}</p>
        </template>
        <template v-if="group.coaching?.progressCriteria?.length">
          <p class="gc-title">进阶标准</p>
          <ul class="gc-list">
            <li v-for="(c, i) in group.coaching.progressCriteria" :key="i">{{ c }}</li>
          </ul>
        </template>
        <p v-if="group.coaching?.caution" class="gc-caution">⚠ {{ group.coaching.caution }}</p>
        <div class="gc-actions">
          <button class="btn btn-sm btn-ghost" @click="openGroupSheet('rename', group)">重命名</button>
          <button class="btn btn-sm btn-danger" @click="deleteGroup(group)">删除分组</button>
        </div>
      </div>

      <div class="plan-list">
        <div v-for="plan in group.plans" :key="plan.id" class="plan-card card tap-row" @click="router.push(`/plan/${plan.id}`)">
          <div class="plan-main">
            <div class="plan-name">{{ plan.name }}</div>
            <div class="plan-meta">
              <span class="num">{{ exCount(plan) }} 动作</span>
              <span class="dot-sep" />
              <span class="num">~{{ estimatePlanMinutes(plan) }} 分钟</span>
            </div>
            <div class="plan-chips">
              <span v-for="label in modTypeChips(plan)" :key="label" class="chip">{{ label }}</span>
            </div>
          </div>
          <button class="icon-btn plan-more" aria-label="计划操作" @click.stop="openPlanSheet('menu', plan)">
            <AppIcon name="edit" :size="18" />
          </button>
        </div>
      </div>
    </section>

    <button v-if="catalog.planGroups.length" class="btn btn-ghost add-group" @click="addingGroup = true">
      <AppIcon name="plus" :size="18" />
      新建分组
    </button>

    <!-- 分组操作抽屉 -->
    <BottomSheet v-model="groupSheet.open" :title="groupSheet.mode === 'rename' ? '重命名分组' : `在「${groupSheet.group?.name}」中新建计划`">
      <div v-if="groupSheet.mode === 'rename'" class="field">
        <span class="field-label">分组名称</span>
        <input v-model="renameForm" class="field-input" placeholder="如：进阶强化期" @keyup.enter="submitGroupSheet" />
      </div>
      <div v-else class="field">
        <span class="field-label">计划名称</span>
        <input v-model="newPlanName" class="field-input" placeholder="如：推 A" @keyup.enter="submitGroupSheet" />
      </div>
      <template #footer>
        <button class="btn btn-ghost" @click="groupSheet.open = false">取消</button>
        <button class="btn btn-primary" @click="submitGroupSheet">{{ groupSheet.mode === 'rename' ? '保存' : '创建' }}</button>
      </template>
    </BottomSheet>

    <!-- 计划操作抽屉 -->
    <BottomSheet v-model="planSheet.open" :title="planSheet.plan?.name">
      <div class="menu-list">
        <div class="field">
          <span class="field-label">计划名称</span>
          <input v-model="planName" class="field-input" @keyup.enter="submitPlanSheet" />
        </div>
        <button class="btn btn-soft btn-block" @click="duplicatePlan(planSheet.plan); planSheet.open = false">
          <AppIcon name="copy" :size="16" /> 复制计划
        </button>
        <button class="btn btn-danger btn-block" @click="deletePlan(planSheet.plan); planSheet.open = false">
          <AppIcon name="trash" :size="16" /> 删除计划
        </button>
      </div>
      <template #footer>
        <button class="btn btn-ghost" @click="planSheet.open = false">取消</button>
        <button class="btn btn-primary" @click="submitPlanSheet">保存名称</button>
      </template>
    </BottomSheet>

    <!-- 新建分组 -->
    <BottomSheet v-model="addingGroup" title="新建分组">
      <div class="field">
        <span class="field-label">分组名称（如某个训练阶段）</span>
        <input v-model="newGroupName" class="field-input" placeholder="如：回归运动期" @keyup.enter="addGroup" />
      </div>
      <template #footer>
        <button class="btn btn-ghost" @click="addingGroup = false">取消</button>
        <button class="btn btn-primary" @click="addGroup">创建</button>
      </template>
    </BottomSheet>
  </div>
</template>

<style scoped>
.lib-hero {
  margin-bottom: 18px;
}
.group {
  margin-bottom: 22px;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
}
.group-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  padding: 8px;
}
.group-bar {
  width: 4px;
  align-self: stretch;
  border-radius: 2px;
}
.group-text {
  flex: 1;
  min-width: 0;
}
.group-name {
  font-size: 16.5px;
  font-weight: 800;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.group-chevron {
  color: var(--text-3);
  transition: transform var(--dur-mid) ease;
}
.group-chevron.open {
  transform: rotate(180deg);
}
.group-coaching {
  background: var(--bg-elev-1);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 14px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.gc-title {
  font-size: 11.5px;
  font-weight: 800;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 4px;
}
.gc-text {
  font-size: 13.5px;
  color: var(--text-2);
  line-height: 1.6;
}
.gc-list {
  padding-left: 18px;
  font-size: 13.5px;
  color: var(--text-2);
  line-height: 1.7;
}
.gc-caution {
  font-size: 12.5px;
  color: var(--warning);
}
.gc-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.plan-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.plan-card {
  display: flex;
  align-items: center;
  padding: 14px 12px 14px 16px;
}
.plan-main {
  flex: 1;
  min-width: 0;
}
.plan-name {
  font-size: 15.5px;
  font-weight: 700;
  margin-bottom: 4px;
}
.plan-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--text-3);
  margin-bottom: 7px;
}
.dot-sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-3);
}
.plan-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.plan-chips .chip {
  font-size: 11px;
  padding: 2px 8px;
}
.add-group {
  width: 100%;
  margin-top: 4px;
  border-style: dashed;
}
.menu-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
