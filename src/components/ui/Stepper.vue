<script setup>
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 999 },
  step: { type: Number, default: 1 },
  unit: { type: String, default: '' },
  decimals: { type: Number, default: 0 }
});
const emit = defineEmits(['update:modelValue']);

const display = computed(() => (props.decimals ? Number(props.modelValue || 0).toFixed(props.decimals) : String(props.modelValue ?? 0)));

function change(delta) {
  const next = Math.round(((Number(props.modelValue) || 0) + delta) * 100) / 100;
  emit('update:modelValue', Math.min(props.max, Math.max(props.min, next)));
}
</script>

<template>
  <div class="stepper">
    <button class="step-btn" :disabled="modelValue <= min" aria-label="减少" @click="change(-step)">
      <AppIcon name="minus" :size="18" />
    </button>
    <div class="step-value num">
      {{ display }}<span v-if="unit" class="step-unit">{{ unit }}</span>
    </div>
    <button class="step-btn" :disabled="modelValue >= max" aria-label="增加" @click="change(step)">
      <AppIcon name="plus" :size="18" />
    </button>
  </div>
</template>

<style scoped>
.stepper {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 4px;
}
.step-btn {
  width: 42px;
  height: 42px;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-1);
  background: var(--bg-elev-3);
  transition: transform var(--dur-fast) ease, opacity var(--dur-fast) ease;
}
.step-btn:active {
  transform: scale(0.92);
}
.step-btn:disabled {
  opacity: 0.3;
}
.step-value {
  min-width: 76px;
  text-align: center;
  font-size: 19px;
  font-weight: 800;
}
.step-unit {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  margin-left: 3px;
}
</style>
