<script setup>
import { computed } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import { useProgramStore } from '../../stores/program.js';
import { weekStatus, nextDeload, todayKey } from '../../core/periodization.js';

const program = useProgramStore();

const status = computed(() => weekStatus(program.$state, todayKey()));
const upcoming = computed(() => (status.value.isDeload ? null : nextDeload(program.$state, todayKey())));

// 当前 4 周块进度（到休息周）
const blockProgress = computed(() => {
  if (status.value.isDeload || !program.deloadEveryN) return null;
  const inBlock = ((status.value.weekIndex - 1) % program.deloadEveryN) + 1;
  return { current: inBlock, total: program.deloadEveryN };
});
</script>

<template>
  <div class="cycle card card-pad" :class="{ deload: status.isDeload }">
    <div class="cycle-top">
      <div>
        <div class="cycle-label">{{ status.isDeload ? '🌿 休息周' : '渐进周' }}</div>
        <div class="cycle-title num">{{ status.isDeload ? '恢复优先' : `第 ${Math.max(1, status.weekIndex)} 周` }}</div>
      </div>
      <router-link to="/program" class="cycle-manage">
        <AppIcon name="target" :size="15" />
        周期
      </router-link>
    </div>

    <div v-if="status.isDeload" class="cycle-hint">
      本周以恢复为主：降低训练容量，组织正在适应上一阶段的负荷。
    </div>
    <div v-else-if="upcoming" class="cycle-hint">
      下次休息周：{{ upcoming.daysAway <= 7 ? '下周' : `${upcoming.daysAway} 天后` }}
      <span class="t-mini">（第 {{ upcoming.weekIndex }} 周自动插入）</span>
    </div>
    <div v-else class="cycle-hint">未开启自动休息周，可在周期设置中开启</div>

    <div v-if="blockProgress" class="cycle-dots">
      <span
        v-for="i in blockProgress.total"
        :key="i"
        class="dot"
        :class="{ past: i < blockProgress.current, now: i === blockProgress.current }"
      />
    </div>
  </div>
</template>

<style scoped>
.cycle {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cycle.deload {
  border-color: color-mix(in srgb, var(--warning) 45%, transparent);
}
.cycle-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.cycle-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
}
.cycle.deload .cycle-label {
  color: var(--warning);
}
.cycle-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-top: 2px;
}
.cycle-manage {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-2);
  background: var(--bg-elev-2);
  border-radius: var(--r-full);
  padding: 7px 12px;
  text-decoration: none;
}
.cycle-hint {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
}
.cycle-dots {
  display: flex;
  gap: 6px;
}
.dot {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: var(--bg-elev-3);
}
.dot.past {
  background: color-mix(in srgb, var(--accent) 45%, transparent);
}
.dot.now {
  background: var(--accent);
}
</style>
