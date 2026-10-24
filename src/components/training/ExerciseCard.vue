<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import SetGrid from './SetGrid.vue';
import { useTrainingStore } from '../../stores/training.js';
import { useLogsStore } from '../../stores/logs.js';
import { useSettingsStore } from '../../stores/settings.js';
import { suggestProgression } from '../../core/progression.js';
import { LOAD_KINDS } from '../../core/config.js';
import { todayKey } from '../../core/periodization.js';
import { vibrate as vibrateFn } from '../../services/notifications.js';
import { renderMarkdown } from '../../utils/markdown.js';

const props = defineProps({
  exercise: { type: Object, required: true }
});
const emit = defineEmits(['edit-set']);

const training = useTrainingStore();
const logs = useLogsStore();
const settings = useSettingsStore();

// A1./B2. 超级组前缀
const prefix = computed(() => props.exercise.name.match(/^([A-Z]\d{0,2})[.、．]/)?.[1] || '');
const displayName = computed(() => props.exercise.name.replace(/^([A-Z]\d{0,2})[.、．]\s*/, ''));

// 本会话内采纳的目标（覆盖处方显示）
const adopted = computed(() => training.session?.adopted?.[props.exercise.id] || null);
const target = computed(() => {
  const ex = props.exercise;
  return {
    reps: adopted.value?.reps ?? ex.reps,
    duration: adopted.value?.duration ?? ex.duration,
    level: adopted.value?.level
  };
});

const loadCfg = computed(() => LOAD_KINDS[props.exercise.load?.kind] || LOAD_KINDS.none);
const levelText = computed(() => {
  if (target.value.level == null) return loadCfg.value.label;
  return `${loadCfg.value.label} ${target.value.level}${loadCfg.value.unit}`;
});

const doneMap = computed(() => {
  const out = {};
  const session = training.session;
  if (!session) return out;
  for (let i = 0; i < props.exercise.sets; i++) {
    if (session.progress[`${props.exercise.id}_s${i}`]) out[i] = true;
  }
  return out;
});

const loggedMap = computed(() => {
  const date = training.session?.date || todayKey();
  const planId = training.session?.planId;
  const out = {};
  for (const l of logs.setLogs) {
    if (l.date === date && l.planId === planId && l.exerciseId === props.exercise.id) out[l.setIndex] = l;
  }
  return out;
});

const doneCount = computed(() => Object.keys(doneMap.value).length);
const allDone = computed(() => doneCount.value >= props.exercise.sets);

// 渐进建议（基于今天之前的历史）
const suggestion = computed(() => suggestProgression(props.exercise, logs.setLogs, todayKey()));
const suggestionVisible = ref(true);
function adopt() {
  if (suggestion.value?.target) {
    training.adoptSuggestion(props.exercise.id, suggestion.value.target);
    suggestionVisible.value = false;
  }
}

const tipOpen = ref(false);
const hasDetails = computed(() => props.exercise.tip || props.exercise.enrichment?.content);

// ---------- 组切换 ----------
function onToggle(setIndex) {
  const nowDone = training.toggleSet(props.exercise.id, setIndex);
  vibrateFn(settings.vibrate, nowDone ? 35 : 20);
  if (nowDone) {
    logs.logSet({
      date: training.session.date,
      planId: training.session.planId,
      exerciseId: props.exercise.id,
      setIndex,
      reps: target.value.reps ?? null,
      duration: target.value.duration ?? null,
      loadKind: props.exercise.load?.kind || 'none',
      loadLevel: target.value.level ?? null,
      pain: null
    });
    if (doneCount.value + 1 >= props.exercise.sets) {
      logs.logExerciseDone(training.session.planId, training.session.planName, props.exercise);
    }
    const isLastSet = setIndex >= props.exercise.sets - 1;
    if (settings.autoRest && props.exercise.rest > 0 && !isLastSet) {
      training.startRest(props.exercise.rest, props.exercise.id, setIndex + 2);
    }
  } else {
    logs.removeSetLog(props.exercise.id, setIndex, training.session.date);
  }
}

// ---------- 计时型动作 ----------
const timed = ref(null); // { endsAt, total, remaining, setIndex }
let tickTimer = null;

