import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderGroupManagePanel,
  renderPlanManagePanel,
} from '../pages/library.js';

test('group management panel does not render random art controls', () => {
  const html = renderGroupManagePanel({ id: 'stage1', name: '基础期' }, 'stage1');
  assert.doesNotMatch(html, /data-group-random-art/);
  assert.match(html, /data-add-plan/);
  assert.match(html, /data-delete-group/);
});

test('plan management panel does not render emoji picker controls', () => {
  const html = renderPlanManagePanel({ id: 'plan_a', name: 'Plan A', icon: 'A' }, 'plan_a');
  assert.doesNotMatch(html, /data-plan-emoji/);
  assert.match(html, /data-plan-name-input/);
  assert.match(html, /data-delete-plan/);
});
