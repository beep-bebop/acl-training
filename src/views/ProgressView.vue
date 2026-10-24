<script setup>
// 数据看板：热力图 / 周训练量 / 动作负荷趋势 / 疼痛趋势 / 最近会话
import { computed, ref } from 'vue';
import SegmentedControl from '../components/ui/SegmentedControl.vue';
import BottomSheet from '../components/ui/BottomSheet.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import HeatmapGrid from '../components/ui/charts/HeatmapGrid.vue';
import BarChart from '../components/ui/charts/BarChart.vue';
import LineChart from '../components/ui/charts/LineChart.vue';
import { useLogsStore } from '../stores/logs.js';
import { useCatalogStore } from '../stores/catalog.js';
import { heatmap, weeklySummary, exerciseTrend, painTrend, consistencyWeeks, sessionCounts } from '../core/metrics.js';

const logs = useLogsStore();
const catalog = useCatalogStore();

const RANGE_OPTIONS = [
  { value: 8, label: '8 周' },
  { value: 16, label: '16 周' },
  { value: 26, label: '半年' }
];
const rangeWeeks = ref(16);

const heatCells = computed(() => heatmap(logs.$state, rangeWeeks.value));
const weekly = computed(() => weeklySummary(logs.$state, rangeWeeks.value));
const weeklyBars = computed(() =>
  weekly.value.map((w) => ({ label: w.weekKey.slice(6), value: w.sessions }))
);
const pain = computed(() => painTrend(logs.$state, 90));
const painPoints = computed(() =>
  pain.value.map((p) => ({ label: p.date.slice(5).replace('-', '/'), value: p.pain }))
);

const streakWeeks = computed(() => consistencyWeeks(logs.sessionLogs));
const total = computed(() => logs.sessionLogs.length);

// ---------- 动作负荷趋势 ----------
const pickerOpen = ref(false);
const selectedExId = ref(null);

const exercisesWithLogs = computed(() => {
  const ids = new Set(logs.setLogs.map((l) => l.exerciseId));
  return catalog.allEntries()
    .filter(({ module }) => module.exercises.some((ex) => ids.has(ex.id)))
    .map(({ module }) => module.exercises.filter((ex) => ids.has(ex.id)))
    .flat();
});
const selectedEx = computed(() => exercisesWithLogs.value.find((ex) => ex.id === selectedExId.value) || exercisesWithLogs.value[0] || null);
const trend = computed(() => (selectedEx.value ? exerciseTrend(logs.setLogs, selectedEx.value.id) : []));
const trendPoints = computed(() =>
  trend.value
    .map((t) => ({ label: t.date.slice(5).replace('-', '/'), value: t.topLoad }))
    .filter((p) => p.value != null)
);
const trendHasLevel = computed(() => trendPoints.value.length >= 2);

// ---------- 最近会话 ----------
const recentSessions = computed(() => [...logs.sessionLogs].reverse().slice(0, 10));

