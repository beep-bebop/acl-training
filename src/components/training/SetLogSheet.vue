<script setup>
import { computed, reactive, watch } from 'vue';
import BottomSheet from '../ui/BottomSheet.vue';
import Stepper from '../ui/Stepper.vue';
import AppIcon from '../ui/AppIcon.vue';
import { useLogsStore } from '../../stores/logs.js';
import { useTrainingStore } from '../../stores/training.js';
import { LOAD_KINDS, painBand } from '../../core/config.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  exercise: { type: Object, default: null },
  setIndex: { type: Number, default: 0 }
});
const emit = defineEmits(['update:open', 'done']);

const logs = useLogsStore();
const training = useTrainingStore();

const form = reactive({ reps: 10, duration: 60, level: null, pain: 0 });

watch(
  () => [props.open, props.setIndex],
  () => {
    if (!props.open || !props.exercise) return;
    const date = training.session?.date;
    const planId = training.session?.planId;
    const existing = logs.setLogs.find(
      (l) => l.date === date && l.planId === planId && l.exerciseId === props.exercise.id && l.setIndex === props.setIndex
    );
    form.reps = existing?.reps ?? props.exercise.reps ?? 10;
    form.duration = existing?.duration ?? props.exercise.duration ?? 60;
    form.level = existing?.loadLevel ?? null;
    form.pain = existing?.pain ?? 0;
  },
  { immediate: true }
);

const loadCfg = computed(() => LOAD_KINDS[props.exercise?.load?.kind] || LOAD_KINDS.none);
const trackLoad = computed(() => props.exercise?.load?.kind && props.exercise.load.kind !== 'none');
const band = computed(() => painBand(form.pain));

const PAIN_OPTIONS = Array.from({ length: 11 }, (_, i) => i);

function save() {
  if (!props.exercise) return;
  logs.logSet({
    date: training.session?.date,
    planId: training.session?.planId,
    exerciseId: props.exercise.id,
    setIndex: props.setIndex,
    reps: props.exercise.mode === 'timed' ? null : form.reps,
    duration: props.exercise.mode === 'timed' ? form.duration : null,
    loadKind: props.exercise.load?.kind || 'none',
    loadLevel: trackLoad.value ? form.level : null,
    pain: form.pain
  });
  emit('done');
  emit('update:open', false);
}
</script>

<template>
  <BottomSheet :model-value="open" :title="`第 ${setIndex + 1} 组记录`" @update:model-value="emit('update:open', $event)">
    <div v-if="exercise" class="setlog">
      <div class="setlog-name">
        <AppIcon name="dumbbell" :size="16" />
        <span>{{ exercise.name }}</span>
      </div>

      <div v-if="exercise.mode !== 'timed'" class="field">
        <span class="field-label">实际次数</span>
        <Stepper v-model="form.reps" :min="0" :max="200" :step="1" unit="次" />
      </div>
      <div v-else class="field">
        <span class="field-label">实际时长</span>
        <Stepper v-model="form.duration" :min="0" :max="1800" :step="5" unit="秒" />
      </div>

      <div v-if="trackLoad" class="field">
        <span class="field-label">负荷（{{ loadCfg.label }}{{ loadCfg.hint ? ' · ' + loadCfg.hint : '' }}）</span>
        <Stepper v-model="form.level" :min="0" :max="loadCfg.dir < 0 ? 10 : 300" :step="loadCfg.step || 1" :unit="loadCfg.unit" :decimals="loadCfg.step % 1 ? 1 : 0" />
      </div>

      <div class="field">
        <span class="field-label">训练中疼痛（0-10）</span>
        <div class="pain-grid">
          <button
            v-for="p in PAIN_OPTIONS"
            :key="p"
            class="pain-cell num"
            :class="[p === form.pain ? `active ${band.cls}` : '']"
            @click="form.pain = p"
          >
            {{ p }}
          </button>
        </div>
        <span v-if="form.pain > (exercise.prescription?.painCeiling ?? 3)" class="pain-warn">
          ⚠ 超过疼痛上限 {{ exercise.prescription?.painCeiling ?? 3 }}：降低强度或停止该动作
        </span>
      </div>
    </div>

    <template #footer>
      <button class="btn btn-ghost" @click="emit('update:open', false)">取消</button>
      <button class="btn btn-primary" @click="save">保存记录</button>
    </template>
  </BottomSheet>
</template>

<style scoped>
.setlog {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.setlog-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-2);
}
.pain-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}
.pain-cell {
  height: 44px;
  border-radius: var(--r-sm);
  background: var(--bg-elev-2);
  border: 1.5px solid var(--border);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-2);
  transition: transform var(--dur-fast) ease;
}
.pain-cell:active {
  transform: scale(0.92);
}
.pain-cell.active {
  border-color: transparent;
  color: #fff;
}
:root[data-theme='dark'] .pain-cell.active {
  color: #0d1117;
}
.pain-warn {
  font-size: 12.5px;
  color: var(--warning);
  line-height: 1.5;
}
</style>
