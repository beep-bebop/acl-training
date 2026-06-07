// 浮动计时胶囊 - 使用时间戳确保后台也能准确计时
import { state } from '../core/state.js';
import { showToast, alertFinish } from '../utils/helpers.js';

let timerInterval = null;
let timerTimeout = null;
let timerEndTime = 0;
let timerTotalDuration = 0;
let timerPaused = false;
let timerPausedTime = 0;
let onTimerDoneCallback = null;
let hasNotified = false;

export function setOnTimerDone(callback) {
  onTimerDoneCallback = callback;
}

function initVisibilityHandler() {
  if (window._timerVisibilityBound) return;
  window._timerVisibilityBound = true;
  
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && timerEndTime > 0 && !timerPaused) {
      updateTimerUI();
    }
  });
}

function finishTimer(pill, doneSet) {
  if (hasNotified) return;
  hasNotified = true;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (timerTimeout) { clearTimeout(timerTimeout); timerTimeout = null; }
  pill.classList.remove('show');
  alertFinish();
  showToast('⏰ 计时结束！');
  sendNotification(doneSet !== undefined ? `第 ${doneSet} 组完成` : '组间休息结束', '⏰ 计时结束！');
  if (onTimerDoneCallback) {
    const cb = onTimerDoneCallback;
    onTimerDoneCallback = null;
    cb();
  }
}

export function showTimerPill(doneSet, secs, onDone = null) {
  const pill = document.getElementById('timerPill');
  document.getElementById('tpLabel').textContent = doneSet !== undefined ? `第 ${doneSet} 组完成 · 计时中` : '组间休息';
  timerTotalDuration = secs;
  timerEndTime = Date.now() + (secs * 1000);
  timerPaused = false;
  timerPausedTime = 0;
  hasNotified = false;
  if (onDone) onTimerDoneCallback = onDone;
  updateTimerUI();
  pill.classList.add('show');
  const pauseBtn = document.getElementById('tpPauseBtn');
  if (pauseBtn) pauseBtn.textContent = '暂停';
  
  initVisibilityHandler();
  
  if (timerInterval) clearInterval(timerInterval);
  if (timerTimeout) clearTimeout(timerTimeout);
  
  timerTimeout = setTimeout(() => finishTimer(pill, doneSet), secs * 1000 + 100);
  
  timerInterval = setInterval(() => {
    if (timerPaused) return;
    
    const remaining = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
    updateTimerUI();
    
    if (remaining <= 0 && !hasNotified) {
      finishTimer(pill, doneSet);
    }
  }, 250);
}

function updateTimerUI() {
  const remaining = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
  const mins = Math.floor(remaining / 60), secs = remaining % 60;
  document.getElementById('tpCount').textContent =
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function skipTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (timerTimeout) { clearTimeout(timerTimeout); timerTimeout = null; }
  document.getElementById('timerPill').classList.remove('show');
  showToast('⏭ 已跳过休息');
}

export function cancelTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (timerTimeout) { clearTimeout(timerTimeout); timerTimeout = null; }
  timerEndTime = 0;
  document.getElementById('timerPill').classList.remove('show');
}

export function pauseTimer() {
  if (!timerPaused) {
    timerPaused = true;
    timerPausedTime = Date.now();
    if (timerTimeout) { clearTimeout(timerTimeout); timerTimeout = null; }
  } else {
    timerPaused = false;
    const pausedDuration = Date.now() - timerPausedTime;
    timerEndTime += pausedDuration;
    timerPausedTime = 0;
    const remaining = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
    timerTimeout = setTimeout(() => {
      const pill = document.getElementById('timerPill');
      const doneSetMatch = document.getElementById('tpLabel').textContent.match(/第 (\d+) 组完成/);
      const doneSet = doneSetMatch ? parseInt(doneSetMatch[1]) : undefined;
      finishTimer(pill, doneSet);
    }, remaining * 1000 + 100);
  }
  document.getElementById('tpPauseBtn').textContent = timerPaused ? '继续' : '暂停';
}

function sendNotification(title, body) {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: '/favicon.ico',
      tag: 'timer-notification',
      requireInteraction: true
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, {
          body: body,
          icon: '/favicon.ico',
          tag: 'timer-notification',
          requireInteraction: true
        });
      }
    });
  }
}

export function startRestWithDuration(secs) {
  document.getElementById('timerOverlay').classList.remove('show');
  showTimerPill(undefined, secs);
}

export function openTimerManual() {
  timerEndTime = 0;
  document.getElementById('timerOverlay').classList.add('show');
}

export function closeTimerManual() {
  document.getElementById('timerOverlay').classList.remove('show');
}

export function requestNotificationPermission() {
  if (!('Notification' in window)) return Promise.resolve('unsupported');
  if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
  return Notification.requestPermission();
}
