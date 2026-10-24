<script setup>
import { ref, watch } from 'vue';
import BottomSheet from '../ui/BottomSheet.vue';
import AppIcon from '../ui/AppIcon.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  summary: { type: Object, required: true } // { durationSec, setsDone, setsTotal, volume, avgPain }
});
const emit = defineEmits(['update:open', 'save', 'discard']);

const rpe = ref(7);
const notes = ref('');

watch(
  () => props.open,
  (open) => {
    if (open) {
      rpe.value = 7;
      notes.value = '';
    }
  }
);

function fmtDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m} 分 ${s.toString().padStart(2, '0')} 秒` : `${s} 秒`;
}

const RPE_HINTS = { 6: '轻松', 7: '尚可', 8: '吃力', 9: '很吃力', 10: '极限' };
</script>

<template>
  <BottomSheet :model-value="open" title="训练完成" @update:model-value="emit('update:open', $event)">
    <div class="summary">
      <div class="sum-grid">
        <div class="sum-item">
          <AppIcon name="clock" :size="18" />
          <span class="sum-value num">{{ fmtDuration(summary.durationSec) }}</span>
          <span class="sum-label">时长</span>
        </div>
        <div class="sum-item">
          <AppIcon name="check" :size="18" />
          <span class="sum-value num">{{ summary.setsDone }}<small>/{{ summary.setsTotal }}</small></span>
          <span class="sum-label">完成组数</span>
        </div>
        <div class="sum-item">
          <AppIcon name="bolt" :size="18" />
          <span class="sum-value num">{{ summary.volume || '—' }}</span>
          <span class="sum-label">总负荷量</span>
        </div>
        <div class="sum-item">
          <AppIcon name="heart" :size="18" />
          <span class="sum-value num">{{ summary.avgPain != null ? summary.avgPain : '—' }}</span>
          <span class="sum-label">平均疼痛</span>
        </div>
      </div>

      <div class="field">
        <span class="field-label">本次主观强度 RPE（6-10）</span>
        <div class="rpe-grid">
          <button
            v-for="v in [6, 7, 8, 9, 10]"
            :key="v"
            class="rpe-cell num"
            :class="{ active: rpe === v }"
            @click="rpe = v"
          >
            <span class="rpe-num">{{ v }}</span>
            <span class="rpe-hint">{{ RPE_HINTS[v] }}</span>
          </button>
        </div>
      </div>

      <div class="field">
        <span class="field-label">备注（可选）</span>
        <textarea v-model="notes" class="field-textarea" rows="2" placeholder="今天的感觉、疼痛反应、下次调整…" />
      </div>

      <button class="discard" @click="emit('discard')">放弃本次记录（不保存）</button>
    </div>

    <template #footer>
      <button class="btn btn-ghost" @click="emit('update:open', false)">继续训练</button>
      <button class="btn btn-primary" @click="emit('save', { rpe: rpe, notes: notes })">保存记录</button>
    </template>
  </BottomSheet>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.sum-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.sum-item {
  background: var(--bg-elev-1);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--text-3);
}
.sum-item svg {
  margin-bottom: 6px;
  color: var(--accent);
}
.sum-value {
  font-size: 21px;
  font-weight: 800;
  color: var(--text-1);
}
.sum-value small {
  font-size: 13px;
  color: var(--text-3);
  font-weight: 600;
}
.sum-label {
  font-size: 12px;
  color: var(--text-3);
}
.rpe-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
.rpe-cell {
  height: 56px;
  border-radius: var(--r-md);
  background: var(--bg-elev-2);
  border: 1.5px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: transform var(--dur-fast) ease, border-color var(--dur-fast) ease, background var(--dur-fast) ease;
}
.rpe-cell:active {
  transform: scale(0.93);
}
.rpe-cell.active {
  border-color: var(--accent);
  background: var(--accent-dim);
}
.rpe-num {
  font-size: 19px;
  font-weight: 800;
}
.rpe-cell.active .rpe-num {
  color: var(--accent);
}
.rpe-hint {
  font-size: 10.5px;
  color: var(--text-3);
}
.discard {
  align-self: center;
  font-size: 12px;
  color: var(--text-3);
  text-decoration: underline dotted;
  padding: 4px 8px;
}
</style>
