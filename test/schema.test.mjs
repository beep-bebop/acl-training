// 数据模式：默认值 / 负荷推断 / 校验 / 旧设置映射
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION,
  normalizeExercise,
  normalizeCatalog,
  validateCatalog,
  normalizeSnapshot,
  createEmptySnapshot,
  inferLoadKind
} from '../src/core/schema.js';

test('唯一版本号 v9，无 v7/v8 残留命名', () => {
  assert.equal(SCHEMA_VERSION, 9);
});

test('normalizeExercise 补全默认值并推断负荷类型', () => {
  const ex = normalizeExercise({ name: '坐姿哑铃推肩', mode: 'counted', sets: 3, reps: 10, equipment: ['哑铃'] });
  assert.equal(ex.sets, 3);
  assert.equal(ex.reps, 10);
  assert.equal(ex.rest, 60); // custom 模块默认
  assert.equal(ex.load.kind, 'weight');
  assert.equal(ex.prescription.painCeiling, 3);
  assert.equal(ex.duration, undefined); // 计次不带时长
});

test('负荷推断：弹力带 / 辅助 / 自重 / 无负荷', () => {
  assert.equal(inferLoadKind({ name: '弹力带侧向行走', equipment: ['弹力带'] }, 'activate'), 'band');
  assert.equal(inferLoadKind({ name: '宽握辅助引体', equipment: ['高位下拉机/引体辅助'] }, 'main'), 'weight');
  assert.equal(inferLoadKind({ name: '单腿臀桥', equipment: [] }, 'main'), 'bodyweight');
  assert.equal(inferLoadKind({ name: '泡沫轴：小腿', equipment: ['泡沫轴'] }, 'warmup'), 'none');
});

test('timed 动作：duration 保留、reps 不存在', () => {
  const ex = normalizeExercise({ name: '侧平板支撑', mode: 'timed', sets: 2, duration: 40 }, { moduleType: 'core' });
  assert.equal(ex.duration, 40);
  assert.equal(ex.reps, undefined);
  assert.equal(ex.rest, 60); // core 默认
});

test('normalizeCatalog 兼容 v8 包装 / v9 平铺 / v6 扁平', () => {
  const group = { id: 'stage1', name: '一', plans: [{ id: 'p1', name: '推', modules: [{ id: 'm1', name: '热身', type: 'warmup', exercises: [{ id: 'e1', name: '拉伸', mode: 'timed', sets: 1, duration: 30 }] }] }] };
  const v8 = normalizeCatalog({ version: 8, catalog: { planGroups: [group] } });
  const v9 = normalizeCatalog({ version: 9, planGroups: [group] });
  const v6 = normalizeCatalog({ version: 6, plans: [{ ...group.plans[0], stage: 'stage1' }] });
  for (const c of [v8, v9, v6]) {
    assert.equal(c.planGroups.length, 1);
    assert.equal(c.planGroups[0].plans[0].modules[0].exercises.length, 1);
    assert.equal(c.planGroups[0].plans[0].modules[0].exercises[0].load.kind, 'none');
  }
});

test('validateCatalog：结构校验与重复 id 拒绝', () => {
  const ok = validateCatalog(normalizeCatalog({ planGroups: [{ id: 'g', name: 'G', plans: [{ id: 'p', name: 'P', modules: [] }] }] }));
  assert.equal(ok.ok, true);

  const dup = validateCatalog({
    planGroups: [
      { id: 'g', name: 'G', plans: [
        { id: 'p', name: 'P', modules: [] },
        { id: 'p', name: 'P2', modules: [] }
      ] }
    ]
  });
  assert.equal(dup.ok, false);
  assert.match(dup.msg, /重复/);

  assert.equal(validateCatalog({}).ok, false);
});

test('normalizeSnapshot：旧 aiConfig/githubBackup 设置映射到新结构', () => {
  const snap = normalizeSnapshot({
    version: 8,
    catalog: { planGroups: [] },
    settings: {
      aiConfig: { deepseekApiKey: 'sk-x', deepseekModel: 'deepseek-v4-pro' },
      githubBackup: { owner: 'u', repo: 'r', lastBackupAt: '2026-01-01' }
    }
  });
  assert.equal(snap.version, 9);
  assert.equal(snap.settings.ai.apiKey, 'sk-x');
  assert.equal(snap.settings.ai.model, 'deepseek-v4-pro');
  assert.equal(snap.settings.backup.owner, 'u');
  assert.equal(snap.settings.backup.lastBackupAt, '2026-01-01');
  assert.equal(snap.settings.theme, 'dark');
});

test('空快照结构完整', () => {
  const snap = createEmptySnapshot();
  assert.equal(snap.version, 9);
  assert.deepEqual(Object.keys(snap.logs).sort(), ['calendarLogs', 'readinessLogs', 'sessionLogs', 'setLogs']);
  assert.equal(snap.program.deloadEveryN, 4);
});
