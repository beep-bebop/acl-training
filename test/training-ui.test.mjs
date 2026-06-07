import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNextTrainingAction,
  renderTrainingActionDock,
} from '../pages/training.js';

test('getNextTrainingAction returns the first incomplete set', () => {
  const plan = {
    id: 'plan_a',
    modules: [
      {
        name: 'Main',
        exercises: [
          { id: 'e1', name: 'Squat', sets: 2, reps: '10' },
          { id: 'e2', name: 'Bridge', sets: 1, reps: '12' },
        ],
      },
    ],
  };
  const progress = { e1_s0: true };

  const action = getNextTrainingAction(plan, progress);

  assert.equal(action.exerciseName, 'Squat');
  assert.equal(action.moduleName, 'Main');
  assert.equal(action.setIndex, 1);
  assert.equal(action.totalSets, 2);
  assert.equal(action.done, false);
});

test('renderTrainingActionDock contains mobile next action controls', () => {
  const html = renderTrainingActionDock({
    encodedPlanId: 'plan_a',
    action: {
      moduleIndex: 0,
      exerciseIndex: 1,
      setIndex: 0,
      totalSets: 1,
      exerciseName: 'Bridge',
      moduleName: 'Main',
      isTimed: false,
      duration: 45,
      done: false,
    },
  });

  assert.match(html, /training-action-dock/);
  assert.match(html, /training-next-action/);
  assert.match(html, /data-toggle-set="plan_a\|0\|1\|0"/);
  assert.match(html, /完成本组/);
});
