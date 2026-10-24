<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <button
    class="toggle"
    role="switch"
    :aria-checked="modelValue"
    :class="{ on: modelValue, disabled }"
    @click="!disabled && emit('update:modelValue', !modelValue)"
  >
    <span class="toggle-knob" />
  </button>
</template>

<style scoped>
.toggle {
  width: 50px;
  height: 30px;
  border-radius: 15px;
  background: var(--bg-elev-3);
  border: 1px solid var(--border-strong);
  position: relative;
  transition: background var(--dur-mid) ease, border-color var(--dur-mid) ease;
  flex-shrink: 0;
}
.toggle.on {
  background: var(--accent);
  border-color: var(--accent);
}
.toggle.disabled {
  opacity: 0.4;
  pointer-events: none;
}
.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  transition: transform var(--dur-mid) var(--ease-spring);
}
.toggle.on .toggle-knob {
  transform: translateX(20px);
}
</style>
