<script setup>
import { computed } from 'vue';

const props = defineProps({
  data: { type: Array, required: true }, // [{ label, value }]
  height: { type: Number, default: 130 },
  formatValue: { type: Function, default: (v) => String(v) }
});

const PAD = { top: 8, right: 4, bottom: 18, left: 4 };
const width = 320;

const bars = computed(() => {
  const max = Math.max(1, ...props.data.map((d) => d.value));
  const innerH = props.height - PAD.top - PAD.bottom;
  const n = Math.max(1, props.data.length);
  const gap = n > 8 ? 3 : 6;
  const bw = (width - PAD.left - PAD.right - gap * (n - 1)) / n;
  return props.data.map((d, i) => {
    const h = d.value <= 0 ? 0 : Math.max(3, Math.round((d.value / max) * innerH));
    return {
      x: PAD.left + i * (bw + gap),
      y: props.height - PAD.bottom - h,
      w: bw,
      h,
      label: d.label,
      value: d.value,
      last: i === props.data.length - 1
    };
  });
});
</script>

<template>
  <svg :viewBox="`0 0 ${width} ${height}`" class="bar-chart" role="img">
    <line x1="0" :x2="width" :y1="height - PAD.bottom" :y2="height - PAD.bottom" class="axis" />
    <g v-for="(bar, i) in bars" :key="i" class="bar-g">
      <rect
        :x="bar.x"
        :y="bar.y"
        :width="bar.w"
        :height="bar.h"
        rx="3"
        :class="['bar', { zero: bar.value <= 0, last: bar.last }]"
      >
        <title>{{ bar.label }}：{{ formatValue(bar.value) }}</title>
      </rect>
      <text :x="bar.x + bar.w / 2" :y="height - 5" text-anchor="middle" class="bar-label">
        {{ bar.label }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.bar-chart {
  width: 100%;
  height: auto;
}
.axis {
  stroke: var(--border);
}
.bar {
  fill: color-mix(in srgb, var(--accent) 45%, transparent);
}
.bar.last {
  fill: var(--accent);
}
.bar.zero {
  fill: var(--bg-elev-2);
}
.bar-label {
  fill: var(--text-3);
  font-size: 9px;
}
</style>
