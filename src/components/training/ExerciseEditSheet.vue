<script setup>
// 移动端动作快速编辑：基础处方字段 + 提示；完整处方编辑请用桌面工作台
import { reactive, watch } from 'vue';
import BottomSheet from '../ui/BottomSheet.vue';
import Stepper from '../ui/Stepper.vue';
import SegmentedControl from '../ui/SegmentedControl.vue';
import { useCatalogStore } from '../../stores/catalog.js';
import { useUiStore } from '../../stores/ui.js';
import { LOAD_KINDS } from '../../core/config.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  exerciseId: { type: String, default: null },
  moduleId: { type: String, default: null }, // 有值 = 新建模式
  moduleType: { type: String, default: 'custom' }
});
const emit = defineEmits(['update:open']);

const catalog = useCatalogStore();
const ui = useUiStore();

const MODES = [
  { value: 'counted', label: '计次' },
  { value: 'timed', label: '计时' }
];
const KIND_OPTIONS = Object.entries(LOAD_KINDS).map(([value, cfg]) => ({ value, label: cfg.label }));

const form = reactive({
  name: '',
  mode: 'counted',
  sets: 3,
  reps: 10,
  duration: 60,
  rest: 60,
  loadKind: 'none',
  painCeiling: 3,
  tip: ''
});

watch(
  () => [props.open, props.exerciseId],
  () => {
    if (!props.open) return;
    if (props.exerciseId) {
      const found = catalog.findExercise(props.exerciseId);
      if (!found) return;
      Object.assign(form, {
        name: found.exercise.name,
        mode: found.exercise.mode,
        sets: found.exercise.sets,
        reps: found.exercise.reps ?? 10,
        duration: found.exercise.duration ?? 60,
        rest: found.exercise.rest,
        loadKind: found.exercise.load?.kind || 'none',
        painCeiling: found.exercise.prescription?.painCeiling ?? 3,
        tip: found.exercise.tip || ''
      });
    } else {
      Object.assign(form, { name: '', mode: 'counted', sets: 3, reps: 10, duration: 60, rest: 60, loadKind: 'none', painCeiling: 3, tip: '' });
    }
  },
  { immediate: true }
);

async function save() {
  if (!form.name.trim()) {
    ui.toast('请填写动作名称');
    return;
  }
  const patch = {
    name: form.name.trim(),
    mode: form.mode,
    sets: form.sets,
    rest: form.rest,
    tip: form.tip.trim() || undefined,
    load: { kind: form.loadKind },
    prescription: { painCeiling: form.painCeiling }
  };
  if (form.mode === 'timed') patch.duration = form.duration;
  else patch.reps = form.reps;

  if (props.exerciseId) {
    const found = catalog.findExercise(props.exerciseId);
    catalog.updateExercise(props.exerciseId, {
      ...patch,
      prescription: { ...(found.exercise.prescription || {}), painCeiling: form.painCeiling },
      tip: form.tip.trim() || found.exercise.tip
    });
    ui.toast('已保存', 'success');
  } else {
    catalog.addExercise(props.moduleId, patch);
    ui.toast('已添加动作', 'success');
  }
  emit('update:open', false);
}

async function remove() {
  const ok = await ui.confirmAsync({ title: '删除该动作？', confirmText: '删除', danger: true });
  if (!ok) return;
  catalog.removeExercise(props.exerciseId);
  ui.toast('已删除');
  emit('update:open', false);
}
</script>

<template>
  <BottomSheet :model-value="open" :title="exerciseId ? '编辑动作' : '添加动作'" @update:model-value="emit('update:open', $event)">
    <div class="exform">
      <div class="field">
        <span class="field-label">动作名称</span>
        <input v-model="form.name" class="field-input" placeholder="如：哑铃高脚杯深蹲" />
      </div>

      <div class="field">
        <span class="field-label">模式</span>
        <SegmentedControl v-model="form.mode" :options="MODES" />
      </div>

      <div class="field-pair">
        <div class="field">
          <span class="field-label">组数</span>
          <Stepper v-model="form.sets" :min="1" :max="20" unit="组" />
        </div>
        <div class="field">
          <span class="field-label">{{ form.mode === 'timed' ? '每组时长' : '每组次数' }}</span>
          <Stepper v-if="form.mode === 'timed'" v-model="form.duration" :min="5" :max="600" :step="5" unit="秒" />
          <Stepper v-else v-model="form.reps" :min="1" :max="100" unit="次" />
        </div>
      </div>

      <div class="field-pair">
        <div class="field">
          <span class="field-label">组间休息</span>
          <Stepper v-model="form.rest" :min="0" :max="600" :step="15" unit="秒" />
        </div>
        <div class="field">
          <span class="field-label">疼痛上限</span>
          <Stepper v-model="form.painCeiling" :min="0" :max="10" unit="/10" />
        </div>
      </div>

      <div class="field">
        <span class="field-label">负荷类型（渐进引擎依据）</span>
        <select v-model="form.loadKind" class="field-select">
          <option v-for="opt in KIND_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>

      <div class="field">
        <span class="field-label">动作提示</span>
        <textarea v-model="form.tip" class="field-textarea" rows="3" placeholder="要点、呼吸、注意事项…" />
      </div>

      <button v-if="exerciseId" class="btn btn-danger btn-block" @click="remove">
        删除动作
      </button>
    </div>

    <template #footer>
      <button class="btn btn-ghost" @click="emit('update:open', false)">取消</button>
      <button class="btn btn-primary" @click="save">保存</button>
    </template>
  </BottomSheet>
</template>

<style scoped>
.exform {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.field-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
</style>
