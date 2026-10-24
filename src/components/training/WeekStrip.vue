<script setup>
import { computed } from 'vue';
import { useProgramStore } from '../../stores/program.js';
import { useCatalogStore } from '../../stores/catalog.js';
import { useLogsStore } from '../../stores/logs.js';
import { weekStrip, WEEKDAY_LABELS, todayKey } from '../../core/periodization.js';

const program = useProgramStore();
const catalog = useCatalogStore();
const logs = useLogsStore();

const strip = computed(() => weekStrip(program.$state, { planGroups: catalog.planGroups }, logs.sessionLogs, todayKey()));

const STATE_TEXT = {
  done: '已练',
  today: '今天',
  missed: '错过',
  planned: '排班',
  rest: '休息',
  future: ''
};
</script>

<template>
  <div class="weekstrip">
    <div v-for="(day, i) in strip" :key="day.dateKey" class="ws-day" :class="day.state" :title="day.planName || STATE_TEXT[day.state]">
      <span class="ws-label">{{ WEEKDAY_LABELS[i] }}</span>
      <span class="ws-dot" />
      <span v-if="day.state === 'today'" class="ws-today">今</span>
      <span v-else-if="day.state === 'done'" class="ws-mark">✓</span>
      <span v-else-if="day.state === 'missed'" class="ws-mark miss">✕</span>
    </div>
  </div>
</template>

<style scoped>
.weekstrip {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.ws-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  padding: 6px 0 8px;
  border-radius: var(--r-sm);
}
.ws-label {
  font-size: 11px;
  color: var(--text-3);
  font-weight: 600;
}
.ws-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--bg-elev-2);
  border: 1.5px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ws-day.done .ws-dot {
  background: var(--accent);
  border-color: var(--accent);
}
.ws-day.today .ws-dot {
  border-color: var(--accent);
  border-width: 2px;
}
.ws-day.missed .ws-dot {
  border-style: dashed;
  border-color: var(--danger);
}
.ws-day.planned .ws-dot {
  border-color: var(--accent-line);
}
.ws-today {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  font-weight: 800;
  color: var(--accent);
}
.ws-mark {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  font-weight: 800;
  color: var(--accent-ink);
}
.ws-mark.miss {
  color: var(--danger);
}
</style>
