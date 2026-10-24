<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import { useTrainingStore } from '../../stores/training.js';
import { useSettingsStore } from '../../stores/settings.js';
import { alertTimerEnd, notify } from '../../services/notifications.js';

const training = useTrainingStore();
const settings = useSettingsStore();
const now = ref(Date.now());
let timer = null;
let fired = false;

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
    const rest = training.rest;
    if (rest && rest.remaining == null && !fired && now.value >= rest.endsAt) {
      fired = true;
      const nextEx = training.session?.planName || '';
      alertTimerEnd({ vibrateEnabled: settings.vibrate });
      notify('休息结束，继续训练', { body: nextEx ? `继续 ${nextEx} 的下一组` : '开始下一组', tag: 'rest-timer' });
      training.skipRest();
    }
  }, 250);
});
onBeforeUnmount(() => clearInterval(timer));

const total = computed(() => training.rest?.total || 1);
const remainSec = computed(() => {
  const rest = training.rest;
  if (!rest) return 0;
  return rest.remaining != null ? rest.remaining : Math.max(0, Math.ceil((rest.endsAt - now.value) / 1000));
});
const paused = computed(() => training.rest?.remaining != null);
const progress = computed(() => remainSec.value / total.value);
</script>

<template>
  <Transition name="pill">
    <div v-if="training.rest" class="timer-pill">
      <svg viewBox="0 0 48 48" class="pill-ring">
        <circle cx="24" cy="24" r="19" class="pr-bg" />
        <circle
          cx="24"
          cy="24"
          r="19"
          class="pr-fg"
          stroke-dasharray="119.4"
          :stroke-dashoffset="119.4 * (1 - progress)"
        />
      </svg>
      <div class="pill-center">
        <span class="pill-time num">{{ remainSec }}</span>
      </div>
      <div class="pill-label">{{ paused ? '已暂停' : '休息中' }}</div>
      <div class="pill-actions">
        <button class="pill-btn" :aria-label="paused ? '继续' : '暂停'" @click="paused ? training.resumeRest() : training.pauseRest()">
          <AppIcon :name="paused ? 'play' : 'pause'" :size="17" />
        </button>
        <button class="pill-btn" aria-label="加15秒" @click="training.adjustRest(15)">+15</button>
        <button class="pill-btn" aria-label="减15秒" @click="training.adjustRest(-15)">−15</button>
        <button class="pill-btn pill-skip" aria-label="跳过休息" @click="training.skipRest()">
          <AppIcon name="close" :size="16" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.timer-pill {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(96px + var(--sab));
  z-index: 45;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 8px 8px;
  background: var(--bg-elev-3);
  border: 1px solid var(--accent-line);
  border-radius: var(--r-full);
  box-shadow: var(--shadow-pop);
  backdrop-filter: blur(14px);
  width: min(92vw, 400px);
}
.pill-ring {
  width: 48px;
  height: 48px;
  transform: rotate(-90deg);
  flex-shrink: 0;
}
.pr-bg {
  fill: none;
  stroke: var(--border-strong);
  stroke-width: 4;
}
.pr-fg {
  fill: none;
  stroke: var(--accent);
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.25s linear;
}
.pill-center {
  position: absolute;
  left: 32px;
  width: 48px;
  text-align: center;
  transform: translateX(-50%);
  pointer-events: none;
}
.pill-time {
  font-size: 16px;
  font-weight: 800;
}
.pill-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
  flex-shrink: 0;
}
.pill-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
}
.pill-btn {
  min-width: 42px;
  height: 42px;
  padding: 0 8px;
  border-radius: var(--r-full);
  background: var(--bg-elev-2);
  color: var(--text-1);
  font-size: 12.5px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--dur-fast) ease;
}
.pill-btn:active {
  transform: scale(0.9);
}
.pill-skip {
  color: var(--text-3);
}
.pill-enter-active,
.pill-leave-active {
  transition: transform var(--dur-mid) var(--ease-spring), opacity var(--dur-mid) ease;
}
.pill-enter-from,
.pill-leave-to {
  transform: translateX(-50%) translateY(30px);
  opacity: 0;
}
</style>