function fmtDuration(sec) {
  if (!sec) return '—';
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60}m` : `${m} 分钟`;
}
</script>

<template>
  <div class="app-page">
    <div class="pv-hero">
      <h1 class="t-display">数据</h1>
      <p class="t-cap">坚持 {{ streakWeeks }} 周 · 累计 {{ total }} 次训练</p>
    </div>

    <EmptyState
      v-if="!logs.sessionLogs.length"
      icon="chart"
      title="还没有训练记录"
      desc="完成第一次训练后，这里会呈现你的康复进程"
    />

    <template v-else>
      <SegmentedControl v-model="rangeWeeks" :options="RANGE_OPTIONS" class="range" />

      <!-- 统计卡 -->
      <div class="stat-grid">
        <div class="card stat">
          <span class="num stat-v">{{ streakWeeks }}</span>
          <span class="t-mini">连续周数</span>
        </div>
        <div class="card stat">
          <span class="num stat-v">{{ sessionCounts(logs.sessionLogs, 7) }}</span>
          <span class="t-mini">近 7 天</span>
        </div>
        <div class="card stat">
          <span class="num stat-v">{{ sessionCounts(logs.sessionLogs, 30) }}</span>
          <span class="t-mini">近 30 天</span>
        </div>
        <div class="card stat">
          <span class="num stat-v">{{ weekly[weekly.length - 1]?.volume || 0 }}</span>
          <span class="t-mini">本周负荷量</span>
        </div>
      </div>

      <!-- 热力图 -->
      <div class="card card-pad chart-card">
        <div class="cc-head">
          <h3 class="t-title" style="font-size: 14px">训练日历</h3>
        </div>
        <HeatmapGrid :cells="heatCells" />
      </div>

      <!-- 周训练次数 -->
      <div class="card card-pad chart-card">
        <div class="cc-head">
          <h3 class="t-title" style="font-size: 14px">每周训练次数</h3>
          <span class="t-mini num">共 {{ weekly.reduce((s, w) => s + w.sessions, 0) }} 次</span>
        </div>
        <BarChart :data="weeklyBars" />
      </div>

      <!-- 动作负荷趋势 -->
      <div class="card card-pad chart-card">
        <div class="cc-head">
          <h3 class="t-title" style="font-size: 14px">动作负荷趋势</h3>
          <button class="chip chip-accent" @click="pickerOpen = true">
            {{ selectedEx ? selectedEx.name : '选择动作' }}
          </button>
        </div>
        <LineChart v-if="trendHasLevel" :points="trendPoints" format-value="负荷" />
        <p v-else-if="selectedEx" class="t-mini empty-chart">该动作还没有足够的负荷记录（在训练中长按组按钮可记录负荷）</p>
        <p v-else class="t-mini empty-chart">还没有动作负荷记录</p>
      </div>

      <!-- 疼痛趋势 -->
      <div class="card card-pad chart-card">
        <div class="cc-head">
          <h3 class="t-title" style="font-size: 14px">疼痛趋势</h3>
          <span class="t-mini">近 90 天 · 晨检 + 训练记录</span>
        </div>
        <LineChart v-if="painPoints.length >= 2" :points="painPoints" :max-override="10" />
        <p v-else class="t-mini empty-chart">暂无疼痛记录</p>
      </div>

      <!-- 最近会话 -->
      <div class="card chart-card sessions">
        <div class="cc-head" style="padding: 14px 16px 4px">
          <h3 class="t-title" style="font-size: 14px">最近训练</h3>
        </div>
        <div v-for="s in recentSessions" :key="s.id" class="list-row sess-row">
          <div class="sess-main">
            <div class="sess-name">{{ s.planName }}</div>
            <div class="t-mini num">{{ s.date }} · {{ fmtDuration(s.durationSeconds) }}</div>
          </div>
          <div class="sess-side num">
            <span class="chip">{{ s.completedSets }}/{{ s.totalSets }} 组</span>
            <span v-if="s.rpe" class="chip chip-outline">RPE {{ s.rpe }}</span>
            <span v-if="s.avgPain != null" class="chip chip-outline">痛 {{ s.avgPain }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- 动作选择器 -->
    <BottomSheet v-model="pickerOpen" title="选择动作">
      <div class="ex-picker">
        <button
          v-for="ex in exercisesWithLogs"
          :key="ex.id"
          class="chip pick-chip"
          :class="{ active: selectedExId === ex.id }"
          @click="selectedExId = ex.id; pickerOpen = false"
        >
          {{ ex.name }}
        </button>
      </div>
    </BottomSheet>
  </div>
</template>

<style scoped>
.pv-hero {
  margin-bottom: 14px;
}
.range {
  margin-bottom: 12px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.stat {
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.stat-v {
  font-size: 21px;
  font-weight: 800;
}
.chart-card {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.empty-chart {
  padding: 18px 0;
  text-align: center;
}
.sessions {
  padding-bottom: 6px;
}
.sess-row {
  padding: 12px 16px;
}
.sess-main {
  flex: 1;
  min-width: 0;
}
.sess-name {
  font-size: 14px;
  font-weight: 700;
}
.sess-side {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.sess-side .chip {
  font-size: 11px;
  padding: 2px 8px;
}
.ex-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pick-chip {
  padding: 8px 14px;
}
.pick-chip.active {
  background: var(--accent);
  color: var(--accent-ink);
}
</style>
