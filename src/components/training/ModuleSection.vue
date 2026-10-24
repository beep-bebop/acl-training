<script setup>
import { computed, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import { MODULE_TYPES } from '../../core/config.js';
import { useTrainingStore } from '../../stores/training.js';

const props = defineProps({
  module: { type: Object, required: true },
  mode: { type: String, default: 'view' } // 'view' 计划详情 | 'train' 训练中
});

const training = useTrainingStore();
const localOpen = ref(true);

const typeMeta = computed(() => MODULE_TYPES[props.module.type] || MODULE_TYPES.custom);
const isOpen = computed(() =>
  props.mode === 'train' ? Boolean(training.session?.openModules?.[props.module.id]) : localOpen.value
);

const doneCount = computed(() => {
  if (props.mode !== 'train' || !training.session) return 0;
  let done = 0;
  for (const ex of props.module.exercises) {
    for (let i = 0; i < ex.sets; i++) {
      if (training.session.progress[`${ex.id}_s${i}`]) done++;
    }
  }
  return done;
});
const totalCount = computed(() =>
  props.module.exercises.reduce((s, ex) => s + (ex.sets || 1), 0)
);

function toggle() {
  if (props.mode === 'train') training.setOpenModule(props.module.id, !isOpen.value);
  else localOpen.value = !localOpen.value;
}
</script>

<template>
  <section class="mod-section" :class="{ open: isOpen }">
    <button class="mod-head tap-row" @click="toggle">
      <span class="mod-type" :class="`mod-${module.type}`">{{ typeMeta.label }}</span>
      <div class="mod-info">
        <div class="mod-name">{{ module.name }}</div>
        <div v-if="module.intent" class="mod-intent">{{ module.intent }}</div>
      </div>
      <span v-if="mode === 'train'" class="mod-count num" :class="{ all: doneCount >= totalCount && totalCount > 0 }">
        {{ doneCount }}/{{ totalCount }}
      </span>
      <AppIcon name="chevron" :size="18" class="mod-chevron" />
    </button>
    <div v-if="isOpen" class="mod-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.mod-section {
  background: var(--bg-elev-1);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
}
.mod-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 0;
  text-align: left;
}
.mod-head:active {
  background: var(--bg-elev-2);
}
.mod-type {
  font-size: 11px;
  font-weight: 800;
  padding: 4px 9px;
  border-radius: var(--r-full);
  flex-shrink: 0;
}
.mod-info {
  flex: 1;
  min-width: 0;
}
.mod-name {
  font-size: 14.5px;
  font-weight: 700;
}
.mod-intent {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mod-count {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-3);
  flex-shrink: 0;
}
.mod-count.all {
  color: var(--accent);
}
.mod-chevron {
  color: var(--text-3);
  transition: transform var(--dur-mid) ease;
  flex-shrink: 0;
}
.mod-section.open .mod-chevron {
  transform: rotate(180deg);
}
.mod-body {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
