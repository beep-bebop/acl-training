// 领域配置：模块类型 / 负荷类型 / 疼痛分级。
// 颜色不在此定义——一律由 styles/tokens.css 的 --mod-* / --pain-* 变量承载。

export const MODULE_ORDER = ['warmup', 'stretch', 'activate', 'main', 'core', 'cooldown', 'cardio', 'custom'];

export const MODULE_TYPES = {
  warmup: { label: '热身', defaultRest: 15 },
  stretch: { label: '拉伸', defaultRest: 20 },
  activate: { label: '激活', defaultRest: 30 },
  main: { label: '主训练', defaultRest: 90 },
  core: { label: '核心', defaultRest: 60 },
  cooldown: { label: '放松', defaultRest: 20 },
  cardio: { label: '有氧', defaultRest: 60 },
  custom: { label: '自定义', defaultRest: 60 }
};

// 负荷类型：渐进引擎按 kind 决定进阶策略（step 为数值步进，dir 为进阶方向）
export const LOAD_KINDS = {
  weight: { label: '负重', unit: 'kg', step: 2.5, dir: 1, hint: '器械/自由重量（kg）' },
  band: { label: '弹力带', unit: '档', step: 1, dir: 1, hint: '阻力档位 1-5' },
  assisted: { label: '辅助', unit: '档', step: 1, dir: -1, hint: '辅助档位，数值越小难度越高' },
  bodyweight: { label: '自重+', unit: 'kg', step: 2.5, dir: 1, hint: '附加负重（kg），0 为纯自重' },
  none: { label: '无负荷', unit: '', step: 0, dir: 0, hint: '不追踪负荷' }
};

export const BAND_MAX = 5;

// 疼痛分级（NRS 0-10 归并为 5 档展示色，css 类 pain-0 … pain-4）
export const PAIN_BANDS = [
  { max: 1, cls: 'pain-0', label: '无' },
  { max: 3, cls: 'pain-1', label: '轻度' },
  { max: 5, cls: 'pain-2', label: '中度' },
  { max: 7, cls: 'pain-3', label: '明显' },
  { max: 10, cls: 'pain-4', label: '严重' }
];

export function painBand(score) {
  const n = Number(score) || 0;
  return PAIN_BANDS.find((b) => n <= b.max) || PAIN_BANDS[PAIN_BANDS.length - 1];
}

// 训练日/安全门槛默认值
export const DEFAULT_PAIN_CEILING = 3;
