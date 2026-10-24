<script setup>
import { computed, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';

const props = defineProps({
  exercise: { type: Object, required: true },
  doneMap: { type: Object, required: true }, // { [setIndex]: true }
  loggedMap: { type: Object, default: () => ({}) } // { [setIndex]: setLog } 有记录时角标
});
const emit = defineEmits(['toggle', 'edit']);

const sets = computed(() => Array.from({ length: props.exercise.sets || 1 }, (_, i) => i));

// 第一个未完成的组为“当前组”
const currentSet = computed(() => sets.value.find((i) => !props.doneMap[i]) ?? -1);

// 长按（450ms）打开组记录，普通点按切换完成
const suppressClick = ref(false);
let pressTimer = null;

function onPointerDown(index) {
  suppressClick.value = false;
  pressTimer = setTimeout(() => {
    suppressClick.value = true;
    emit('edit', index);
    vibrateTap();
  }, 450);
}
function cancelPress() {
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = null;
}
function onClick(index) {
  cancelPress();
  if (suppressClick.value) return;
  emit('toggle', index);
}
function vibrateTap() {
  try {
    navigator.vibrate?.(30);
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="set-grid" @contextmenu.prevent>
    <button
      v-for="i in sets"
      :key="i"
      class="set-btn"
      :class="{ done: doneMap[i], current: i === currentSet && !doneMap[i] }"
      :aria-label="`第 ${i + 1} 组${doneMap[i] ? '已完成' : ''}`"
      @pointerdown="onPointerDown(i)"
      @pointerup="cancelPress"
      @pointerleave="cancelPress"
      @pointercancel="cancelPress"
      @click="onClick(i)"
    >
      <AppIcon v-if="doneMap[i]" name="check" :size="20" class="set-check" />
      <template v-else>{{ i + 1 }}</template>
      <span v-if="loggedMap[i]" class="set-logged" title="有负荷/疼痛记录" />
    </button>
    <button class="set-btn set-more" aria-label="记录本组" @click="emit('edit', currentSet >= 0 ? currentSet : sets[sets.length - 1])">
      <AppIcon name="edit" :size="16" />
    </button>
  </div>
</template>

<style scoped>
.set-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  gap: 8px;
}
.set-btn {
  position: relative;
  height: 54px;
  border-radius: var(--r-md);
  border: 1.5px solid var(--border-strong);
  background: var(--bg-elev-2);
  color: var(--text-2);
  font-size: 19px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--dur-fast) ease, background var(--dur-fast) ease, border-color var(--dur-fast) ease, color var(--dur-fast) ease;
  user-select: none;
}
.set-btn:active {
  transform: scale(0.93);
}
.set-btn.current {
  border-color: var(--accent-line);
  color: var(--text-1);
  animation: pulse-ring 2s ease-out infinite;
}
.set-btn.done {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}
.set-check {
  stroke-width: 2.6;
}
.set-more {
  border-style: dashed;
  font-size: 0;
  color: var(--text-3);
}
.set-logged {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--info);
}
.set-btn.done .set-logged {
  background: var(--accent-ink);
}
</style>
