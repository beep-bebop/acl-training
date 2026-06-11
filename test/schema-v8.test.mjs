import test from 'node:test';
import assert from 'node:assert/strict';
import {
  V7_VERSION,
  createEmptyV7Snapshot,
  normalizeV7Snapshot,
  validateV7Snapshot,
} from '../services/schema-v7.js';

test('schema version is upgraded to v8 with coach-facing defaults', () => {
  const snapshot = createEmptyV7Snapshot();

  assert.equal(V7_VERSION, 8);
  assert.equal(snapshot.version, 8);
  assert.ok(Array.isArray(snapshot.runtime.readinessLogs));
  assert.equal(snapshot.catalog.planGroups[0].coaching.phaseGoal.length > 0, true);
});

test('normalizeV7Snapshot enriches latest plans and exercises with prescription metadata', () => {
  const snapshot = normalizeV7Snapshot({
    version: 8,
    catalog: {
      planGroups: [{
        id: 'stage1',
        name: '基础恢复期',
        plans: [{
          id: 'legacy_plan',
          name: '推A',
          stage: 'stage1',
          modules: [{
            id: 'legacy_plan__m1',
            name: '主训',
            type: 'main',
            exercises: [{
              id: 'legacy_plan__m1__e1',
              name: '左腿BFR血流限制伸展',
              mode: 'counted',
              sets: 4,
              reps: '30-15-15-15',
              restBetweenSets: 45,
              tip: '使用20-30% 1RM极轻重量',
              sides: 'left',
            }],
          }],
        }],
      }],
    },
    runtime: {},
    settings: {},
  });

  const plan = snapshot.catalog.planGroups[0].plans[0];
  const exercise = plan.modules[0].exercises[0];

  assert.equal(snapshot.version, 8);
  assert.equal(plan.coaching.frequency, '按周计划执行，疼痛/肿胀异常时优先降级或休息');
  assert.equal(exercise.prescription.intensity, '20-30% 1RM / BFR 低负荷');
  assert.equal(exercise.prescription.painCeiling, 3);
  assert.equal(exercise.prescription.trackingMetric, '完成质量、疼痛反应、患侧泵感');
});

test('validateV7Snapshot accepts v8 snapshots with coach metadata', () => {
  const result = validateV7Snapshot({
    version: 8,
    catalog: {
      planGroups: [{
        id: 'custom',
        name: '自定义',
        coaching: { phaseGoal: '保持训练连续性' },
        plans: [{
          id: 'p1',
          name: '自定义计划',
          coaching: { objective: '提高膝关节控制' },
          modules: [{
            id: 'p1__m1',
            name: '主训',
            exercises: [{
              id: 'p1__m1__e1',
              name: '分腿蹲',
              mode: 'counted',
              sets: 3,
              reps: '8/侧',
              prescription: { targetRpe: '6-7' },
            }],
          }],
        }],
      }],
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.snapshot.version, 8);
  assert.equal(result.snapshot.catalog.planGroups[0].plans[0].coaching.objective, '提高膝关节控制');
});
