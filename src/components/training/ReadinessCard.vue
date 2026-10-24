<script setup>
import { computed, reactive } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import { useLogsStore } from '../../stores/logs.js';
import { useUiStore } from '../../stores/ui.js';
import { painBand, DEFAULT_PAIN_CEILING } from '../../core/config.js';

const logs = useLogsStore();
const ui = useUiStore();

const existing = computed(() => logs.readinessToday);
const editing = computed(() => !existing.value);

const form = reactive({ pain: 0, swelling: 0 });
const painBandCls = computed(() => painBand(editing.value ? form.pain : existing.value?.pain ?? 0).cls);
const overCeiling = computed(() => (editing.value ? form.pain : existing.value?.pain ?? 0) > DEFAULT_PAIN_CEILING);

function save() {
  logs.logReadiness({ pain: form.pain, swelling: form.swelling });
  ui.toast('晨检已记录', 'success');
}
</script>

<template>
  <div class="readiness card card-pad">
    <div class="rd-head">
      <div class="rd-title">
        <AppIcon name="heart" :size="16" />
        晨间状态
      </div>
      <span v-if="!editing" class="chip" :class="painBandCls">疼痛 {{ existing.pain }}/10 · 肿胀 {{ existing.swelling }}/10</span>
    </div>

    <template v-if="editing">
      <div class="rd-row">
        <span class="rd-label">疼痛</span>
        <div class="rd-scale">
          <button
            v-for="p in 6"
            :key="p - 1"
            class="rd-cell num"
            :class="[{ sel: form.pain === p - 1 }, painBand(p - 1).cls]"
            @click="form.pain = p - 1"
          >
            {{ p - 1 }}
          </button>
        </div>
      </div>
      <div class="rd-row">
        <span class="rd-label">肿胀</span>
        <div class="rd-scale">
          <button
            v-for="p in 6"
            :key="p - 1"
            class="rd-cell num"
            :class="{ sel: form.swelling === p - 1 }"
            @click="form.swelling = p - 1"
          >
            {{ p - 1 }}
          </button>
        </div>
      </div>
      <button class="btn btn-soft btn-sm" style="align-self: flex-start" @click="save">记录一下</button>
      <p v-if="overCeiling" class="rd-warn">⚠ 疼痛高于训练门槛（{{ DEFAULT_PAIN_CEILING }}/10），建议今天降级训练或休息</p>
    </template>

    <template v-else>
      <p v-if="overCeiling" class="rd-warn">⚠ 今天疼痛高于门槛，建议降低强度；参考动作处方的退阶方案</p>
      <p v-else class="rd-ok">状态良好，按计划训练 ✓</p>
    </template>
  </div>
</template>

<style scoped>
.readiness {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rd-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.rd-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14.5px;
  font-weight: 700;
  color: var(--text-2);
}
.rd-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rd-label {
  width: 34px;
  font-size: 13px;
  color: var(--text-3);
  font-weight: 600;
  flex-shrink: 0;
}
.rd-scale {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 5px;
  flex: 1;
}
.rd-cell {
  height: 36px;
  border-radius: var(--r-sm);
  background: var(--bg-elev-2);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-3);
  border: 1.5px solid transparent;
  transition: transform var(--dur-fast) ease;
}
.rd-cell:active {
  transform: scale(0.92);
}
.rd-cell.sel {
  border-color: transparent;
  color: #0d1117;
}
:root[data-theme='dark'] .rd-cell.sel {
  color: #0d1117;
}
.rd-warn {
  font-size: 12.5px;
  color: var(--warning);
  line-height: 1.5;
}
.rd-ok {
  font-size: 13px;
  color: var(--success);
}
</style>
