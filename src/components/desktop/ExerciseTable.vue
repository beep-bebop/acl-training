<script setup>
// 中部编辑区：模块头 + 动作表格（行内编辑 / 拖拽排序 / 复制删除 / 批量改休息）
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import { useCatalogStore } from '../../stores/catalog.js';
import { useUiStore } from '../../stores/ui.js';
import { MODULE_TYPES, MODULE_ORDER, LOAD_KINDS } from '../../core/config.js';

const props = defineProps({
  module: { type: Object, required: true },
  planId: { type: String, required: true },
  selected: { type: Boolean, default: false },
  selectedExerciseId: { type: String, default: null }
});
const emit = defineEmits(['select', 'select-exercise']);

const catalog = useCatalogStore();
const ui = useUiStore();

const headOpen = ref(false);
const typeOptions = MODULE_ORDER.map((t) => ({ value: t, label: MODULE_TYPES[t].label }));
const kindOptions = Object.entries(LOAD_KINDS).map(([value, cfg]) => ({ value, label: cfg.label }));

// 行内数值防抖提交
function patchEx(ex, patch) {
  catalog.updateExercise(ex.id, patch);
}

// 复制/删除
async function removeEx(ex) {
  const ok = await ui.confirmAsync({ title: `删除「${ex.name}」？`, confirmText: '删除', danger: true });
  if (ok) catalog.removeExercise(ex.id);
}

// ---------- 拖拽排序（SortableJS） ----------
let sortable = null;
onMounted(async () => {
  try {
    const [{ default: Sortable }] = await Promise.all([import('sortablejs')]);
    const tbody = document.getElementById(`tb-${props.module.id}`);
    if (!tbody) return;
    sortable = Sortable.create(tbody, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'row-ghost',
      onEnd({ oldIndex, newIndex }) {
        if (oldIndex !== newIndex) catalog.moveExercise(props.module.id, oldIndex, newIndex);
      }
    });
  } catch {
    /* 拖拽不可用时仍可用箭头 */
  }
});
onBeforeUnmount(() => sortable?.destroy());

function moveEx(index, delta) {
  const to = index + delta;
  if (to < 0 || to >= props.module.exercises.length) return;
  catalog.moveExercise(props.module.id, index, to);
  nextTick(() => document.getElementById(`tr-${props.module.id}-${to}`)?.scrollIntoView({ block: 'nearest' }));
}

async function removeModule() {
  const ok = await ui.confirmAsync({ title: `删除模块「${props.module.name}」？`, confirmText: '删除', danger: true });
  if (ok) catalog.removeModule(props.module.id);
}

// 添加动作
const addingName = ref('');
function addEx() {
  const name = addingName.value.trim();
  if (!name) return;
  const ex = catalog.addExercise(props.module.id, { name });
  addingName.value = '';
  if (ex) emit('select-exercise', ex.id);
}

function moduleIndex() {
  const found = catalog.findPlan(props.planId);
  return found ? found.plan.modules.findIndex((m) => m.id === props.module.id) : -1;
}
</script>

