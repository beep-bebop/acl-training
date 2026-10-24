<script setup>
// 左侧树导航：阶段 → 计划 → 模块
import { reactive, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import { useCatalogStore } from '../../stores/catalog.js';
import { useUiStore } from '../../stores/ui.js';
import { MODULE_TYPES } from '../../core/config.js';

const props = defineProps({
  selectedPlanId: { type: String, default: null },
  selectedModuleId: { type: String, default: null }
});
const emit = defineEmits(['select-plan', 'select-module']);

const catalog = useCatalogStore();
const ui = useUiStore();

const expandedGroups = ref(new Set());
// 默认展开选中计划所在的分组，避免树初始一片空白
function expandDefault(selectedPlanId) {
  if (!selectedPlanId) return;
  for (const g of catalog.planGroups) {
    if (g.plans.some((p) => p.id === selectedPlanId)) {
      const next = new Set(expandedGroups.value);
      next.add(g.id);
      expandedGroups.value = next;
      return;
    }
  }
}
expandDefault(props.selectedPlanId);
function toggleGroup(id) {
  const next = new Set(expandedGroups.value);
  next.has(id) ? next.delete(id) : next.add(id);
  expandedGroups.value = next;
}
function expand(id) {
  const next = new Set(expandedGroups.value);
  next.add(id);
  expandedGroups.value = next;
}

// 行内重命名
const renaming = reactive({ type: null, id: null, value: '' });
function startRename(type, id, value) {
  renaming.type = type;
  renaming.id = id;
  renaming.value = value;
}
function commitRename() {
  if (!renaming.value.trim()) return cancelRename();
  if (renaming.type === 'group') catalog.updateGroup(renaming.id, { name: renaming.value.trim() });
  if (renaming.type === 'plan') catalog.updatePlan(renaming.id, { name: renaming.value.trim() });
  cancelRename();
}
function cancelRename() {
  renaming.type = null;
  renaming.id = null;
}

async function removeGroup(group) {
  const ok = await ui.confirmAsync({
    title: `删除阶段「${group.name}」？`,
    body: `${group.plans.length} 个计划将一并删除。`,
    confirmText: '删除',
    danger: true
  });
  if (ok) catalog.removeGroup(group.id);
}
async function removePlan(plan) {
  const ok = await ui.confirmAsync({ title: `删除计划「${plan.name}」？`, confirmText: '删除', danger: true });
  if (ok) catalog.removePlan(plan.id);
}

const adding = reactive({ type: null, groupId: null, value: '' });
function submitAdd() {
  const name = adding.value.trim();
  if (!name) return (adding.type = null);
  if (adding.type === 'group') catalog.addGroup(name);
  if (adding.type === 'plan') {
    const plan = catalog.addPlan(adding.groupId, name);
    expand(adding.groupId);
    if (plan) emit('select-plan', plan.id);
  }
  adding.type = null;
  adding.value = '';
}
</script>

<template>
  <aside class="tree">
    <div class="tree-scroll">
      <div v-for="group in catalog.planGroups" :key="group.id" class="tree-group">
        <div class="tg-head">
          <button class="tg-toggle" @click="toggleGroup(group.id)">
            <AppIcon name="chevron" :size="13" :class="{ open: expandedGroups.has(group.id) }" />
          </button>
          <button class="tg-name tap-row" :style="{ '--stage': group.color }" @click="toggleGroup(group.id)">
            <span class="tg-dot stage-bar" />
            <template v-if="renaming.type === 'group' && renaming.id === group.id">
              <input
                v-model="renaming.value"
                class="rename-input"
                autofocus
                @keyup.enter="commitRename"
                @keyup.esc="cancelRename"
                @blur="commitRename"
                @click.stop
              />
            </template>
            <span v-else class="tg-label" @dblclick="startRename('group', group.id, group.name)">{{ group.name }}</span>
            <span class="tg-count num">{{ group.plans.length }}</span>
          </button>
          <div class="tg-actions">
            <button class="tree-icon" title="新建计划" @click="adding.type = 'plan'; adding.groupId = group.id; adding.value = ''; expand(group.id)">
              <AppIcon name="plus" :size="13" />
            </button>
            <button class="tree-icon danger" title="删除阶段" @click="removeGroup(group)">
              <AppIcon name="trash" :size="13" />
            </button>
          </div>
        </div>

        <div v-if="expandedGroups.has(group.id)" class="tg-plans">
          <div v-if="adding.type === 'plan' && adding.groupId === group.id" class="add-row">
            <input
              v-model="adding.value"
              class="rename-input"
              placeholder="新计划名称…"
              autofocus
              @keyup.enter="submitAdd"
              @keyup.esc="adding.type = null"
              @blur="submitAdd"
            />
          </div>
          <template v-for="plan in group.plans" :key="plan.id">
            <button
              class="plan-row tap-row"
              :class="{ active: plan.id === selectedPlanId }"
              @click="emit('select-plan', plan.id)"
            >
              <template v-if="renaming.type === 'plan' && renaming.id === plan.id">
                <input
                  v-model="renaming.value"
                  class="rename-input"
                  autofocus
                  @keyup.enter="commitRename"
                  @keyup.esc="cancelRename"
                  @blur="commitRename"
                  @click.stop
                />
              </template>
              <span v-else class="plan-label" @dblclick.stop="startRename('plan', plan.id, plan.name)">{{ plan.name }}</span>
              <span class="tg-count num">{{ plan.modules.reduce((s, m) => s + m.exercises.length, 0) }}</span>
              <span class="plan-actions" @click.stop>
                <button class="tree-icon" title="复制" @click="catalog.duplicatePlan(plan.id)">
                  <AppIcon name="copy" :size="12" />
                </button>
                <button class="tree-icon danger" title="删除" @click="removePlan(plan)">
                  <AppIcon name="trash" :size="12" />
                </button>
              </span>
            </button>

            <!-- 模块 -->
            <div v-if="plan.id === selectedPlanId" class="mod-rows">
              <button
                v-for="mod in plan.modules"
                :key="mod.id"
                class="mod-row tap-row"
                :class="{ active: mod.id === selectedModuleId }"
                @click="emit('select-module', mod.id)"
              >
                <span class="mod-chip" :class="`mod-${mod.type}`">{{ MODULE_TYPES[mod.type]?.label || mod.type }}</span>
                <span class="mod-name">{{ mod.name }}</span>
                <span class="tg-count num">{{ mod.exercises.length }}</span>
              </button>
            </div>
          </template>
        </div>
      </div>

      <div v-if="adding.type === 'group'" class="add-row tree-add">
        <input
          v-model="adding.value"
          class="rename-input"
          placeholder="新阶段名称…"
          autofocus
          @keyup.enter="submitAdd"
          @keyup.esc="adding.type = null"
          @blur="submitAdd"
        />
      </div>
      <button v-else class="btn btn-ghost tree-add-btn" @click="adding.type = 'group'; adding.value = ''">
        <AppIcon name="plus" :size="14" /> 新建阶段
      </button>
    </div>
  </aside>
</template>

<style scoped>
.tree {
  width: 268px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 10px 8px 30px;
}
.tg-head {
  display: flex;
  align-items: center;
  gap: 2px;
}
.tg-toggle {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
}
.tg-toggle svg {
  transition: transform var(--dur-mid) ease;
}
.tg-toggle svg.open {
  transform: rotate(180deg);
}
.tg-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 8px;
  font-size: 13.5px;
  font-weight: 800;
}
.tg-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.tg-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}
.tg-count {
  font-size: 11px;
  color: var(--text-3);
  font-weight: 700;
}
.tg-actions {
  display: none;
  gap: 2px;
}
.tg-head:hover .tg-actions {
  display: flex;
}
.tree-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--text-3);
}
.tree-icon:hover {
  background: var(--bg-elev-2);
  color: var(--text-1);
}
.tree-icon.danger:hover {
  color: var(--danger);
}
.tg-plans {
  padding-left: 18px;
}
.plan-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px 6px 14px;
  font-size: 13px;
  font-weight: 650;
  color: var(--text-2);
  border-left: 2px solid transparent;
}
.plan-row.active {
  color: var(--text-1);
  background: var(--bg-elev-2);
  border-left-color: var(--accent);
}
.plan-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}
.plan-actions {
  display: none;
  gap: 2px;
}
.plan-row:hover .plan-actions {
  display: flex;
}
.mod-rows {
  padding: 2px 0 6px 14px;
}
.mod-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 8px;
  font-size: 12.5px;
  color: var(--text-2);
}
.mod-row.active {
  background: var(--bg-elev-2);
  color: var(--text-1);
}
.mod-chip {
  font-size: 10px;
  font-weight: 800;
  padding: 1.5px 7px;
  border-radius: var(--r-full);
  flex-shrink: 0;
}
.mod-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}
.rename-input {
  width: 100%;
  background: var(--bg-elev-3);
  border: 1px solid var(--accent-line);
  border-radius: 6px;
  color: var(--text-1);
  font-size: 13px;
  padding: 3px 8px;
  outline: none;
}
.add-row {
  padding: 4px 8px;
}
.tree-add {
  margin-top: 8px;
}
.tree-add-btn {
  width: 100%;
  margin-top: 10px;
  border-style: dashed;
  min-height: 38px;
  font-size: 13px;
}
</style>
