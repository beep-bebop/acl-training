// 浮动计时胶囊
import { state } from '../core/state.js';
import { showToast, alertFinish } from '../utils/helpers.js';

let timerInterval = null;
let timerRemaining = 0;
let timerPaused = false;
let onTimerDoneCallback = null;

export function setOnTimerDone(callback) {
  onTimerDoneCallback = callback;
}

export function showTimerPill(doneSet, secs, onDone = null) {
  const pill = document.getElementById('timerPill');
  document.getElementById('tpLabel').textContent = doneSet !== undefined ? `第 ${doneSet} 组完成 · 计时中` : '组间休息';
  timerRemaining = secs;
  timerPaused = false;
  if (onDone) onTimerDoneCallback = onDone;
  updateTimerUI();
  pill.classList.add('show');
  const pauseBtn = document.getElementById('tpPauseBtn');
  if (pauseBtn) pauseBtn.textContent = '⏸';
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (timerPaused) return;
    timerRemaining--;
    updateTimerUI();
    if (timerRemaining <= 0) {
      clearInterval(timerInterval); timerInterval = null;
      pill.classList.remove('show');
      alertFinish();
      showToast('⏰ 计时结束！');
      if (onTimerDoneCallback) {
        const cb = onTimerDoneCallback;
        onTimerDoneCallback = null;
        cb();
      }
    }
  }, 1000);
}

function updateTimerUI() {
  const mins = Math.floor(timerRemaining / 60), secs = timerRemaining % 60;
  document.getElementById('tpCount').textContent =
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function skipTimer() {
  if (timerInterval) clearInterval(timerInterval); timerInterval = null;
  document.getElementById('timerPill').classList.remove('show');
  showToast('⏭ 已跳过休息');
}

export function cancelTimer() {
  if (timerInterval) clearInterval(timerInterval); timerInterval = null;
  document.getElementById('timerPill').classList.remove('show');
}

export function pauseTimer() {
  timerPaused = !timerPaused;
  document.getElementById('tpPauseBtn').textContent = timerPaused ? '▶' : '⏸';
}

export function startRestWithDuration(secs) {
  document.getElementById('timerOverlay').classList.remove('show');
  showTimerPill(undefined, secs);
}

export function openTimerManual() {
  document.getElementById('timerOverlay').classList.add('show');
}

export function closeTimerManual() {
  document.getElementById('timerOverlay').classList.remove('show');
}
