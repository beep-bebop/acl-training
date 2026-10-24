let seq = 0;

/** 生成短随机 id，前缀语义化（plan_/mod_/ex_/set_…） */
export function genId(prefix = 'id') {
  seq = (seq + 1) % 1296;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 6)}`;
}

/** 计划内唯一 id（新建计划/模块/动作时保证不与既有冲突） */
export function uniqueId(prefix, existing) {
  const used = new Set(existing);
  let id = genId(prefix);
  while (used.has(id)) id = genId(prefix);
  return id;
}
