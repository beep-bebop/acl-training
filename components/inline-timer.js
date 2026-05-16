// 内联计时器（每个 timed 动作的小圆圈计时）
import { alertFinish, showToast } from '../utils/helpers.js';

function sendInlineTimerNotification(title, body) {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: '/favicon.ico',
      tag: 'inline-timer-notification',
      requireInteraction: true
    });
  }
}

export function toggleInlineTimer(el) {
  const timerState = el.dataset.state;
  const secs = parseInt(el.dataset.secs);
  if (timerState === 'idle') {
    const endTime = Date.now() + (secs * 1000);
    el.dataset.state = 'running'; el.classList.add('running'); el.classList.remove('done');
    el.textContent = secs;
    const label = el.parentElement.querySelector('.it-label');
    if (label) label.textContent = '点击停止';
    
    el._endTime = endTime;
    el._hasNotified = false;
    
    const intv = setInterval(() => {
      if (el.dataset.state !== 'running') {
        clearInterval(intv);
        return;
      }
      const remaining = Math.max(0, Math.ceil((el._endTime - Date.now()) / 1000));
      el.textContent = remaining;
      
      if (remaining <= 0 && !el._hasNotified) {
        el._hasNotified = true;
        clearInterval(intv); el.dataset.state = 'done'; el.classList.remove('running'); el.classList.add('done');
        el.textContent = '✓'; if (label) label.textContent = '点击重置';
        alertFinish(); showToast('⏰ 计时结束！');
        sendInlineTimerNotification('动作计时结束', '⏰ 计时结束！');
      }
    }, 250);
    el._interval = intv;
  } else if (timerState === 'running') {
    clearInterval(el._interval); el._interval = null;
    el.dataset.state = 'done'; el.classList.remove('running'); el.classList.add('done');
    el.textContent = '✓';
    const label = el.parentElement.querySelector('.it-label');
    if (label) label.textContent = '点击重置';
  } else if (timerState === 'done') {
    el.dataset.state = 'idle'; el.classList.remove('done'); el.textContent = secs;
    const label = el.parentElement.querySelector('.it-label');
    if (label) label.textContent = '点击计时';
  }
}
