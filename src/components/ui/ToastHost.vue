<script setup>
import { useUiStore } from '../../stores/ui.js';

const ui = useUiStore();
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-host">
      <div v-for="toast in ui.toasts" :key="toast.id" class="toast" :class="`toast-${toast.type}`">
        {{ toast.text }}
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<style>
.toast-host {
  position: fixed;
  top: calc(14px + var(--sat));
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  width: min(92vw, 420px);
}
.toast {
  max-width: 100%;
  padding: 10px 18px;
  border-radius: var(--r-full);
  background: var(--bg-elev-3);
  border: 1px solid var(--border-strong);
  color: var(--text-1);
  font-size: 13.5px;
  font-weight: 600;
  box-shadow: var(--shadow-pop);
}
.toast-success {
  background: var(--success-dim);
  border-color: color-mix(in srgb, var(--success) 40%, transparent);
  color: var(--success);
}
.toast-error {
  background: var(--danger-dim);
  border-color: color-mix(in srgb, var(--danger) 40%, transparent);
  color: var(--danger);
}
.toast-enter-active {
  animation: fade-up 220ms var(--ease-spring);
}
.toast-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
