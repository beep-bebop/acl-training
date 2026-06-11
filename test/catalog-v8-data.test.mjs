import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('canonical catalog data is v8 and includes coaching prescriptions', () => {
  const catalog = JSON.parse(readFileSync(new URL('../data/catalog.v8.json', import.meta.url), 'utf8'));
  const groups = catalog.catalog.planGroups;
  const plans = groups.flatMap(group => group.plans || []);
  const exercises = plans.flatMap(plan => (plan.modules || []).flatMap(module => module.exercises || []));

  assert.equal(catalog.version, 8);
  assert.equal(groups.every(group => group.coaching?.phaseGoal), true);
  assert.equal(plans.every(plan => plan.coaching?.objective), true);
  assert.equal(exercises.length > 0, true);
  assert.equal(exercises.every(ex => ex.prescription?.movementPattern && ex.prescription?.trackingMetric), true);
});
