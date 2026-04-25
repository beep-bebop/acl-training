// AI 丰富动作详情（DeepSeek + MuscleWiki/视频索引）

const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';
const MUSCLEWIKI_DIRECTORY_URL = 'https://musclewiki.com/zh-cn/directory';

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeLink(link) {
  const text = cleanText(link);
  if (!/^https?:\/\//i.test(text)) return '';
  return text;
}

function uniqueLinks(links) {
  const seen = new Set();
  const out = [];
  links.forEach((link) => {
    const normalized = normalizeLink(link);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
}

function buildExerciseKeywords(exerciseName) {
  const raw = cleanText(exerciseName)
    .replace(/^[A-Za-z]\d+\.\s*/, '')
    .replace(/[。.!?]+$/g, '');
  const chunks = raw
    .split(/[()（）,，/|+\-·]/)
    .map(s => cleanText(s))
    .filter(Boolean);
  const keywords = [raw, ...chunks].filter(Boolean);
  return Array.from(new Set(keywords)).slice(0, 5);
}

async function fetchMuscleWikiLinks(exerciseName) {
  const fallback = [MUSCLEWIKI_DIRECTORY_URL];
  try {
    const resp = await fetch(MUSCLEWIKI_DIRECTORY_URL, { method: 'GET' });
    if (!resp.ok) return fallback;
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const anchors = Array.from(doc.querySelectorAll('a[href]'));
    const keywords = buildExerciseKeywords(exerciseName);
    if (!keywords.length) return fallback;

    const matched = [];
    anchors.forEach((a) => {
      const text = cleanText(a.textContent).toLowerCase();
      if (!text) return;
      const hit = keywords.some(k => text.includes(k.toLowerCase()));
      if (!hit) return;
      try {
        matched.push(new URL(a.getAttribute('href'), MUSCLEWIKI_DIRECTORY_URL).href);
      } catch (_e) {
        // ignore bad urls
      }
    });

    return uniqueLinks([...fallback, ...matched]).slice(0, 4);
  } catch (_e) {
    return fallback;
  }
}

function extractJsonObject(text) {
  const raw = cleanText(text);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_e) {
    // continue
  }

  const fence = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch (_e) {
      // continue
    }
  }

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const maybeJson = raw.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(maybeJson);
    } catch (_e) {
      return null;
    }
  }

  return null;
}

function formatEnhancedTip(parsed, fallbackContent, fallbackRefs) {
  const blocks = [];
  const enhancedTip = cleanText(parsed?.enhanced_tip);
  if (enhancedTip) blocks.push(enhancedTip);

  const keyPoints = asList(parsed?.key_points).map(cleanText).filter(Boolean);
  if (keyPoints.length) {
    blocks.push(`执行要点：\n- ${keyPoints.join('\n- ')}`);
  }

  const mistakes = asList(parsed?.common_mistakes).map(cleanText).filter(Boolean);
  if (mistakes.length) {
    blocks.push(`常见错误：\n- ${mistakes.join('\n- ')}`);
  }

  const progression = cleanText(parsed?.progression);
  if (progression) {
    blocks.push(`进阶建议：\n${progression}`);
  }

  const refs = uniqueLinks([
    ...asList(parsed?.references),
    ...asList(parsed?.video_links),
    ...fallbackRefs,
  ]);
  if (refs.length) {
    blocks.push(`参考链接：\n- ${refs.join('\n- ')}`);
  }

  if (!blocks.length) {
    const content = cleanText(fallbackContent);
    if (!content) return '';
    return `${content}${refs.length ? `\n\n参考链接：\n- ${refs.join('\n- ')}` : ''}`;
  }

  return blocks.join('\n\n');
}

function buildEnrichmentPayload(parsed, fallbackRefs, model) {
  const keyPoints = asList(parsed?.key_points ?? parsed?.keyPoints).map(cleanText).filter(Boolean);
  const commonMistakes = asList(parsed?.common_mistakes ?? parsed?.commonMistakes).map(cleanText).filter(Boolean);
  const progression = cleanText(parsed?.progression);
  const references = uniqueLinks([
    ...asList(parsed?.references),
    ...fallbackRefs,
  ]);
  const videoLinks = uniqueLinks([
    ...asList(parsed?.video_links ?? parsed?.videoLinks),
  ]);

  const hasContent = keyPoints.length
    || commonMistakes.length
    || progression
    || references.length
    || videoLinks.length;
  if (!hasContent) return null;

  return {
    keyPoints,
    commonMistakes,
    progression,
    references,
    videoLinks,
    source: `deepseek:${cleanText(model) || 'default'}`,
    updatedAt: new Date().toISOString(),
  };
}

function buildVideoSearchLinks(exerciseName) {
  const query = encodeURIComponent(`${cleanText(exerciseName)} 动作教学`);
  return [
    `https://www.youtube.com/results?search_query=${query}`,
    `https://search.bilibili.com/all?keyword=${query}`,
  ];
}

export async function enrichExerciseDetailByAI({
  apiKey,
  model = 'deepseek-v4-flash',
  planName,
  moduleName,
  exerciseName,
  mode,
  sets,
  reps,
  duration,
  currentTip,
}) {
  const key = cleanText(apiKey);
  if (!key) {
    return { ok: false, msg: '请先在设置页填写 DeepSeek API Key 并保存。' };
  }

  const refsFromWiki = await fetchMuscleWikiLinks(exerciseName);
  const refs = uniqueLinks([...refsFromWiki, ...buildVideoSearchLinks(exerciseName)]);
  const modeDesc = mode === 'timed'
    ? `计时动作，${sets} 组，每组 ${duration} 秒`
    : `计数动作，${sets} 组，每组 ${reps || '次数未填写'}`;

  const systemPrompt = '你是运动康复教练与体能训练顾问。请给出可执行、可落地、可理解的训练要点，不要做医疗诊断。';
  const userPrompt = [
    '请基于以下动作信息，输出更详细的执行要点，并结合可用的参考索引链接（包含动作资料和视频搜索链接）。',
    '',
    `计划：${cleanText(planName)}`,
    `模块：${cleanText(moduleName)}`,
    `动作：${cleanText(exerciseName)}`,
    `类型：${modeDesc}`,
    `当前要点：${cleanText(currentTip) || '（暂无）'}`,
    '',
    '可用参考链接：',
    ...refs.map(link => `- ${link}`),
    '',
    '请返回严格 JSON（不要 Markdown）：',
    '{"enhanced_tip":"...","key_points":["..."],"common_mistakes":["..."],"progression":"...","references":["..."],"video_links":["..."]}',
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);

  try {
    const resp = await fetch(DEEPSEEK_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      let msg = `DeepSeek 请求失败（${resp.status}）`;
      try {
        const err = await resp.json();
        msg = cleanText(err?.error?.message) || cleanText(err?.message) || msg;
      } catch (_e) {
        // keep default
      }
      return { ok: false, msg };
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = extractJsonObject(content);
    const enrichment = buildEnrichmentPayload(parsed, refs, model);
    const tip = formatEnhancedTip(parsed, content, refs);
    if (!tip) {
      return { ok: false, msg: '模型返回内容为空，请重试。' };
    }
    return { ok: true, tip, references: refs, enrichment };
  } catch (e) {
    if (e.name === 'AbortError') {
      return { ok: false, msg: '请求超时，请检查网络后重试。' };
    }
    return { ok: false, msg: `调用失败：${e.message}` };
  } finally {
    clearTimeout(timer);
  }
}
