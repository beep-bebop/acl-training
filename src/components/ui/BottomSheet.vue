<script setup>
import AppIcon from './AppIcon.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' }
});
const emit = defineEmits(['update:modelValue', 'close']);

function close() {
  emit('update:modelValue', false);
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="modelValue" class="sheet-root">
        <div class="sheet-backdrop" @click="close" />
        <div class="sheet-panel">
          <div class="sheet-handle" />
          <header v-if="title" class="sheet-head">
            <h3>{{ title }}</h3>
            <button class="icon-btn" style="width: 36px; height: 36px" aria-label="关闭" @click="close">
              <AppIcon name="close" :size="18" />
            </button>
          </header>
          <div class="sheet-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="sheet-foot">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.sheet-root {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
}
.sheet-panel {
  position: relative;
  width: 100%;
  max-width: 480px;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: var(--r-lg) var(--r-lg) 0 0;
  box-shadow: var(--shadow-pop);
  padding-bottom: var(--sab);
}
.sheet-handle {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--border-strong);
  margin: 10px auto 2px;
  flex-shrink: 0;
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px 10px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.sheet-head h3 {
  font-size: 16px;
  font-weight: 700;
}
.sheet-body {
  overflow-y: auto;
  padding: 16px;
  -webkit-overflow-scrolling: touch;
}
.sheet-foot {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}
.sheet-foot > * {
  flex: 1;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity var(--dur-mid) ease;
}
.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform var(--dur-mid) var(--ease-spring);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(60%);
}
</style>
