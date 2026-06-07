import test from 'node:test';
import assert from 'node:assert/strict';
import { renderStatsDashboard } from '../pages/calendar-page.js';

test('renderStatsDashboard includes short term and growth sections', () => {
  const html = renderStatsDashboard({
    last7: { trainingDays: 3, sessions: 2, completedSets: 9, durationSeconds: 4200 },
    last30: { trainingDays: 8, sessions: 6, completedSets: 31, durationSeconds: 12600 },
    trends: { sets: '+50%', exercises: '+25%', sessions: '+1' },
    planSummaries: [{ planId: 'plan_a', name: 'Plan A', sessions: 2, completedSets: 9 }],
  });

  assert.match(html, /最近 7 天/);
  assert.match(html, /最近 30 天/);
  assert.match(html, /渐进增长/);
  assert.match(html, /Plan A/);
});
