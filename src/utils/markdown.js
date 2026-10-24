// 极简 Markdown 渲染（AI 详解内容用）：标题/加粗/列表/换行，先转义保证安全。
export function renderMarkdown(text) {
  const src = String(text || '');
  const escaped = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const lines = escaped.split(/\r?\n/);
  const out = [];
  let inList = false;
  for (const line of lines) {
    const heading = line.match(/^#{1,4}\s*(.+)$/);
    const listItem = line.match(/^[-*•]\s+(.+)$/);
    if (listItem) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(listItem[1])}</li>`);
      continue;
    }
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
    if (heading) out.push(`<h5>${inline(heading[1])}</h5>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

function inline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}
