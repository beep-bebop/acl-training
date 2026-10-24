<script setup>
import { computed } from 'vue';

const props = defineProps({
  cells: { type: Array, required: true }, // [{ dateKey, level(-1..3), sessions }]，从周一开始按周排列
  cellSize: { type: Number, default: 13 },
  gap: { type: Number, default: 3 }
});

const WEEKDAY_LABELS = ['', '一', '', '三', '', '五', ''];
const weeks = computed(() => {
  const out = [];
  for (let i = 0; i < props.cells.length; i += 7) out.push(props.cells.slice(i, i + 7));
  return out;
});
const width = computed(() => 22 + weeks.value.length * (props.cellSize + props.gap));
const height = computed(() => 7 * (props.cellSize + props.gap) + 2);
</script>

<template>
  <div class="heat-wrap">
    <svg :viewBox="`0 0 ${width} ${height}`" class="heat" role="img">
      <g v-for="(dayLabel, di) in WEEKDAY_LABELS" :key="`wl${di}`">
        <text
          v-if="dayLabel"
          :x="0"
          :y="di * (cellSize + gap) + cellSize"
          class="heat-wd"
        >
          {{ dayLabel }}
        </text>
      </g>
      <g v-for="(week, wi) in weeks" :key="wi">
        <rect
          v-for="(cell, di) in week"
          :key="cell.dateKey"
          :x="18 + wi * (cellSize + gap)"
          :y="di * (cellSize + gap)"
          :width="cellSize"
          :height="cellSize"
          rx="3"
          class="heat-cell"
          :class="[`lv${cell.level}`, { future: cell.level < 0 }]"
        >
          <title>{{ cell.dateKey }}{{ cell.sessions > 0 ? ` · ${cell.sessions} 次训练` : '' }}</title>
        </rect>
      </g>
    </svg>
    <div class="heat-legend">
      <span class="t-mini">少</span>
      <span class="heat-cell lv0" />
      <span class="heat-cell lv1" />
      <span class="heat-cell lv2" />
      <span class="heat-cell lv3" />
      <span class="t-mini">多</span>
    </div>
  </div>
</template>

<style scoped>
.heat-wrap {
  overflow-x: auto;
  scrollbar-width: thin;
}
.heat {
  min-width: 100%;
  height: auto;
}
.heat-wd {
  fill: var(--text-3);
  font-size: 9px;
}
.heat-cell {
  width: 13px;
  height: 13px;
  display: inline-block;
  border-radius: 3px;
}
svg .heat-cell {
  width: auto;
  height: auto;
}
.lv--1,
.future {
  fill: transparent;
  stroke: var(--border);
  stroke-dasharray: 2 2;
  background: transparent;
}
.lv0 {
  fill: var(--bg-elev-2);
  background: var(--bg-elev-2);
}
.lv1 {
  fill: color-mix(in srgb, var(--accent) 38%, transparent);
  background: color-mix(in srgb, var(--accent) 38%, transparent);
}
.lv2 {
  fill: color-mix(in srgb, var(--accent) 66%, transparent);
  background: color-mix(in srgb, var(--accent) 66%, transparent);
}
.lv3 {
  fill: var(--accent);
  background: var(--accent);
}
.heat-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
