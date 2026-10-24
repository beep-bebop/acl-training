<script setup>
// 处方全字段表单（选中动作的完整编辑）
import { computed, reactive, watch } from 'vue';
import { useCatalogStore } from '../../stores/catalog.js';
import { useUiStore } from '../../stores/ui.js';
import { LOAD_KINDS } from '../../core/config.js';

const props = defineProps({ exerciseId: { type: String, default: null } });
const catalog = useCatalogStore();
const ui = useUiStore();

const found = computed(() => (props.exerciseId ? catalog.findExercise(props.exerciseId) : null));
const exercise = computed(() => found.value?.exercise || null);

const form = reactive({ tip: '', equipment: '', painCeiling: 3, loadLevel: null });
const presc = reactive({
  movementPattern: '',
  targetTissue: '',
  intensity: '',
  targetRpe: '',
  tempo: '',
  stopCriteria: [],
  progression: '',
  regression: '',
  trackingMetric: ''
});

const PRESC_FIELDS = [
  { key: 'movementPattern', label: '动作模式' },
  { key: 'targetTissue', label: '目标组织' },
  { key: 'intensity', label: '强度' },
  { key: 'targetRpe', label: '目标 RPE' },
  { key: 'tempo', label: '节奏' },
  { key: 'progression', label: '进阶依据' },
  { key: 'regression', label: '退阶方案' },
  { key: 'trackingMetric', label: '追踪指标' }
];

watch(
  () => props.exerciseId,
  () => sync(),
  { immediate: true }
);
function sync() {
  const ex = exercise.value;
  if (!ex) return;
  form.tip = ex.tip || '';
  form.equipment = (ex.equipment || []).join('、');
  form.painCeiling = ex.prescription?.painCeiling ?? 3;
  form.loadLevel = ex.load?.level ?? null;
  for (const { key } of PRESC_FIELDS) presc[key] = ex.prescription?.[key] || '';
  presc.stopCriteria = [...(ex.prescription?.stopCriteria || [])];
}

const kindCfg = computed(() => LOAD_KINDS[exercise.value?.load?.kind] || LOAD_KINDS.none);

// 数组字段 ↔ 多行文本
const stopCriteriaText = computed({
  get: () => presc.stopCriteria.join('\n'),
  set: (v) => {
    presc.stopCriteria = v.split('\n');
  }
});

function save() {
  if (!exercise.value) return;
  catalog.updateExercise(exercise.value.id, {
    tip: form.tip.trim() || undefined,
    equipment: form.equipment.split(/[,，、\s]+/).filter(Boolean),
    load: { kind: exercise.value.load?.kind || 'none', ...(form.loadLevel != null ? { level: form.loadLevel } : {}) },
    prescription: {
      ...(exercise.value.prescription || {}),
      painCeiling: form.painCeiling,
      movementPattern: presc.movementPattern,
      targetTissue: presc.targetTissue,
      intensity: presc.intensity,
      targetRpe: presc.targetRpe,
      tempo: presc.tempo,
      stopCriteria: presc.stopCriteria.filter(Boolean),
      progression: presc.progression,
      regression: presc.regression,
      trackingMetric: presc.trackingMetric
    }
  });
  ui.toast('处方已保存', 'success');
}
</script>

<template>
  <div v-if="exercise" class="presc">
    <div class="presc-head">
      <h4>{{ exercise.name }}</h4>
      <span class="chip num">{{ exercise.sets }} × {{ exercise.mode === 'timed' ? `${exercise.duration}s` : exercise.reps }}</span>
    </div>

    <div class="field-pair">
      <div class="field">
        <span class="field-label">疼痛上限（0-10）</span>
        <input v-model.number="form.painCeiling" type="number" min="0" max="10" class="field-input num" />
      </div>
      <div v-if="kindCfg.step" class="field">
        <span class="field-label">基线负荷（{{ kindCfg.label }}）</span>
        <input v-model.number="form.loadLevel" type="number" min="0" class="field-input num" :step="kindCfg.step" :placeholder="kindCfg.hint" />
      </div>
    </div>

    <div class="field">
      <span class="field-label">器械（顿号/逗号分隔）</span>
      <input v-model="form.equipment" class="field-input" placeholder="哑铃、卧推凳" />
    </div>

    <div class="field">
      <span class="field-label">动作提示</span>
      <textarea v-model="form.tip" rows="3" class="field-textarea" />
    </div>

    <div class="presc-group">
      <div class="pg-title">处方参数</div>
      <div v-for="f in PRESC_FIELDS" :key="f.key" class="field">
        <span class="field-label">{{ f.label }}</span>
        <input v-model="presc[f.key]" class="field-input" />
      </div>
      <div class="field">
        <span class="field-label">停止标准（每行一条）</span>
        <textarea v-model="stopCriteriaText" rows="3" class="field-textarea" placeholder="疼痛超过上限&#10;出现肿胀或不稳感" />
      </div>
    </div>

    <button class="btn btn-primary btn-block" @click="save">保存处方</button>
  </div>

  <div v-else class="rp-empty">在表格中选中一个动作</div>
</template>

<style scoped>
.presc {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.presc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.presc-head h4 {
  font-size: 15px;
  font-weight: 800;
}
.field-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.presc-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-top: 1px solid var(--border);
  padding-top: 14px;
}
.pg-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--text-3);
  letter-spacing: 0.05em;
}
.rp-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-3);
  font-size: 13px;
}
</style>