<template>
  <section class="mod-card" :class="{ selected }">
    <!-- 模块头 -->
    <header class="mc-head" @click="emit('select')">
      <span class="mod-chip" :class="`mod-${module.type}`">{{ MODULE_TYPES[module.type]?.label || module.type }}</span>
      <input
        class="mc-name"
        :value="module.name"
        @change="catalog.updateModule(module.id, { name: $event.target.value })"
        @click.stop
      />
      <select class="mc-type" :value="module.type" @change="catalog.updateModule(module.id, { type: $event.target.value })" @click.stop>
        <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <span class="mc-count num">{{ module.exercises.length }} 动作</span>
      <div class="mc-actions" @click.stop>
        <button class="tree-icon" title="上移" @click="catalog.moveModule(planId, moduleIndex(), -1)">
          <AppIcon name="back" :size="13" style="transform: rotate(90deg)" />
        </button>
        <button class="tree-icon" title="下移" @click="catalog.moveModule(planId, moduleIndex(), 1)">
          <AppIcon name="back" :size="13" style="transform: rotate(-90deg)" />
        </button>
        <button class="tree-icon danger" title="删除模块" @click="removeModule">
          <AppIcon name="trash" :size="13" />
        </button>
      </div>
    </header>
    <input
      class="mc-intent"
      :value="module.intent"
      placeholder="训练意图（可选）"
      @change="catalog.updateModule(module.id, { intent: $event.target.value })"
    />

    <!-- 动作表 -->
    <div class="table-wrap">
      <table class="ex-table">
        <thead>
          <tr>
            <th class="th-drag" />
            <th class="th-name">动作</th>
            <th class="th-mode">模式</th>
            <th class="th-num">组</th>
            <th class="th-num">次/秒</th>
            <th class="th-num">休息</th>
            <th class="th-kind">负荷</th>
            <th class="th-act" />
          </tr>
        </thead>
        <tbody :id="`tb-${module.id}`">
          <tr
            v-for="(ex, i) in module.exercises"
            :id="`tr-${module.id}-${i}`"
            :key="ex.id"
            class="ex-tr"
            :class="{ active: ex.id === selectedExerciseId }"
            @click="emit('select-exercise', ex.id)"
          >
            <td class="td-drag">
              <span class="drag-handle"><AppIcon name="grip" :size="15" /></span>
              <span class="tr-tools">
                <button class="tree-icon" title="上移" @click.stop="moveEx(i, -1)">‹</button>
                <button class="tree-icon" title="下移" @click.stop="moveEx(i, 1)">›</button>
              </span>
            </td>
            <td class="td-name">
              <input class="cell-input name" :value="ex.name" @change="patchEx(ex, { name: $event.target.value })" @click.stop />
            </td>
            <td class="td-mode">
              <select class="cell-select" :value="ex.mode" @change="patchEx(ex, { mode: $event.target.value })" @click.stop>
                <option value="counted">计次</option>
                <option value="timed">计时</option>
              </select>
            </td>
            <td class="td-num">
              <input class="cell-input num" type="number" min="1" max="20" :value="ex.sets" @change="patchEx(ex, { sets: Number($event.target.value) })" @click.stop />
            </td>
            <td class="td-num">
              <input
                v-if="ex.mode === 'timed'"
                class="cell-input num"
                type="number"
                min="5"
                step="5"
                :value="ex.duration"
                @change="patchEx(ex, { duration: Number($event.target.value) })"
                @click.stop
              />
              <input
                v-else
                class="cell-input num"
                type="number"
                min="1"
                :value="ex.reps"
                @change="patchEx(ex, { reps: Number($event.target.value) })"
                @click.stop
              />
            </td>
            <td class="td-num">
              <input class="cell-input num" type="number" min="0" step="15" :value="ex.rest" @change="patchEx(ex, { rest: Number($event.target.value) })" @click.stop />
            </td>
            <td class="td-kind">
              <select class="cell-select" :value="ex.load?.kind || 'none'" @change="patchEx(ex, { load: { kind: $event.target.value } })" @click.stop>
                <option v-for="opt in kindOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </td>
            <td class="td-act" @click.stop>
              <button class="tree-icon" title="复制" @click="catalog.duplicateExercise(ex.id)">
                <AppIcon name="copy" :size="13" />
              </button>
              <button class="tree-icon danger" title="删除" @click="removeEx(ex)">
                <AppIcon name="trash" :size="13" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mc-foot">
      <input v-model="addingName" class="field-input add-ex" placeholder="新动作名称，回车添加" @keyup.enter="addEx" />
      <span class="t-mini">选中行后，右侧面板编辑完整处方 / JSON / AI</span>
    </div>
  </section>
</template>

<style scoped>
.mod-card {
  background: var(--bg-elev-1);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mod-card.selected {
  border-color: var(--accent-line);
}
.mc-head {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.mc-name {
  flex: 1;
  min-width: 120px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-1);
  font-size: 14px;
  font-weight: 800;
  padding: 4px 8px;
  outline: none;
}
.mc-name:hover,
.mc-name:focus {
  border-color: var(--border-strong);
  background: var(--bg-elev-2);
}
.mc-type {
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-2);
  font-size: 12px;
  padding: 4px 6px;
  outline: none;
}
.mc-count {
  font-size: 11.5px;
  color: var(--text-3);
  font-weight: 700;
}
.mc-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--dur-fast) ease;
}
.mc-head:hover .mc-actions {
  opacity: 1;
}
.mc-intent {
  background: transparent;
  border: none;
  border-bottom: 1px dashed var(--border);
  color: var(--text-3);
  font-size: 12px;
  padding: 2px 8px;
  outline: none;
  margin-top: -4px;
}
.table-wrap {
  overflow-x: auto;
}
.ex-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.ex-table th {
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  padding: 4px 6px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.ex-tr {
  border-bottom: 1px solid var(--border);
}
.ex-tr:hover {
  background: var(--bg-elev-2);
}
.ex-tr.active {
  background: var(--accent-dim);
}
.ex-tr.row-ghost {
  opacity: 0.4;
}
.ex-td,
.ex-table td {
  padding: 4px 6px;
  vertical-align: middle;
}
.th-drag,
.td-drag {
  width: 44px;
}
.td-drag {
  display: flex;
  align-items: center;
}
.drag-handle {
  color: var(--text-3);
  cursor: grab;
  display: inline-flex;
}
.tr-tools {
  display: none;
  gap: 0;
}
.ex-tr:hover .tr-tools {
  display: inline-flex;
}
.ex-tr:hover .drag-handle {
  display: none;
}
.th-name,
.td-name {
  min-width: 200px;
}
.th-num,
.td-num {
  width: 64px;
}
.th-mode,
.td-mode,
.th-kind,
.td-kind {
  width: 72px;
}
.th-act,
.td-act {
  width: 60px;
  text-align: right;
  white-space: nowrap;
}
.cell-input,
.cell-select {
  width: 100%;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-1);
  font-size: 13px;
  padding: 5px 6px;
  outline: none;
}
.cell-input:hover,
.cell-input:focus,
.cell-select:hover,
.cell-select:focus {
  border-color: var(--border-strong);
  background: var(--bg-elev-2);
}
.cell-input.name {
  font-weight: 650;
}
.cell-select {
  color: var(--text-2);
  appearance: none;
}
.td-act .tree-icon {
  opacity: 0;
}
.ex-tr:hover .td-act .tree-icon {
  opacity: 1;
}
.mc-foot {
  display: flex;
  align-items: center;
  gap: 12px;
}
.add-ex {
  min-height: 40px;
  max-width: 320px;
}
</style>
