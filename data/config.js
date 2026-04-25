// 阶段定义
export const STAGES = [
  { id: 'stage1', name: '基础恢复期', subtitle: '阶段一', badge: '一', color: '#34C759', gradient: 'linear-gradient(135deg, #34C759 0%, #30D158 100%)', order: 1 },
  { id: 'stage2', name: '进阶强化期', subtitle: '阶段二', badge: '二', color: '#FF9500', gradient: 'linear-gradient(135deg, #FF9500 0%, #FF6B35 100%)', order: 2 },
  { id: 'restday', name: '休息日', subtitle: '阶段休', badge: '休', color: '#5856D6', gradient: 'linear-gradient(135deg, #5856D6 0%, #AF52DE 100%)', order: 3 },
];

// v7 默认 canonical catalog 文件
export const CATALOG_V7_FILE = 'data/catalog.v7.json';

// 默认计划 JSON 文件列表
export const PLAN_FILES = [
  'data/stage1_plans.json',
  'data/stage2_plans.json',
  'data/restday_plans.json',
];

// 模块类型配色
export const MODULE_COLORS = {
  warmup:   { bg: 'rgba(52,199,89,0.08)',  border: 'rgba(52,199,89,0.2)',  text: '#34C759', label: '放松' },
  stretch:  { bg: 'rgba(90,200,250,0.08)',  border: 'rgba(90,200,250,0.2)',  text: '#5AC8FA', label: '拉伸' },
  activate: { bg: 'rgba(255,149,0,0.08)',   border: 'rgba(255,149,0,0.2)',  text: '#FF9500', label: '激活' },
  main:     { bg: 'rgba(88,86,214,0.08)',   border: 'rgba(88,86,214,0.2)',  text: '#5856D6', label: '主训' },
  core:     { bg: 'rgba(255,45,85,0.08)',   border: 'rgba(255,45,85,0.2)',  text: '#FF2D55', label: '核心' },
  cooldown: { bg: 'rgba(90,200,250,0.08)',  border: 'rgba(90,200,250,0.2)', text: '#5AC8FA', label: '冷却' },
  cardio:   { bg: 'rgba(255,59,48,0.08)',   border: 'rgba(255,59,48,0.2)',  text: '#FF3B30', label: '有氧' },
  custom:   { bg: 'rgba(142,142,147,0.08)', border: 'rgba(142,142,147,0.2)',text: '#8E8E93', label: '自定义' },
};
