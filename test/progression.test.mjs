// 渐进负荷引擎：基线 / 维持 / 进阶 / 退阶
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestProgression, lastSessionForExercise, summarizePerformance } from '../src/core/progression.js';

const EX_WEIGHT = {
  id: 'e1', name: '哑铃卧推', mode: 'counted', sets: 3, reps: 10, rest: 90,
  load: { kind: 'weight' },
  prescription: { painCeiling: 3, progression: '加 2.5kg', regression: '降回上一重量' }
};
const EX_BAND = { ...EX_WEIGHT, id: 'e2', load: { kind: 'band', level: 3 }, name: '弹力带深蹲' };
const EX_ASSIST = { ...EX_WEIGHT, id: 'e3', load: { kind: 'assisted', level: 3 }, name: '辅助引体' };
const EX_NONE = { ...EX_WEIGHT, id: 'e4', load: { kind: 'none' }, name: '死虫式', mode: 'counted', reps: 12 };

function log(ex, date, setIndex, { reps = 10, pain = 1, level = 20 } = {}) {
  return { date, planId: 'p', exerciseId: ex.id, setIndex, reps, loadKind: ex.load?.kind, loadLevel: level, pain };
}

test('无历史 → baseline', () => {
  const s = suggestProgression(EX_WEIGHT, []);
  assert.equal(s.type, 'baseline');
  assert.match(s.detail, /3×10/);
});

test('全部达标且疼痛可控 → increase（负重 +2.5）', () => {
  const logs = [log(EX_WEIGHT, '2026-10-20', 0), log(EX_WEIGHT, '2026-10-20', 1), log(EX_WEIGHT, '2026-10-20', 2, { reps: 12 })];
  const s = suggestProgression(EX_WEIGHT, logs);
  assert.equal(s.type, 'increase');
  assert.equal(s.target.level, 22.5);
});

test('弹力带到顶 → 转为加次数', () => {
  const ex = { ...EX_BAND, load: { kind: 'band', level: 5 } };
  const logs = [0, 1, 2].map((i) => log(ex, '2026-10-20', i, { level: 5 }));
  const s = suggestProgression(ex, logs);
  assert.equal(s.type, 'increase');
  assert.equal(s.target.level, 5);
  assert.equal(s.target.reps, 12);
});

test('辅助型进阶方向：辅助档 -1', () => {
  const logs = [0, 1, 2].map((i) => log(EX_ASSIST, '2026-10-20', i, { level: 3 }));
  const s = suggestProgression(EX_ASSIST, logs);
  assert.equal(s.type, 'increase');
  assert.equal(s.target.level, 2);
});

test('无负荷类型进阶：次数 +2', () => {
  const logs = [0, 1, 2].map((i) => log(EX_NONE, '2026-10-20', i, { reps: 12 }));
  const s = suggestProgression(EX_NONE, logs);
  assert.equal(s.type, 'increase');
  assert.equal(s.target.reps, 14);
});

test('疼痛超上限 → regress', () => {
  const logs = [log(EX_WEIGHT, '2026-10-20', 0, { pain: 5 }), log(EX_WEIGHT, '2026-10-20', 1, { pain: 4 }), log(EX_WEIGHT, '2026-10-20', 2, { pain: 5 })];
  const s = suggestProgression(EX_WEIGHT, logs);
  assert.equal(s.type, 'regress');
  assert.equal(s.target.level, 17.5); // 20 - 2.5
  assert.match(s.detail, /降回上一重量/);
});

test('部分达标 → maintain', () => {
  const logs = [log(EX_WEIGHT, '2026-10-20', 0), log(EX_WEIGHT, '2026-10-20', 1), log(EX_WEIGHT, '2026-10-20', 2, { reps: 6 })];
  const s = suggestProgression(EX_WEIGHT, logs);
  assert.equal(s.type, 'maintain');
});

test('只参考今天之前的最近一次（训练中不受当前会话影响）', () => {
  const history = [log(EX_WEIGHT, '2026-10-20', 0)];
  const today = [log(EX_WEIGHT, '2026-10-24', 0, { reps: 4 })];
  const s = suggestProgression(EX_WEIGHT, [...history, ...today], '2026-10-24');
  // 只看 10-20 的记录
  assert.equal(summarizePerformance(EX_WEIGHT, lastSessionForExercise([...history, ...today], 'e1', '2026-10-24')).lastDate, '2026-10-20');
  assert.equal(s.type, 'maintain');
});
