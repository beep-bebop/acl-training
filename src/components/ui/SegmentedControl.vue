<script setup>
const props = defineProps({
  modelValue: { type: [String, Number, null], default: null },
  options: { type: Array, required: true }
});
const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <div class="segmented" role="tablist">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      class="seg-item"
      :class="{ active: props.modelValue === opt.value }"
      role="tab"
      :aria-selected="props.modelValue === opt.value"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: flex;
  gap: 4px;
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.segmented::-webkit-scrollbar {
  display: none;
}
.seg-item {
  flex: 1;
  min-height: 38px;
  padding: 0 14px;
  border-radius: calc(var(--r-md) - 4px);
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-2);
  white-space: nowrap;
  transition: background var(--dur-fast) ease, color var(--dur-fast) ease;
}
.seg-item.active {
  background: var(--bg-elev-3);
  color: var(--text-1);
  box-shadow: var(--shadow-card);
}
:root[data-theme='light'] .seg-item.active {
  background: #ffffff;
}
</style>
