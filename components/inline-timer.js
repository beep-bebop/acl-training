// 内联计时器（每个 timed 动作的小圆圈计时）
import { alertFinish, showToast } from '../utils/helpers.js';

export function toggleInlineTimer(el) {
  const timerState = el.dataset.state;
  const secs = parseInt(el.dataset.secs);
  if (timerState === 'idle') {
    let remaining = secs;
    el.dataset.state = 'running'; el.classList.add('running'); el.classList.remove('done');
    el.textContent = remaining;
    const label = el.parentElement.querySelector('.it-label');
    if (label) label.textContent = '点击停止';
    const intv = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(intv); el.dataset.state = 'done'; el.classList.remove('running'); el.classList.add('done');
        el.textContent = '✓'; if (label) label.textContent = '点击重置';
        alertFinish(); showToast('⏰ 计时结束！');
      } else { el.textContent = remaining; }
    }, 1000);
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
