import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTrainingStats,
  formatTrendLabel,
  getDateRange,
} from '../services/stats.js';

const plans = [
  {
    id: 'plan_a',
    name: 'Plan A',
    modules: [
      {
        id: 'm1',
        name: 'Strength',
        exercises: [
          { id: 'e1', name: 'Squat', sets: 3 },
          { id: 'e2', name: 'Bridge', sets: 2 },
        ],
      },
    ],
  },
];

test('getDateRange returns inclusive ISO dates', () => {
  assert.deepEqual(getDateRange('2026-06-07', 3), [
    '2026-06-05',
    '2026-06-06',
    '2026-06-07',
  ]);
});

test('buildTrainingStats counts recent activity and session duration', () => {
  const runtime = {
    calendarLogs: {
      '2026-06-01': [{ planId: 'plan_a', exerciseId: 'e1', name: 'Squat', time: '2026-06-01T10:00:00.000Z' }],
      '2026-06-06': [{ planId: 'plan_a', exerciseId: 'e2', name: 'Bridge', time: '2026-06-06T10:00:00.000Z' }],
      '2026-06-07': [{ planId: 'plan_a', exerciseId: 'e1', name: 'Squat', time: '2026-06-07T10:00:00.000Z' }],
    },
    sessionLogs: [
      { date: '2026-06-06', planId: 'plan_a', durationSeconds: 1800, completedSets: 4, completedExercises: 1, completedPlan: false },
      { date: '2026-06-07', planId: 'plan_a', durationSeconds: 2400, completedSets: 5, completedExercises: 2, completedPlan: true },
    ],
  };

  const stats = buildTrainingStats({ plans, runtime, today: '2026-06-07' });

  assert.equal(stats.last7.trainingDays, 3);
  assert.equal(stats.last7.sessions, 2);
  assert.equal(stats.last7.durationSeconds, 4200);
  assert.equal(stats.last7.completedSets, 9);
  assert.equal(stats.last7.completedPlans, 1);
  assert.equal(stats.planSummaries[0].planId, 'plan_a');
  assert.equal(stats.planSummaries[0].sessions, 2);
});

test('formatTrendLabel shows growth, decline, and flat trend', () => {
  assert.equal(formatTrendLabel(12, 8), '+50%');
  assert.equal(formatTrendLabel(6, 8), '-25%');
  assert.equal(formatTrendLabel(8, 8), '0%');
  assert.equal(formatTrendLabel(5, 0), '+5');
});
