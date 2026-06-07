import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionSummary } from '../pages/training.js';

test('buildSessionSummary counts completed sets and exercises for a plan', () => {
  const plan = {
    id: 'plan_a',
    name: 'Plan A',
    modules: [
      { exercises: [{ id: 'e1', sets: 2 }, { id: 'e2', sets: 1 }] },
    ],
  };
  const progress = {
    e1_s0: true,
    e1_s1: true,
    e2_s0: true,
  };

  const summary = buildSessionSummary({
    plan,
    progress,
    startedAt: Date.parse('2026-06-07T10:00:00.000Z'),
    endedAt: Date.parse('2026-06-07T10:30:00.000Z'),
    date: '2026-06-07',
  });

  assert.equal(summary.planId, 'plan_a');
  assert.equal(summary.planName, 'Plan A');
  assert.equal(summary.durationSeconds, 1800);
  assert.equal(summary.completedSets, 3);
  assert.equal(summary.totalSets, 3);
  assert.equal(summary.completedExercises, 2);
  assert.equal(summary.totalExercises, 2);
  assert.equal(summary.completedPlan, true);
});
