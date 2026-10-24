<script setup>
import { computed } from 'vue';

const props = defineProps({
  points: { type: Array, required: true }, // [{ label, value }]，value 可为 null（跳过）
  height: { type: Number, default: 150 },
  color: { type: String, default: 'var(--accent)' },
  formatValue: { type: Function, default: (v) => String(v) },
  maxOverride: { type: Number, default: null }
});

const W = 320;
const PAD = { top: 12, right: 10, bottom: 20, left: 26 };

const { coords, path, area, yTicks, minV, maxV } = computed(() => {
  const values = props.points.map((p) => p.value).filter((v) => v != null);
  const dataMin = values.length ? Math.min(...values) : 0;
  const dataMax = values.length ? Math.max(...values) : 1;
  const span = Math.max(0.5, dataMax - dataMin);
  const minV2 = Math.max(0, dataMin - span * 0.15);
  const maxV2 = props.maxOverride ?? dataMax + span * 0.15;
  const innerW = W - PAD.left - PAD.right;
  const innerH = props.height - PAD.top - PAD.bottom;
  const n = props.points.length;

  const coords2 = props.points.map((p, i) => {
    const x = n <= 1 ? PAD.left + innerW / 2 : PAD.left + (i / (n - 1)) * innerW;
    const y = p.value == null ? null : props.height - PAD.bottom - ((p.value - minV2) / (maxV2 - minV2 || 1)) * innerH;
    return { x, y, ...p };
  });

  const drawn = coords2.filter((c) => c.y != null);
  const path2 = drawn.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const base = props.height - PAD.bottom;
  const area2 = drawn.length > 1
    ? `${path2} L${drawn[drawn.length - 1].x.toFixed(1)},${base} L${drawn[0].x.toFixed(1)},${base} Z`
    : '';

  const ticks = [0, 0.5, 1].map((t) => ({
    y: props.height - PAD.bottom - t * innerH,
    label: Math.round(minV2 + t * (maxV2 - minV2))
  }));

  return { coords: coords2, path: path2, area: area2, yTicks: ticks, minV: minV2, maxV: maxV2 };
}).value;

const labelEvery = computed(() => Math.ceil(props.points.length / 6));
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${height}`" class="line-chart" role="img">
    <defs>
      <linearGradient id="lc-area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.22" />
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.01" />
      </linearGradient>
    </defs>
    <g v-for="(t, i) in yTicks" :key="i">
      <line x1="2" :x2="W - 2" :y1="t.y" :y2="t.y" class="grid" />
      <text x="2" :y="t.y - 3" class="tick">{{ t.label }}</text>
    </g>
    <path v-if="area" :d="area" fill="url(#lc-area)" />
    <path v-if="path" :d="path" fill="none" :stroke="color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <g v-for="(c, i) in coords.filter((c) => c.y != null)" :key="`d${i}`">
      <circle :cx="c.x" :cy="c.y" r="3" :fill="color">
        <title>{{ c.label }}：{{ formatValue(c.value) }}</title>
      </circle>
    </g>
    <text
      v-for="(c, i) in coords.filter((_, i) => i % labelEvery === 0)"
      :key="`l${i}`"
      :x="c.x"
      :y="height - 4"
      text-anchor="middle"
      class="tick"
    >
      {{ c.label }}
    </text>
  </svg>
</template>

<style scoped>
.line-chart {
  width: 100%;
  height: auto;
}
.grid {
  stroke: var(--border);
  stroke-dasharray: 3 4;
}
.tick {
  fill: var(--text-3);
  font-size: 9px;
}
</style>
