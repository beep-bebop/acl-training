<script setup>
// 周期设置：排班 / 休息周 / 阶段
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '../components/ui/AppHeader.vue';
import SegmentedControl from '../components/ui/SegmentedControl.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import { useProgramStore } from '../stores/program.js';
import { useCatalogStore } from '../stores/catalog.js';
import { useUiStore } from '../stores/ui.js';
import { mondayOf, weekStatus, weekKeyOf, todayKey, WEEKDAY_LABELS } from '../core/periodization.js';

const router = useRouter();
const program = useProgramStore();
const catalog = useCatalogStore();
const ui = useUiStore();

// ---------- 排班 ----------
const schedulablePlans = computed(() => catalog.flatPlans);
const activePlans = computed(() => {
  const group = catalog.planGroups.find((g) => g.id === program.activeStage);
  return group?.plans || [];
});

const DELOAD_OPTIONS = [
  { value: 0, label: '关闭' },
  { value: 3, label: '每3周' },
  { value: 4, label: '每4周' },
  { value: 6, label: '每6周' }
];
const deloadValue = computed({
  get: () => program.deloadEveryN || 0,
  set: (v) => program.setDeloadEveryN(Number(v))
});

// ---------- 未来 8 周预览 ----------
function fmtKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const upcomingWeeks = computed(() => {
  const monday = mondayOf(new Date());
  return Array.from({ length: 8 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + i * 7);
    const key = fmtKey(date);
    const status = weekStatus(program.$state, key);
    return { dateKey: key, weekKey: weekKeyOf(key), ...status };
  });
});

function toggleManualWeek(week) {
  program.toggleDeloadWeek(week.dateKey);
}

// ---------- 阶段 ----------
const activeGroup = computed(() => catalog.planGroups.find((g) => g.id === program.activeStage));

async function switchStage(group) {
  if (group.id === program.activeStage) return;
  const criteria = group.coaching?.progressCriteria || [];
  const ok = await ui.confirmAsync({
    title: `切换到「${group.name}」？`,
    body: criteria.length ? `进入该阶段的准备标准：\n${criteria.map((c) => `· ${c}`).join('\n')}` : '今日推荐将按新阶段的计划轮换。',
    confirmText: '切换'
  });
  if (!ok) return;
  program.setActiveStage(group.id);
  ui.toast(`已切换到 ${group.name}`, 'success');
}
</script>

<template>
  <div class="program-page">
    <AppHeader title="训练周期" />

    <div class="app-page no-tabbar">
      <!-- 排班 -->
      <div class="card card-pad sec">
        <div class="sec-head">
          <h3 class="t-title" style="font-size: 15px">每周排班</h3>
          <span class="t-mini">决定「今日」推荐什么</span>
        </div>
        <div class="sched">
          <div v-for="(label, dow) in WEEKDAY_LABELS" :key="dow" class="sched-row">
            <span class="sched-label">{{ label }}</span>
            <div class="sched-chips">
              <button
                class="chip sch-chip"
                :class="{ active: !program.weekdayPlan[dow] }"
                @click="program.setWeekdayPlan(dow, null)"
              >
                休
              </button>
              <button
                v-for="p in schedulablePlans"
                :key="p.id"
                class="chip sch-chip"
                :class="{ active: program.weekdayPlan[dow] === p.id }"
                @click="program.setWeekdayPlan(dow, program.weekdayPlan[dow] === p.id ? null : p.id)"
              >
                {{ p.name }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 休息周 -->
      <div class="card card-pad sec">
        <div class="sec-head">
          <h3 class="t-title" style="font-size: 15px">休息周（Deload）</h3>
        </div>
        <SegmentedControl v-model="deloadValue" :options="DELOAD_OPTIONS" />
        <p class="sec-hint">
          {{ program.deloadEveryN
            ? `每 ${program.deloadEveryN} 周自动安排一个休息周：今日页会推荐休息日计划并提示降低容量。`
            : '开启后自动周期性降低负荷，帮助组织恢复与适应。' }}
        </p>
        <div class="weeks-preview">
          <button
            v-for="week in upcomingWeeks"
            :key="week.weekKey"
            class="week-chip"
            :class="{ deload: week.isDeload }"
            :title="week.deloadReason === 'manual' ? '手动标记（点击取消）' : program.deloadEveryN ? `自动（点击可手动调整）` : '点击手动设为休息周'"
            @click="toggleManualWeek(week)"
          >
            <span class="wc-label">{{ week.isDeload ? '休' : `第${week.weekIndex}周` }}</span>
            <span class="wc-date num">{{ week.dateKey.slice(5).replace('-', '/') }}</span>
          </button>
        </div>
      </div>

      <!-- 周期起点 -->
      <div class="card card-pad sec">
        <div class="sec-head">
          <h3 class="t-title" style="font-size: 15px">周期起点</h3>
          <span class="t-mini">第 1 周从该周的周一开始计算</span>
        </div>
        <input
          type="date"
          class="field-input"
          :value="program.cycleStart"
          @change="program.setCycleStart($event.target.value)"
        />
      </div>

      <!-- 阶段 -->
      <div class="card card-pad sec">
        <div class="sec-head">
          <h3 class="t-title" style="font-size: 15px">训练阶段</h3>
          <span class="t-mini">当前：{{ activeGroup?.name || '未设置' }}</span>
        </div>
        <div class="stage-list">
          <button
            v-for="g in catalog.planGroups"
            :key="g.id"
            class="stage-row tap-row"
            :class="{ active: g.id === program.activeStage }"
            :style="{ '--stage': g.color }"
            @click="switchStage(g)"
          >
            <span class="stage-dot stage-bar" />
            <div class="stage-info">
              <div class="stage-name">{{ g.name }} <span v-if="g.subtitle" class="t-mini">{{ g.subtitle }}</span></div>
              <div class="t-mini">{{ g.plans.length }} 个计划</div>
            </div>
            <AppIcon v-if="g.id === program.activeStage" name="check" :size="18" class="t-accent" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sec {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sec-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.sec-hint {
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.55;
}
.sched {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sched-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sched-label {
  width: 22px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-3);
  flex-shrink: 0;
}
.sched-chips {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.sched-chips::-webkit-scrollbar {
  display: none;
}
.sch-chip {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: var(--r-full);
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--text-2);
}
.sch-chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}
.weeks-preview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.week-chip {
  border-radius: var(--r-md);
  border: 1px solid var(--border);
  background: var(--bg-elev-2);
  padding: 9px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.week-chip.deload {
  background: var(--warning-dim);
  border-color: color-mix(in srgb, var(--warning) 50%, transparent);
}
.wc-label {
  font-size: 12.5px;
  font-weight: 800;
}
.week-chip.deload .wc-label {
  color: var(--warning);
}
.wc-date {
  font-size: 10.5px;
  color: var(--text-3);
}
.stage-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stage-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
}
.stage-row.active {
  background: var(--bg-elev-2);
}
.stage-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.stage-info {
  flex: 1;
}
.stage-name {
  font-size: 14.5px;
  font-weight: 700;
  display: flex;
  align-items: baseline;
  gap: 6px;
}
</style>
