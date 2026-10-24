<script setup>
import { useUiStore } from '../../stores/ui.js';
import AppIcon from './AppIcon.vue';

const ui = useUiStore();
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" appear>
      <div v-if="ui.confirm.open" class="confirm-root">
        <div class="confirm-backdrop" @click="ui.settleConfirm(false)" />
        <div class="confirm-panel" role="alertdialog">
          <div class="confirm-icon" :class="{ danger: ui.confirm.danger }">
            <AppIcon :name="ui.confirm.danger ? 'warn' : 'info'" :size="22" />
          </div>
          <h3 class="confirm-title">{{ ui.confirm.title }}</h3>
          <p v-if="ui.confirm.body" class="confirm-body">{{ ui.confirm.body }}</p>
          <div class="confirm-actions">
            <button class="btn btn-ghost" @click="ui.settleConfirm(false)">{{ ui.confirm.cancelText }}</button>
            <button class="btn" :class="ui.confirm.danger ? 'btn-danger' : 'btn-primary'" @click="ui.settleConfirm(true)">
              {{ ui.confirm.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-root {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.confirm-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}
.confirm-panel {
  position: relative;
  width: min(90vw, 340px);
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 22px 20px 16px;
  box-shadow: var(--shadow-pop);
  text-align: center;
}
.confirm-icon {
  width: 44px;
  height: 44px;
  margin: 0 auto 12px;
  border-radius: var(--r-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--info);
  background: var(--info-dim);
}
.confirm-icon.danger {
  color: var(--danger);
  background: var(--danger-dim);
}
.confirm-title {
  font-size: 16.5px;
  font-weight: 700;
}
.confirm-body {
  margin-top: 8px;
  font-size: 13.5px;
  color: var(--text-2);
  line-height: 1.55;
  white-space: pre-line;
}
.confirm-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}
.confirm-actions .btn {
  flex: 1;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--dur-fast) ease;
}
.modal-enter-active .confirm-panel {
  transition: transform var(--dur-mid) var(--ease-spring);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .confirm-panel {
  transform: scale(0.92);
}
</style>
