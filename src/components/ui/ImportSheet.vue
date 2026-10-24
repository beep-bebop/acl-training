<script setup>
// 通用导入抽屉：粘贴 / 文件 → 解析预览 → 策略合并。
// mode 'catalog'：只导目录（merge 覆盖 / append 追加）；mode 'snapshot'：整包替换（二次确认）。
import { computed, ref, watch } from 'vue';
import BottomSheet from './BottomSheet.vue';
import SegmentedControl from './SegmentedControl.vue';
import AppIcon from './AppIcon.vue';
import { readFileAsText } from '../../utils/export.js';
import { migrateCatalogInput } from '../../core/migration.js';
import { normalizeSnapshot } from '../../core/schema.js';
import { useCatalogStore } from '../../stores/catalog.js';
import { useProgramStore } from '../../stores/program.js';
import { useLogsStore } from '../../stores/logs.js';
import { useSettingsStore } from '../../stores/settings.js';
import { useUiStore } from '../../stores/ui.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  mode: { type: String, default: 'catalog' }
});
const emit = defineEmits(['update:open', 'applied']);

const catalog = useCatalogStore();
const program = useProgramStore();
const logs = useLogsStore();
const settings = useSettingsStore();
const ui = useUiStore();

const text = ref('');
const strategy = ref('merge');
const parsed = ref(null); // { kind: 'catalog'|'snapshot', catalog, snapshot, summary }
const error = ref('');

watch(
  () => props.open,
  (open) => {
    if (open) {
      text.value = '';
      parsed.value = null;
      error.value = '';
      strategy.value = props.mode === 'snapshot' ? 'replace' : 'merge';
    }
  }
);

const STRATEGY_OPTIONS = computed(() =>
  props.mode === 'snapshot'
    ? [{ value: 'replace', label: '整包替换' }]
    : [
        { value: 'merge', label: '覆盖同名' },
        { value: 'append', label: '全部追加' }
      ]
);

function summarize(catalogData) {
  const s = { groups: catalogData.planGroups.length, plans: 0, modules: 0, exercises: 0 };
  for (const g of catalogData.planGroups) {
    s.plans += g.plans.length;
    for (const p of g.plans) {
      s.modules += p.modules.length;
      for (const m of p.modules) s.exercises += m.exercises.length;
    }
  }
  return s;
}

function parse() {
  error.value = '';
  parsed.value = null;
  const raw = text.value.trim();
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    // 完整快照 / 备份载荷
    const snapshotRaw = data.snapshot?.version ? data.snapshot : data.version && data.logs ? data : null;
    const catalogData = migrateCatalogInput(data);
    if (snapshotRaw) {
      const snapshot = normalizeSnapshot(snapshotRaw);
      parsed.value = { kind: 'snapshot', snapshot, summary: summarize(snapshot.catalog) };
    } else if (catalogData) {
      parsed.value = { kind: 'catalog', catalog: catalogData, summary: summarize(catalogData) };
    } else {
      error.value = '无法识别的格式：需要动作目录或完整快照 JSON';
    }
  } catch (e) {
    error.value = `JSON 解析失败：${e.message}`;
  }
}

const conflictPlans = computed(() => {
  if (!parsed.value || parsed.value.kind !== 'catalog') return { total: 0, conflicts: 0 };
  const existing = new Set(catalog.flatPlans.map((p) => p.id));
  let total = 0;
  let conflicts = 0;
  for (const g of parsed.value.catalog.planGroups) {
    for (const p of g.plans) {
      total++;
      if (existing.has(p.id)) conflicts++;
    }
  }
  return { total, conflicts };
});

async function onFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  text.value = await readFileAsText(file);
  parse();
  e.target.value = '';
}

async function apply() {
  if (!parsed.value) return;
  if (parsed.value.kind === 'snapshot') {
    const ok = await ui.confirmAsync({
      title: '整包替换当前数据？',
      body: '本地计划、周期、训练记录与设置都会被导入内容覆盖（AI key 除外）。',
      confirmText: '替换',
      danger: true
    });
    if (!ok) return;
    const snap = parsed.value.snapshot;
    catalog.hydrate(snap.catalog);
    program.hydrate(snap.program);
    logs.hydrate(snap.logs);
    const { apiKey } = settings.ai;
    settings.hydrate({ ...snap.settings, ai: { ...snap.settings.ai, apiKey } });
    ui.toast('已导入完整快照', 'success');
  } else {
    const result = catalog.importCatalog(parsed.value.catalog, strategy.value);
    ui.toast(`导入完成：${result.added} 新增，${result.updated} 更新`, 'success');
  }
  emit('applied');
  emit('update:open', false);
}
</script>

<template>
  <BottomSheet :model-value="open" title="导入数据" @update:model-value="emit('update:open', $event)">
    <div class="import">
      <div class="field">
        <span class="field-label">粘贴 JSON，或选择文件</span>
        <textarea v-model="text" class="field-textarea" rows="5" placeholder='{"version": 9, "planGroups": […]}' @blur="parse" />
      </div>

      <label class="file-label btn btn-soft">
        <AppIcon name="upload" :size="16" />
        选择 JSON 文件
        <input type="file" accept=".json,application/json" hidden @change="onFile" />
      </label>

      <div v-if="error" class="import-error">{{ error }}</div>

      <template v-if="parsed">
        <div class="preview card card-pad">
          <div class="pv-head">
            <span class="chip chip-accent">{{ parsed.kind === 'snapshot' ? '完整快照' : '动作目录' }}</span>
            <span class="pv-counts num">
              {{ parsed.summary.groups }} 阶段 · {{ parsed.summary.plans }} 计划 · {{ parsed.summary.modules }} 模块 · {{ parsed.summary.exercises }} 动作
            </span>
          </div>
          <p v-if="parsed.kind === 'catalog' && conflictPlans.conflicts" class="pv-warn">
            其中 {{ conflictPlans.conflicts }}/{{ conflictPlans.total }} 个计划与本地同名
          </p>
        </div>

        <div v-if="parsed.kind === 'catalog'" class="field">
          <span class="field-label">合并策略</span>
          <SegmentedControl v-model="strategy" :options="STRATEGY_OPTIONS" />
          <span class="t-mini">{{ strategy === 'merge' ? '同名计划将被导入版本覆盖，其余新增' : '全部作为新计划追加，同名自动重命名' }}</span>
        </div>
      </template>
    </div>

    <template #footer>
      <button class="btn btn-ghost" @click="emit('update:open', false)">取消</button>
      <button class="btn btn-primary" :disabled="!parsed" @click="apply">导入</button>
    </template>
  </BottomSheet>
</template>

<style scoped>
.import {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.file-label {
  align-self: flex-start;
  cursor: pointer;
}
.import-error {
  color: var(--danger);
  font-size: 13px;
}
.preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
}
.pv-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.pv-counts {
  font-size: 12.5px;
  color: var(--text-2);
  font-weight: 600;
}
.pv-warn {
  font-size: 12.5px;
  color: var(--warning);
}
</style>
