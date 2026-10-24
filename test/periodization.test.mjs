// 周期计算：ISO 周 / 休息周 / 今日推荐 / 周条带
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekKeyOf, weekStatus, nextDeload, suggestPlanForDay, weekStrip, mondayOf } from '../src/core/periodization.js';

const PROGRAM = { cycleStart: '2026-10-05', weekdayPlan: { 0: 'p_a', 2: 'p_b' }, deloadEveryN: 4, deloadWeeks: [], activeStage: 'stage1' };
const CATALOG = {
  planGroups: [
    { id: 'stage1', name: '一阶段', plans: [{ id: 'p_a', name: 'A', modules: [] }, { id: 'p_b', name: 'B', modules: [] }] },
    { id: 'stage2', name: '二阶段', plans: [{ id: 'p_c', name: 'C', modules: [] }] },
    { id: 'restday', name: '休息日', plans: [{ id: 'r1', name: '恢复', modules: [] }] }
  ]
};

test('weekKeyOf 输出 ISO 周标识', () => {
  assert.equal(weekKeyOf('2026-01-01'), '2026-W01');
  assert.equal(weekKeyOf('2026-10-24'), '2026-W43'); // 周六
  assert.equal(weekKeyOf('2026-10-19'), '2026-W43'); // 周一，同一周
});

test('mondayOf 返回所在周周一', () => {
  assert.equal(mondayOf(new Date('2026-10-24T12:00:00')).getDate(), 19); // 周六 → 周一19日
});

test('weekStatus：周期第 N 周 + 自动休息周', () => {
  // 周期从 10-05（周一）开始，10-19 为第 3 周
  const s = weekStatus(PROGRAM, '2026-10-19');
  assert.equal(s.weekIndex, 3);
  assert.equal(s.isDeload, false);
  // 第 4 周（10-26）自动休息
  const d = weekStatus(PROGRAM, '2026-10-27');
  assert.equal(d.weekIndex, 4);
  assert.equal(d.isDeload, true);
  assert.equal(d.deloadReason, 'auto');
});

test('weekStatus：手动休息周优先', () => {
  const s = weekStatus({ ...PROGRAM, deloadWeeks: [weekKeyOf('2026-10-20')] }, '2026-10-20');
  assert.equal(s.isDeload, true);
  assert.equal(s.deloadReason, 'manual');
});

test('nextDeload 计算下一次休息周', () => {
  const n = nextDeload(PROGRAM, '2026-10-24');
  assert.equal(n.weekIndex, 4);
  assert.equal(n.monday, '2026-10-26');
  assert.equal(n.daysAway, 2);
  assert.equal(nextDeload({ ...PROGRAM, deloadEveryN: null }, '2026-10-24'), null);
});

test('suggestPlanForDay：排班优先 / 无排班按阶段轮换 / 休息周给恢复计划', () => {
  // 10-20 周二（dow=1）无排班 → 阶段轮换；10-19 周一（dow=0）→ p_a
  assert.equal(suggestPlanForDay(PROGRAM, CATALOG, '2026-10-19').plan.id, 'p_a');
  assert.equal(suggestPlanForDay(PROGRAM, CATALOG, '2026-10-19').source, 'schedule');
  const stageDay = suggestPlanForDay(PROGRAM, CATALOG, '2026-10-20');
  assert.equal(stageDay.source, 'stage');
  assert.ok(['p_a', 'p_b'].includes(stageDay.plan.id));
  // 休息周（10-27）→ 休息日计划
  const rest = suggestPlanForDay(PROGRAM, CATALOG, '2026-10-27');
  assert.equal(rest.source, 'rest');
  assert.equal(rest.plan.id, 'r1');
});

test('weekStrip：完成 / 错过 / 排班 / 今日 状态', () => {
  const strip = weekStrip(PROGRAM, CATALOG, [{ date: '2026-10-19' }], '2026-10-20');
  assert.equal(strip.length, 7);
  assert.equal(strip[0].state, 'done'); // 周一已练
  assert.equal(strip[1].state, 'today'); // 周二今天
  // 周三排了 p_b，未来 → planned
  assert.equal(strip[2].state, 'planned');
  // 无排班的过去日 → rest
  const pastQuiet = weekStrip({ ...PROGRAM, weekdayPlan: {} }, CATALOG, [], '2026-10-21');
  assert.equal(pastQuiet[0].state, 'rest');
  const missed = weekStrip({ ...PROGRAM, weekdayPlan: {} }, CATALOG, [], '2026-10-21');
  // 周一无排班 → rest 而非 missed
  assert.notEqual(missed[0].state, 'missed');
});
