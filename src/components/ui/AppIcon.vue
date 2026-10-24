<script setup>
import { computed } from 'vue';

// 24×24 线性图标集（stroke），个别为填充图形
const ICONS = {
  back: ['M15 5l-7 7 7 7'],
  'chevron-right': ['M9 5l7 7-7 7'],
  chevron: ['M6 9l6 6 6-6'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  check: ['M4.5 12.5l5 5 10-11'],
  close: ['M6 6l12 12M18 6L6 18'],
  play: ['M8 5.5v13l11-6.5z'],
  pause: ['M8.5 5v14M15.5 5v14'],
  skip: ['M5 5.5v13l9-6.5z', 'M18 5v14'],
  timer: ['M12 9.5V13l2.5 2.5', 'M9.5 3h5'],
  edit: ['M4 20h4L19.5 8.5a2.12 2.12 0 0 0-3-3L5 17z', 'M13.5 6.5l4 4'],
  copy: ['M9 9h10v11H9z', 'M5 15V4h11'],
  trash: ['M4 7h16', 'M9.5 7V4.5h5V7', 'M7 7l1 13h8l1-13'],
  grip: ['M9 6h0.01M15 6h0.01M9 12h0.01M15 12h0.01M9 18h0.01M15 18h0.01'],
  download: ['M12 4v11', 'M7.5 11.5L12 16l4.5-4.5', 'M5 19.5h14'],
  upload: ['M12 16V5', 'M7.5 8.5L12 4l4.5 4.5', 'M5 19.5h14'],
  bolt: ['M13 3L5 13.5h5.5L11 21l8-10.5h-5.5z'],
  flame: ['M12 3c1 3 4.5 4.5 4.5 8.5a4.5 4.5 0 0 1-9 0c0-1.6.6-2.7 1.6-3.7C9.4 9 12 6.5 12 3z'],
  info: ['M12 11v5', 'M12 7.5h0.01'],
  warn: ['M12 4L2.5 20h19z', 'M12 10v4.5', 'M12 17.5h0.01'],
  sync: ['M20 12a8 8 0 1 1-2.3-5.6', 'M20 3.5V8h-4.5'],
  sparkles: ['M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z', 'M18.6 15l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z'],
  braces: ['M9 4c-2 0-1.8 3.2-1.8 4.2S7 10.5 5 11.4v1.2c2 .9 2.2 2.2 2.2 3.2S7 20 9 20', 'M15 4c2 0 1.8 3.2 1.8 4.2s.2 2.3 2.2 3.2v1.2c-2 .9-2.2 2.2-2.2 3.2S17 20 15 20'],
  calendar: ['M4 6.5h16v14H4z', 'M4 10.5h16', 'M8 3.5v4M16 3.5v4'],
  today: ['M4 6.5h16v14H4z', 'M4 10.5h16', 'M8 3.5v4M16 3.5v4', 'M8.5 15.5l2 2 4-4'],
  library: ['M12 3.5l9 4.6-9 4.6-9-4.6z', 'M4.6 12.6L12 16.4l7.4-3.8'],
  chart: ['M5 20V11M12 20V4.5M19 20v-7'],
  me: ['M12 4.5a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4z', 'M4.5 20c1.2-3.5 4-5.2 7.5-5.2s6.3 1.7 7.5 5.2'],
  moon: ['M20 13.5A8 8 0 1 1 10.5 4 6.5 6.5 0 0 0 20 13.5z'],
  sun: ['M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6z', 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4'],
  target: ['M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16z', 'M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6z'],
  dumbbell: ['M7 9v6M17 9v6M4 10.5v3M20 10.5v3', 'M7 12h10'],
  heart: ['M12 20s-7.6-4.8-9-9.2A4.7 4.7 0 0 1 12 7.6 4.7 4.7 0 0 1 21 10.8C19.6 15.2 12 20 12 20z'],
  link: ['M10 14a4.2 4.2 0 0 1 0-6l2.8-2.8a4.2 4.2 0 0 1 6 6L17 13', 'M14 10a4.2 4.2 0 0 1 0 6l-2.8 2.8a4.2 4.2 0 0 1-6-6L7 11'],
  'arrow-right': ['M4 12h15', 'M13 6l6 6-6 6'],
  expand: ['M8.5 4H4v4.5M15.5 4H20v4.5M8.5 20H4v-4.5M15.5 20H20v-4.5'],
  clock: ['M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16z', 'M12 7.5V12l3 2.5']
};

// 填充类图形（路径本身闭合，填色不描边）
const FILLED = new Set(['play', 'skip', 'bolt', 'flame', 'sparkles', 'grip']);

const props = defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 22 }
});

const paths = computed(() => ICONS[props.name] || ICONS.info);
const filled = computed(() => FILLED.has(props.name));
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'"
    :stroke="filled ? 'none' : 'currentColor'"
    :stroke-width="name === 'grip' ? 3.2 : 1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
    <circle v-if="name === 'timer'" cx="12" cy="13" r="7.8" />
    <circle v-else-if="name === 'info' || name === 'warn'" cx="12" cy="12" r="9" stroke-width="1.6" fill="none" stroke="currentColor" />
  </svg>
</template>
