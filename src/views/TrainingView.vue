<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppIcon from '../components/ui/AppIcon.vue';
import ModuleSection from '../components/training/ModuleSection.vue';
import ExerciseCard from '../components/training/ExerciseCard.vue';
import TimerPill from '../components/training/TimerPill.vue';
import SetLogSheet from '../components/training/SetLogSheet.vue';
import SessionSummarySheet from '../components/training/SessionSummarySheet.vue';
import { useCatalogStore } from '../stores/catalog.js';
import { useTrainingStore } from '../stores/training.js';
import { useLogsStore } from '../stores/logs.js';
import { useUiStore } from '../stores/ui.js';
import { setLoadVolume } from '../core/metrics.js';

const router = useRouter();
const catalog = useCatalogStore();
const training = useTrainingStore();
const logs = useLogsStore();
const ui = useUiStore();

// 无会话则回今日页
const planId = computed(() => training.session?.planId);
const found = computed(() => (planId.value ? catalog.findPlan(planId.value) : null));
const plan = computed(() => found.value?.plan);

onMounted(() => {
  if (!training.isActive || !plan.value) {
    router.replace('/');
  }
});

// ---------- 时钟与进度 ----------
const now = ref(Date.now());
let clock = null;
onMounted(() => {
  clock = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => clearInterval(clock));

const elapsed = computed(() => (training.session ? Math.floor((now.value - training.session.startedAt) / 1000) : 0));
const elapsedLabel = computed(() => {
  const m = Math.floor(elapsed.value / 60);
  const s = elapsed.value % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

const totalSets = computed(() =>
  plan.value?.modules.reduce((s, m) => s + m.exercises.reduce((s2, ex) => s2 + (ex.sets || 1), 0), 0) || 0
);
const doneSets = computed(() => (training.session ? Object.keys(training.session.progress).length : 0));
const progressPct = computed(() => (totalSets.value ? Math.round((doneSets.value / totalSets.value) * 100) : 0));

// ---------- 扁平动作列表（上一/下一导航） ----------
const flatExercises = computed(() => {
  const out = [];
  for (const mod of plan.value?.modules || []) {
    for (const ex of mod.exercises) out.push({ module: mod, exercise: ex });
  }
  return out;
});
const focusIndex = computed(() => flatExercises.value.findIndex((item) => item.exercise.id === training.session?.focusExId));

function scrollToIndex(index) {
  const item = flatExercises.value[index];
  if (!item) return;
  training.setOpenModule(item.module.id, true);
  training.setFocusExercise(item.exercise.id);
  requestAnimationFrame(() => {
    document.getElementById(`ex-anchor-${item.exercise.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}
function goPrev() {
  if (focusIndex.value > 0) scrollToIndex(focusIndex.value - 1);
  else document.querySelector('.app-page')?.scrollTo({ top: 0, behavior: 'smooth' });
}
function goNext() {
  if (focusIndex.value < flatExercises.value.length - 1) scrollToIndex(focusIndex.value + 1);
}

// ---------- 组记录抽屉 ----------
const logSheet = ref(false);
const logTarget = ref({ exercise: null, setIndex: 0 });
function openSetLog({ exercise, setIndex }) {
  logTarget.value = { exercise, setIndex };
  logSheet.value = true;
}

// ---------- 会话收尾 ----------
const summaryOpen = ref(false);
const summary = ref({ durationSec: 0, setsDone: 0, setsTotal: 0, volume: 0, avgPain: null });

function sessionSetLogs() {
  const session = training.session;
  return logs.setLogs.filter((l) => l.date === session.date && l.planId === session.planId);
}

function openSummary() {
  const own = sessionSetLogs();
  const pains = own.map((l) => Number(l.pain)).filter((p) => Number.isFinite(p) && p > 0);
  summary.value = {
    durationSec: elapsed.value,
    setsDone: doneSets.value,
    setsTotal: totalSets.value,
    volume: Math.round(own.reduce((s, l) => s + setLoadVolume(l), 0)),
    avgPain: pains.length ? +(pains.reduce((a, b) => a + b, 0) / pains.length).toFixed(1) : null
  };
  summaryOpen.value = true;
}

function saveSession({ rpe, notes }) {
  const session = training.session;
  if (session) {
    logs.logSession({
      date: session.date,
      planId: session.planId,
      planName: session.planName,
      startedAt: session.startedAt,
      durationSeconds: summary.value.durationSec,
      completedSets: summary.value.setsDone,
      totalSets: summary.value.setsTotal,
      volume: summary.value.volume,
      avgPain: summary.value.avgPain,
      rpe,
      notes
    });
  }
  summaryOpen.value = false;
  training.exit();
  ui.toast('训练记录已保存 💪', 'success');
  router.replace('/');
}

async function discardSession() {
  const ok = await ui.confirmAsync({
    title: '放弃本次记录？',
    body: '本次会话的组记录将一并删除。',
    confirmText: '放弃',
    danger: true
  });
  if (!ok) return;
  const session = training.session;
  if (session) {
    for (const l of sessionSetLogs()) {
      logs.removeSetLog(l.exerciseId, l.setIndex, session.date);
    }
  }
  summaryOpen.value = false;
  training.exit();
  router.replace('/');
}

// 全部完成时自动弹出总结
const autoSummaryFired = ref(false);
watch(doneSets, (val) => {
  if (!autoSummaryFired.value && totalSets.value > 0 && val >= totalSets.value) {
    autoSummaryFired.value = true;
    setTimeout(openSummary, 800);
  }
});

// 返回 = 打开总结（可继续）
function onBack() {
  openSummary();
}
</script>

<template>
  <div v-if="training.session && plan" class="train-page">
    <!-- 顶栏 -->
    <header class="train-header">
      <button class="icon-btn" aria-label="结束" @click="onBack">
        <AppIcon name="back" :size="22" />
      </button>
      <div class="th-center">
        <div class="th-title">{{ plan.name }}</div>
        <div class="th-sub num">
          <span>{{ elapsedLabel }}</span>
          <span class="th-dot" />
          <span>{{ doneSets }}/{{ totalSets }} 组</span>
        </div>
      </div>
      <button class="btn btn-sm th-finish" @click="openSummary">完成</button>
    </header>
    <div class="train-progress">
      <div class="train-progress-fill" :style="{ width: `${progressPct}%` }" />
    </div>

    <!-- 模块与动作 -->
    <div class="app-page no-tabbar train-body">
      <ModuleSection v-for="mod in plan.modules" :key="mod.id" :module="mod" mode="train">
        <div v-for="ex in mod.exercises" :id="`ex-anchor-${ex.id}`" :key="ex.id">
          <ExerciseCard :exercise="ex" @edit-set="openSetLog" />
        </div>
      </ModuleSection>

      <div v-if="doneSets >= totalSets && totalSets > 0" class="all-done">
        <AppIcon name="check" :size="22" />
        全部完成，记得保存记录
      </div>
    </div>

    <!-- 底部动作导航 -->
    <div class="train-nav">
      <button class="btn btn-soft nav-btn" :disabled="focusIndex <= 0" @click="goPrev">
        <AppIcon name="back" :size="18" /> 上一动作
      </button>
      <button class="btn btn-soft nav-btn" :disabled="focusIndex >= flatExercises.length - 1" @click="goNext">
        下一动作 <AppIcon name="chevron-right" :size="18" />
      </button>
    </div>

    <TimerPill />

    <SetLogSheet v-model:open="logSheet" :exercise="logTarget.exercise" :set-index="logTarget.setIndex" />

    <SessionSummarySheet v-model:open="summaryOpen" :summary="summary" @save="saveSession" @discard="discardSession" />
  </div>
</template>

<style scoped>
.train-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}
.train-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: calc(6px + var(--sat)) 10px 6px 4px;
}
.th-center {
  flex: 1;
  min-width: 0;
  text-align: center;
}
.th-title {
  font-size: 15.5px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.th-sub {
  font-size: 12px;
  color: var(--text-3);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 7px;
  margin-top: 1px;
}
.th-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-3);
}
.th-finish {
  color: var(--accent);
  background: var(--accent-dim);
}
.train-progress {
  height: 3px;
  background: var(--bg-elev-2);
  flex-shrink: 0;
}
.train-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 400ms ease;
}
.train-body {
  flex: 1;
  padding-bottom: 130px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.all-done {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--accent);
  font-weight: 700;
  font-size: 14px;
  padding: 14px 0;
}
.train-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  display: flex;
  gap: 10px;
  padding: 10px 16px calc(12px + var(--sab));
  background: color-mix(in srgb, var(--bg) 85%, transparent);
  backdrop-filter: blur(16px);
  border-top: 1px solid var(--border);
  z-index: 44;
}
.nav-btn {
  flex: 1;
}
</style>
