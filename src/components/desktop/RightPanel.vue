<script setup>
// 右侧面板：处方全字段表单 / JSON 双向同步 / AI 详解
import { ref } from 'vue';
import PrescForm from './PrescForm.vue';
import JsonPanel from './JsonPanel.vue';
import AiPanel from './AiPanel.vue';

defineProps({
  planId: { type: String, default: null },
  moduleId: { type: String, default: null },
  exerciseId: { type: String, default: null }
});

const TABS = [
  { value: 'presc', label: '处方' },
  { value: 'json', label: 'JSON' },
  { value: 'ai', label: 'AI' }
];
const tab = ref('presc');
</script>

<template>
  <aside class="rp">
    <div class="rp-tabs">
      <button
        v-for="t in TABS"
        :key="t.value"
        class="rp-tab"
        :class="{ active: tab === t.value }"
        @click="tab = t.value"
      >
        {{ t.label }}
      </button>
    </div>
    <div class="rp-body">
      <PrescForm v-if="tab === 'presc'" :exercise-id="exerciseId" />
      <JsonPanel v-else-if="tab === 'json'" :plan-id="planId" />
      <AiPanel v-else :exercise-id="exerciseId" />
    </div>
  </aside>
</template>

<style scoped>
.rp {
  width: 420px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.rp-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.rp-tab {
  flex: 1;
  height: 42px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-3);
  border-bottom: 2px solid transparent;
  transition: color var(--dur-fast) ease, border-color var(--dur-fast) ease;
}
.rp-tab.active {
  color: var(--text-1);
  border-bottom-color: var(--accent);
}
.rp-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
</style>