function startTimed() {
  const setIndex = Object.keys(doneMap.value).length; // 下一个未完成组
  if (setIndex >= props.exercise.sets) return;
  const total = target.value.duration || props.exercise.duration || 60;
  timed.value = { endsAt: Date.now() + total * 1000, total, remaining: null, setIndex };
  tickTimer = setInterval(tick, 250);
}
function tick() {
  if (!timed.value || timed.value.remaining != null) return;
  if (Date.now() >= timed.value.endsAt) finishTimed();
}
function finishTimed() {
  clearInterval(tickTimer);
  tickTimer = null;
  const { setIndex } = timed.value;
  timed.value = null;
  if (!training.isDone(props.exercise.id, setIndex)) onToggle(setIndex);
}
function toggleTimedPause() {
  if (!timed.value) return;
  if (timed.value.remaining == null) {
    timed.value.remaining = Math.max(0, Math.round((timed.value.endsAt - Date.now()) / 1000));
  } else {
    timed.value.endsAt = Date.now() + timed.value.remaining * 1000;
    timed.value.remaining = null;
  }
}
function cancelTimed() {
  clearInterval(tickTimer);
  tickTimer = null;
  timed.value = null;
}
const timedRemainSec = computed(() => {
  if (!timed.value) return 0;
  return timed.value.remaining != null ? timed.value.remaining : Math.max(0, Math.ceil((timed.value.endsAt - Date.now()) / 1000));
});
const timedProgress = computed(() => {
  if (!timed.value) return 0;
  return timedRemainSec.value / timed.value.total;
});
onBeforeUnmount(() => clearInterval(tickTimer));
</script>

<template>
  <section class="ex-card card" :class="{ done: allDone }">
    <!-- 渐进建议 -->
    <div v-if="suggestion && suggestion.type !== 'baseline' && suggestionVisible && !allDone" class="suggestion" :class="`sg-${suggestion.type}`">
      <div class="sg-main">
        <span class="sg-tag">{{ { increase: '进阶', maintain: '巩固', regress: '退阶' }[suggestion.type] }}</span>
        <span class="sg-detail">{{ suggestion.title }} · {{ suggestion.detail }}</span>
      </div>
      <button v-if="suggestion.type !== 'maintain' && suggestion.target && Object.keys(suggestion.target).length" class="btn btn-sm sg-adopt" @click="adopt">
        采纳
      </button>
      <button v-else class="sg-close" aria-label="关闭建议" @click="suggestionVisible = false">
        <AppIcon name="close" :size="14" />
      </button>
    </div>

    <!-- 标题行 -->
    <div class="ex-head">
      <div class="ex-title">
        <span v-if="prefix" class="ex-prefix num">{{ prefix }}</span>
        <h4 class="ex-name">{{ displayName }}</h4>
      </div>
      <button v-if="hasDetails" class="ex-detail-toggle" :class="{ open: tipOpen }" aria-label="详情" @click="tipOpen = !tipOpen">
        <AppIcon name="chevron" :size="18" />
      </button>
    </div>

    <!-- 处方信息 -->
    <div class="ex-meta">
      <span class="chip num">{{ exercise.sets }} × {{ exercise.mode === 'timed' ? `${target.duration || exercise.duration}s` : `${target.reps || exercise.reps}` }}</span>
      <span v-if="exercise.load?.kind && exercise.load.kind !== 'none'" class="chip chip-outline">{{ levelText }}</span>
      <span class="chip chip-outline">休 {{ exercise.rest }}s</span>
      <span v-if="exercise.prescription?.painCeiling != null" class="chip chip-outline" title="训练疼痛上限">痛 ≤{{ exercise.prescription.painCeiling }}</span>
      <span v-if="exercise.sides" class="chip chip-outline">{{ exercise.sides }}</span>
    </div>

    <!-- 详情（提示 + AI 详解） -->
    <div v-if="tipOpen" class="ex-details">
      <p v-if="exercise.tip" class="ex-tip">{{ exercise.tip }}</p>
      <div v-if="exercise.enrichment?.content" class="ex-enrich markdown-body" v-html="renderMarkdown(exercise.enrichment.content)" />
    </div>

    <!-- 计次：组按钮网格 -->
    <SetGrid
      v-if="exercise.mode !== 'timed'"
      :exercise="exercise"
      :done-map="doneMap"
      :logged-map="loggedMap"
      @toggle="onToggle"
      @edit="(i) => emit('edit-set', { exercise, setIndex: i })"
    />

    <!-- 计时：大按钮 + 圆环倒计时 -->
    <div v-else class="timed-zone">
      <button v-if="!timed" class="btn btn-primary timed-start" :disabled="allDone" @click="startTimed">
        <AppIcon name="play" :size="18" />
        {{ allDone ? '已完成' : `开始第 ${doneCount + 1} 组 · ${target.duration || exercise.duration}s` }}
      </button>
      <div v-else class="timed-run">
        <svg viewBox="0 0 72 72" class="timed-ring">
          <circle cx="36" cy="36" r="30" class="ring-bg" />
          <circle
            cx="36"
            cy="36"
            r="30"
            class="ring-fg"
            :stroke-dasharray="188.5"
            :stroke-dashoffset="188.5 * (1 - timedProgress)"
          />
        </svg>
        <div class="timed-center num">{{ timedRemainSec }}</div>
        <div class="timed-actions">
          <button class="icon-btn" :aria-label="timed.remaining != null ? '继续' : '暂停'" @click="toggleTimedPause">
            <AppIcon :name="timed.remaining != null ? 'play' : 'pause'" :size="20" />
          </button>
          <button class="icon-btn danger" aria-label="取消" @click="cancelTimed">
            <AppIcon name="close" :size="20" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ex-card {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: opacity var(--dur-fast) ease, border-color var(--dur-fast) ease;
}
.ex-card.done {
  opacity: 0.62;
  border-color: var(--accent-line);
}

