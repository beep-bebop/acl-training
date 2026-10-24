// 指标汇总：负荷量 / 周汇总 / 动作趋势 / 连续周 / 热力图
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setLoadVolume, weeklySummary, exerciseTrend, painTrend, consistencyWeeks, heatmap, estimatePlanMinutes } from '../src/core/metrics.js';

test('setLoadVolume：负重与自重计负荷，其余为 0', () => {
  assert.equal(setLoadVolume({ reps: 10, loadKind: 'weight', loadLevel: 20 }), 200);
  assert.equal(setLoadVolume({ reps: 10, loadKind: 'band', loadLevel: 3 }), 90);
  assert.equal(setLoadVolume({ reps: 10, loadKind: 'none' }), 0);
  // 时长型按 10 秒 ≈ 1 次折算
  assert.equal(setLoadVolume({ duration: 30, loadKind: 'bodyweight', loadLevel: 0 }), 0);
});

test('weeklySummary 按周一聚合', () => {
  const logs = {
    sessionLogs: [
      { date: '2026-10-12' }, // 上上周（算作前一周）
      { date: '2026-10-19' }, { date: '2026-10-20' } // 本周（10-19 周一起）
    ],
    setLogs: [
      { date: '2026-10-19', reps: 10, loadKind: 'weight', loadLevel: 20 },
      { date: '2026-10-20', reps: 10, loadKind: 'weight', loadLevel: 20 }
    ]
  };
  const weeks = weeklySummary(logs, 2, '2026-10-21'); // 周三，本周进行中
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].sessions, 1);
  const thisWeek = weeks[1]; // 10-19 那周
  assert.equal(thisWeek.sessions, 2);
  assert.equal(thisWeek.sets, 2);
  assert.equal(thisWeek.volume, 400);
});

test('exerciseTrend 按天聚合顶级负荷与疼痛', () => {
  const setLogs = [
    { exerciseId: 'e1', date: '2026-10-19', setIndex: 0, reps: 10, loadLevel: 15, pain: 1, time: 1 },
    { exerciseId: 'e1', date: '2026-10-19', setIndex: 1, reps: 10, loadLevel: 20, pain: 2, time: 2 },
    { exerciseId: 'e1', date: '2026-10-22', setIndex: 0, reps: 10, loadLevel: 22.5, pain: 1, time: 3 },
    { exerciseId: 'e2', date: '2026-10-22', setIndex: 0, reps: 10, loadLevel: 99, pain: 0, time: 4 }
  ];
  const trend = exerciseTrend(setLogs, 'e1');
  assert.equal(trend.length, 2);
  assert.equal(trend[0].topLoad, 20);
  assert.equal(trend[0].avgPain, 1.5);
  assert.equal(trend[1].topLoad, 22.5);
});

test('painTrend 合并组记录与晨检', () => {
  const logs = {
    setLogs: [{ date: '2026-10-20', pain: 3 }],
    readinessLogs: [{ date: '2026-10-20', pain: 1 }, { date: '2026-10-21', pain: 2 }]
  };
  const trend = painTrend(logs, 7, '2026-10-21');
  assert.equal(trend.length, 2);
  assert.equal(trend[0].pain, 2); // (3+1)/2
  assert.equal(trend[1].pain, 2);
});

test('consistencyWeeks：本周未练不中断', () => {
  const today = '2026-10-22';
  const weeks = consistencyWeeks([{ date: '2026-10-19' }, { date: '2026-10-12' }], today);
  assert.equal(weeks, 2);
  // 上周断了 → 只算到上周前？
  const broken = consistencyWeeks([{ date: '2026-10-19' }, { date: '2026-10-05' }], today);
  assert.equal(broken, 1); // 本周有，上周无 → 1（本周），再往前查到 10-05 那周不算连续
});

test('heatmap 未来日期 level=-1', () => {
  const cells = heatmap({ sessionLogs: [], setLogs: [] }, 2, '2026-01-05'); // 周一
  assert.equal(cells.length, 14);
  assert.equal(cells[0].level, 0); // 周一当天无记录
  assert.equal(cells[13].level, -1); // 未来
});

test('estimatePlanMinutes 估算计划时长', () => {
  const plan = {
    modules: [
      { exercises: [{ mode: 'counted', sets: 3, reps: 10, rest: 90 }] }, // 3×(40+90)=390
      { exercises: [{ mode: 'timed', sets: 2, duration: 60, rest: 30 }] } // 2×(60+30)=180
    ]
  };
  assert.equal(estimatePlanMinutes(plan), 10); // 570s ≈ 10 分钟
});
