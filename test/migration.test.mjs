// 旧版本数据迁移：v7 键(v8载荷) / v6 扁平 / 导入文件
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateSnapshot, migrateCatalogInput, migrateFromLegacyStorage } from '../src/core/migration.js';

const v8Snapshot = {
  version: 8,
  catalog: {
    planGroups: [
      { id: 'stage1', name: '基础恢复期', color: '#34C759', order: 1, coaching: { phaseGoal: '目标' }, plans: [
        { id: 'stage1_pushA', name: '推A', stage: 'stage1', coaching: {}, modules: [
          { id: 'm1', name: '热身', type: 'warmup', exercises: [
            { id: 'e1', name: '泡沫轴：小腿', mode: 'timed', sets: 1, duration: 60, restBetweenSets: 30, equipment: ['泡沫轴'] }
          ] }
        ] }
      ] }
    ]
  },
  runtime: {
    calendarLogs: { '2026-10-01': [{ planId: 'stage1_pushA', name: '泡沫轴：小腿', time: 1 }] },
    sessionLogs: [{ date: '2026-10-01', planId: 'stage1_pushA', durationSeconds: 1800, completedSets: 10, completedExercises: 5 }],
    readinessLogs: [{ date: '2026-10-01', pain: 1, swelling: 0 }]
  },
  settings: { aiConfig: { deepseekApiKey: 'k', deepseekModel: 'deepseek-v4-flash' } }
};

test('v8 快照迁移：保留日志 / restBetweenSets→rest / 补负荷类型', () => {
  const snap = migrateSnapshot(v8Snapshot);
  assert.ok(snap);
  assert.equal(snap.version, 9);
  const ex = snap.catalog.planGroups[0].plans[0].modules[0].exercises[0];
  assert.equal(ex.rest, 30);
  assert.equal(ex.load.kind, 'none');
  assert.equal(snap.logs.sessionLogs.length, 1);
  assert.equal(snap.logs.readinessLogs.length, 1);
  assert.equal(snap.logs.calendarLogs['2026-10-01'].length, 1);
  assert.equal(snap.settings.ai.apiKey, 'k');
  // program 有默认值
  assert.ok(snap.program.cycleStart);
});

test('v6 扁平结构按 stage 重新分组', () => {
  const snap = migrateSnapshot({
    version: 6,
    plans: [
      { id: 'p1', name: '推A', stage: 'stage1', modules: [] },
      { id: 'p2', name: '拉B', stage: 'stage2', modules: [] }
    ],
    runtime: {}
  });
  assert.equal(snap.version, 9);
  const ids = snap.catalog.planGroups.map((g) => g.id);
  assert.deepEqual(ids, ['stage1', 'stage2']);
  assert.equal(snap.catalog.planGroups[0].name, '基础恢复期');
});

test('v9 快照原样通过', () => {
  const snap = migrateSnapshot({ version: 9, planGroups: [{ id: 'g', name: 'G', plans: [] }], logs: {} });
  assert.equal(snap.version, 9);
  assert.equal(snap.catalog.planGroups[0].id, 'g');
});

test('无法识别的结构返回 null', () => {
  assert.equal(migrateSnapshot(null), null);
  assert.equal(migrateSnapshot({ hello: 1 }), null);
});

test('migrateCatalogInput：目录 / 完整快照 / 备份载荷三种输入', () => {
  const groups = [{ id: 'g', name: 'G', plans: [] }];
  assert.equal(migrateCatalogInput({ planGroups: groups }).planGroups.length, 1);
  assert.equal(migrateCatalogInput({ catalog: { planGroups: groups } }).planGroups.length, 1);
  assert.equal(migrateCatalogInput({ snapshot: { version: 9, catalog: { planGroups: groups } } }).planGroups.length, 1);
  assert.equal(migrateCatalogInput({ foo: 1 }), null);
});

test('migrateFromLegacyStorage：读取旧键并迁移', () => {
  const backing = new Map([['acl_v7', JSON.stringify(v8Snapshot)]]);
  const shim = {
    getItem: (k) => backing.get(k) ?? null,
    setItem: (k, v) => backing.set(k, v),
    removeItem: (k) => backing.delete(k)
  };
  const snap = migrateFromLegacyStorage(() => shim);
  assert.ok(snap);
  assert.equal(snap.version, 9);
});
