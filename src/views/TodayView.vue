<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import AppIcon from '../components/ui/AppIcon.vue';
import CycleCard from '../components/training/CycleCard.vue';
import WeekStrip from '../components/training/WeekStrip.vue';
import ReadinessCard from '../components/training/ReadinessCard.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import { useCatalogStore } from '../stores/catalog.js';
import { useProgramStore } from '../stores/program.js';
import { useLogsStore } from '../stores/logs.js';
import { useTrainingStore } from '../stores/training.js';
import { suggestPlanForDay, todayKey } from '../core/periodization.js';
import { estimatePlanMinutes, consistencyWeeks, sessionCounts } from '../core/metrics.js';
import { ensurePermission } from '../services/notifications.js';

const router = useRouter();
const catalog = useCatalogStore();
const program = useProgramStore();
const logs = useLogsStore();
const training = useTrainingStore();

const today = todayKey();
const dateLabel = (() => {
  const d = new Date();
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${week}`;
})();

const suggest = computed(() => suggestPlanForDay(program.$state, { planGroups: catalog.planGroups }, today));
const plan = computed(() => suggest.value.plan);
const planGroup = computed(() => (plan.value ? catalog.planGroups.find((g) => g.id === plan.value.groupId || g.plans.some((p) => p.id === plan.value.id)) : null));

const streakWeeks = computed(() => consistencyWeeks(logs.sessionLogs));
const week7 = computed(() => sessionCounts(logs.sessionLogs, 7));
const doneToday = computed(() => logs.sessionsToday.length > 0);
const lastSessionOfPlan = computed(() => {
  if (!plan.value) return null;
  const own = logs.sessionLogs.filter((s) => s.planId === plan.value.id);
  return own.length ? own[own.length - 1] : null;
});

async function startTraining() {
  if (!plan.value) return;
  // 开始训练是请求通知权限的最佳时机
  await ensurePermission();
  training.start(plan.value);
  router.push('/training');
}
</script>

<template>
  <div class="app-page">
    <!-- 问候 + 坚持 -->
    <div class="today-hero">
      <div>
        <h1 class="t-display">{{ dateLabel }}</h1>
        <p class="t-cap">ACL 康复 · 循序渐进</p>
      </div>
      <div class="streak">
        <AppIcon name="flame" :size="18" />
        <span class="num">{{ streakWeeks }}</span>
        <span class="streak-unit">周</span>
      </div>
    </div>

    <CycleCard />

    <ReadinessCard v-if="!doneToday" />

    <!-- 今日训练卡 -->
    <div v-if="training.isActive" class="card card-pad resume-card">
      <div class="resume-info">
        <span class="chip chip-accent">训练进行中</span>
        <p class="t-cap">{{ training.session.planName }}</p>
      </div>
      <button class="btn btn-primary" @click="router.push('/training')">
        继续训练
        <AppIcon name="arrow-right" :size="17" />
      </button>
    </div>

    <template v-else-if="plan">
      <div class="today-plan card" :style="{ '--stage': planGroup?.color || 'var(--accent)' }">
        <div class="tp-head">
          <span class="chip stage-bg stage-text">{{ suggest.reason }}</span>
          <span v-if="suggest.source === 'rest'" class="chip chip-outline">恢复日</span>
        </div>
        <h2 class="tp-name">{{ plan.name }}</h2>
        <div class="tp-meta num">
          <span><AppIcon name="dumbbell" :size="14" />{{ plan.modules.reduce((s, m) => s + m.exercises.length, 0) }} 动作</span>
          <span><AppIcon name="clock" :size="14" />约 {{ estimatePlanMinutes(plan) }} 分钟</span>
        </div>
        <p v-if="lastSessionOfPlan" class="tp-last t-mini">
          上次：{{ lastSessionOfPlan.date }} · {{ lastSessionOfPlan.completedSets }}/{{ lastSessionOfPlan.totalSets }} 组
        </p>
        <button class="btn btn-primary tp-start" @click="startTraining">
          <AppIcon name="play" :size="18" />
          {{ doneToday ? '再练一次' : '开始训练' }}
        </button>
      </div>
    </template>

    <EmptyState
      v-else-if="!catalog.planGroups.length"
      icon="library"
      title="还没有训练计划"
      desc="先到计划库查看默认 ACL 康复动作库，或从桌面工作台导入"
    >
      <button class="btn btn-primary" @click="router.push('/library')">去计划库</button>
    </EmptyState>

    <div v-else class="card card-pad rest-empty">
      <AppIcon name="moon" :size="20" />
      <p>{{ suggest.reason }}</p>
    </div>

    <!-- 本周条带 -->
    <div class="card card-pad week-card">
      <div class="wc-head">
        <span class="t-title" style="font-size: 14px">本周</span>
        <span class="t-mini">近 7 天 {{ week7 }} 次训练</span>
      </div>
      <WeekStrip />
    </div>
  </div>
</template>

<style scoped>
.today-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}
.today-hero .t-cap {
  margin-top: 2px;
}
.streak {
  display: flex;
  align-items: baseline;
  gap: 3px;
  color: var(--accent);
  background: var(--accent-dim);
  border-radius: var(--r-full);
  padding: 6px 12px;
}
.streak svg {
  align-self: center;
}
.streak .num {
  font-size: 18px;
  font-weight: 800;
}
.streak-unit {
  font-size: 11px;
  font-weight: 700;
  opacity: 0.8;
}

.resume-card,
.today-plan,
.week-card,
.readiness,
.cycle {
  margin-top: 12px;
}

.resume-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.resume-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

.today-plan {
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--stage) 30%, var(--border));
}
.today-plan::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--stage);
}
.tp-head {
  display: flex;
  gap: 6px;
}
.tp-name {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.tp-meta {
  display: flex;
  gap: 14px;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
}
.tp-meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.tp-last {
  margin-top: -2px;
}
.tp-start {
  margin-top: 6px;
  min-height: 52px;
  font-size: 16px;
}

.rest-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-2);
  font-size: 14px;
}
.week-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wc-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
</style>
