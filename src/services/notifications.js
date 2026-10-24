// 提醒体系：权限管理 / 通知发送（优先 Service Worker 通道）/ 振动 / 提示音 / 闪光。
// 设计约束：权限只在用户主动场景（开始训练、开启提醒开关）请求，绝不在计时结束瞬间弹出。
export function permissionState() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function ensurePermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/** 发送本地通知：优先 SW（后台 PWA 也可送达），回退页面 Notification */
export async function notify(title, options = {}) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  const payload = {
    badge: `${import.meta.env.BASE_URL || '/'}icons/icon-192.png`,
    icon: `${import.meta.env.BASE_URL || '/'}icons/icon-192.png`,
    tag: options.tag || 'acl-training',
    ...options
  };
  try {
    if (navigator.serviceWorker) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, payload);
        return true;
      }
    }
    new Notification(title, payload);
    return true;
  } catch {
    try {
      new Notification(title, payload);
      return true;
    } catch {
      return false;
    }
  }
}

export function vibrate(enabled = true, pattern = [180, 90, 180]) {
  if (!enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* 忽略 */
  }
}

let audioCtx = null;

/** 短促双音提示（WebAudio，无外部资源） */
export function beep(times = 2) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < times; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i % 2 === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, t0 + i * 0.28);
      gain.gain.exponentialRampToValueAtTime(0.22, t0 + i * 0.28 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.28 + 0.22);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0 + i * 0.28);
      osc.stop(t0 + i * 0.28 + 0.24);
    }
  } catch {
    /* 音频不可用时静默 */
  }
}

/** 计时结束的全通道提醒 */
export function alertTimerEnd({ vibrateEnabled = true } = {}) {
  vibrate(vibrateEnabled, [200, 100, 200, 100, 320]);
  beep(3);
  flashScreen();
}

let flashEl = null;
export function flashScreen() {
  if (typeof document === 'undefined') return;
  if (!flashEl) {
    flashEl = document.createElement('div');
    flashEl.style.cssText = 'position:fixed;inset:0;background:var(--accent);opacity:0;pointer-events:none;z-index:9999;';
    document.body.appendChild(flashEl);
  }
  flashEl.style.animation = 'none';
  void flashEl.offsetWidth; // 重置动画
  flashEl.style.animation = 'flash-overlay 900ms ease-out';
}

// ---------- 定时提醒调度（应用/PWA 打开期间有效） ----------
let reminderTimer = null;
const firedKeys = new Set();

function reminderKey(prefix, dateKey) {
  return `${prefix}:${dateKey}`;
}

/**
 * 每分钟检查：每日训练提醒 / 休息周前夕提醒。
 * 配置均为 getter（实时读取），应用保持打开期间有效。
 * config: { getDailyConfig(), getDeloadReminderEnabled(), getVibrateEnabled(), isDeloadTomorrow(), dailyBody }
 */
export function startReminderLoop(config) {
  stopReminderLoop();
  const tick = () => {
    try {
      const now = new Date();
      const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted';

      const daily = config.getDailyConfig?.() || {};
      if (daily.enabled && daily.time === hhmm && granted) {
        const key = reminderKey('daily', dateKey);
        if (!firedKeys.has(key)) {
          firedKeys.add(key);
          notify('该训练了 💪', { body: config.dailyBody || '今天的训练计划已就绪', tag: 'daily-reminder' });
          vibrate(Boolean(config.getVibrateEnabled?.()), [120, 80, 120]);
        }
      }

      if (config.getDeloadReminderEnabled?.() && config.isDeloadTomorrow?.() && granted) {
        const deloadKey = reminderKey('deload-eve', dateKey);
        if (!firedKeys.has(deloadKey)) {
          firedKeys.add(deloadKey);
          notify('明天开始休息周 🌿', { body: '本周以恢复为主：降低容量，让组织适应负荷', tag: 'deload-reminder' });
        }
      }
    } catch {
      /* 调度异常不中断 */
    }
    reminderTimer = setTimeout(tick, 60000);
  };
  tick();
}

export function stopReminderLoop() {
  if (reminderTimer) clearTimeout(reminderTimer);
  reminderTimer = null;
}
