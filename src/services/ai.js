// AI 动作详解（DeepSeek）：为动作生成结构化讲解，写入 exercise.enrichment。
const API_URL = 'https://api.deepseek.com/chat/completions';

const SYSTEM_PROMPT = `你是一位资深康复训练教练，精通 ACL 术后重返运动的循证训练方法。
为给定动作写一份简明讲解，直接输出 Markdown，不要标题重复动作名，包含以下小节：
## 动作目的 —— 2-3 句，说明训练目标与针对性
## 执行要点 —— 4-6 条要点，每条一行，具体可执行（角度/节奏/呼吸/身体位置）
## 常见错误 —— 3 条，每条一行
## 进阶与退阶 —— 各 1-2 条
全文中文，总长度 300 字以内，语气专业克制，不夸大不添油加醋。`;

function buildUserPrompt(exercise) {
  const lines = [`动作名称：${exercise.name}`];
  if (exercise.mode === 'timed') lines.push(`处方：${exercise.sets} 组 × ${exercise.duration || 60} 秒`);
  else lines.push(`处方：${exercise.sets} 组 × ${exercise.reps || 10} 次`);
  if (exercise.equipment?.length) lines.push(`器械：${exercise.equipment.join('、')}`);
  if (exercise.tip) lines.push(`已有提示：${exercise.tip}`);
  const p = exercise.prescription || {};
  const pParts = [];
  if (p.targetTissue) pParts.push(`目标组织：${p.targetTissue}`);
  if (p.targetRpe) pParts.push(`目标 RPE：${p.targetRpe}`);
  if (p.painCeiling != null) pParts.push(`疼痛上限：${p.painCeiling}/10`);
  if (p.progression) pParts.push(`进阶依据：${p.progression}`);
  if (pParts.length) lines.push(pParts.join('\n'));
  return lines.join('\n');
}

export async function generateEnrichment(exercise, aiConfig) {
  const apiKey = String(aiConfig?.apiKey || '').trim();
  if (!apiKey) throw new Error('请先在「我的- AI 辅助」中配置 DeepSeek API Key');
  const model = aiConfig?.model || 'deepseek-v4-flash';

  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(exercise) }
      ],
      temperature: 0.4,
      max_tokens: 900
    })
  });
  if (!resp.ok) {
    let msg = `请求失败（HTTP ${resp.status}）`;
    try {
      const data = await resp.json();
      msg = data?.error?.message || msg;
    } catch {
      /* 保持默认消息 */
    }
    throw new Error(msg);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('模型未返回内容，请重试');
  return { content, model, generatedAt: new Date().toISOString() };
}