/* 渐进建议 */
.suggestion {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--r-md);
  font-size: 12.5px;
  line-height: 1.45;
}
.sg-increase {
  background: var(--accent-dim);
  color: var(--accent);
}
.sg-maintain {
  background: var(--info-dim);
  color: var(--info);
}
.sg-regress {
  background: var(--warning-dim);
  color: var(--warning);
}
.sg-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sg-tag {
  font-weight: 800;
  font-size: 12px;
}
.sg-detail {
  opacity: 0.92;
}
.sg-adopt {
  background: color-mix(in srgb, currentColor 16%, transparent);
  color: inherit;
  border: none;
  flex-shrink: 0;
}
.sg-close {
  color: inherit;
  opacity: 0.6;
  padding: 6px;
  flex-shrink: 0;
}

/* 标题 */
.ex-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.ex-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.ex-prefix {
  font-size: 11px;
  font-weight: 800;
  color: var(--accent);
  background: var(--accent-dim);
  border-radius: 6px;
  padding: 2px 6px;
  flex-shrink: 0;
}
.ex-name {
  font-size: 15.5px;
  font-weight: 700;
  line-height: 1.35;
  word-break: break-word;
}
.ex-detail-toggle {
  color: var(--text-3);
  padding: 4px;
  transition: transform var(--dur-mid) ease, color var(--dur-fast) ease;
}
.ex-detail-toggle.open {
  transform: rotate(180deg);
  color: var(--text-1);
}

/* 处方 chips */
.ex-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 详情 */
.ex-details {
  background: var(--bg-elev-2);
  border-radius: var(--r-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ex-tip {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
}

/* 计时型 */
.timed-start {
  width: 100%;
  min-height: 54px;
  font-size: 16px;
  gap: 10px;
}
.timed-run {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
}
.timed-ring {
  width: 72px;
  height: 72px;
  transform: rotate(-90deg);
  flex-shrink: 0;
}
.ring-bg {
  fill: none;
  stroke: var(--bg-elev-3);
  stroke-width: 6;
}
.ring-fg {
  fill: none;
  stroke: var(--accent);
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.25s linear;
}
.timed-center {
  position: absolute;
  left: 36px;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 22px;
  font-weight: 800;
}
.timed-actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
}
</style>
