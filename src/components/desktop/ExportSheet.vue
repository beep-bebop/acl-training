<script setup>
// 导出抽屉：按阶段/计划勾选子集，复制或下载 JSON
import { computed, reactive, watch } from 'vue';
import BottomSheet from '../ui/BottomSheet.vue';
import AppIcon from '../ui/AppIcon.vue';
import { useCatalogStore } from '../../stores/catalog.js';
import { useUiStore } from '../../stores/ui.js';
import { SCHEMA_VERSION } from '../../core/schema.js';
import { downloadJson, copyText } from '../../utils/export.js';

const props = defineProps({ open: { type: Boolean, default: false } });
const emit = defineEmits(['update:open']);

const catalog = useCatalogStore();
const ui = useUiStore();

const checked = reactive({ groups: {}, plans: {} });

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    checked.groups = {};
    checked.plans = {};
    for (const g of catalog.planGroups) {
      checked.groups[g.id] = true;
      for (const p of g.plans) checked.plans[p.id] = true;
    }
  }
);

function toggleGroup(group) {
  const next = !checked.groups[group.id];
  checked.groups[group.id] = next;
  for (const p of group.plans) checked.plans[p.id] = next;
}
function togglePlan(group, plan) {
  checked.plans[plan.id] = !checked.plans[plan.id];
  if (!checked.plans[plan.id]) checked.groups[group.id] = false;
  else if (group.plans.every((p) => checked.plans[p.id])) checked.groups[group.id] = true;
}

const payload = computed(() => {
  const groups = catalog.planGroups
    .map((g) => ({
      ...JSON.parse(JSON.stringify(g)),
      plans: g.plans.filter((p) => checked.plans[p.id])
    }))
    .filter((g) => g.plans.length);
  return { app: 'acl-training', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), planGroups: groups };
});

const summary = computed(() => {
  const plans = payload.value.planGroups.reduce((s, g) => s + g.plans.length, 0);
  const exercises = payload.value.planGroups.reduce(
    (s, g) => s + g.plans.reduce((s2, p) => s2 + p.modules.reduce((s3, m) => s3 + m.exercises.length, 0), 0),
    0
  );
  return { groups: payload.value.planGroups.length, plans, exercises };
});

async function copy() {
  const ok = await copyText(JSON.stringify(payload.value, null, 2));
  ui.toast(ok ? '已复制到剪贴板' : '复制失败', ok ? 'success' : 'error');
}
function download() {
  downloadJson(`acl-catalog-${summary.value.plans}plans-${Date.now()}.json`, payload.value);
  ui.toast('已下载', 'success');
}
</script>

<template>
  <BottomSheet :model-value="open" title="导出动作库" @update:model-value="emit('update:open', $event)">
    <div class="exp">
      <div v-for="group in catalog.planGroups" :key="group.id" class="exp-group">
        <label class="exp-row group-row" :style="{ '--stage': group.color }">
          <input
            type="checkbox"
            class="cb"
            :checked="checked.groups[group.id]"
            @change="toggleGroup(group)"
          />
          <span class="exp-dot stage-bar" />
          <span class="exp-name">{{ group.name }}</span>
          <span class="t-mini num">{{ group.plans.length }}</span>
        </label>
        <label v-for="plan in group.plans" :key="plan.id" class="exp-row plan-row">
          <input
            type="checkbox"
            class="cb"
            :checked="checked.plans[plan.id]"
            @change="togglePlan(group, plan)"
          />
          <span class="exp-name">{{ plan.name }}</span>
          <span class="t-mini num">{{ plan.modules.reduce((s, m) => s + m.exercises.length, 0) }} 动作</span>
        </label>
      </div>

      <div class="exp-summary num">
        已选 {{ summary.groups }} 阶段 · {{ summary.plans }} 计划 · {{ summary.exercises }} 动作
      </div>
    </div>

    <template #footer>
      <button class="btn btn-ghost" @click="copy">
        <AppIcon name="copy" :size="16" /> 复制
      </button>
      <button class="btn btn-primary" :disabled="!summary.plans" @click="download">
        <AppIcon name="download" :size="16" /> 下载 JSON
      </button>
    </template>
  </BottomSheet>
</template>

<style scoped>
.exp {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.exp-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}
.exp-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--r-sm);
  cursor: pointer;
}
.exp-row:hover {
  background: var(--bg-elev-1);
}
.plan-row {
  padding-left: 38px;
}
.cb {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
  flex-shrink: 0;
}
.exp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.exp-name {
  flex: 1;
  font-size: 14px;
  font-weight: 650;
}
.group-row .exp-name {
  font-weight: 800;
}
.exp-summary {
  position: sticky;
  bottom: 0;
  background: var(--bg-elev-2);
  padding: 10px 12px;
  border-radius: var(--r-sm);
  font-size: 13px;
  color: var(--text-2);
  font-weight: 600;
}
</style>
