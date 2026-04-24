// 导入对话框
import { state } from '../core/state.js';
import { importPlans } from '../services/plans.js';
import { showToast } from '../utils/helpers.js';
import { renderLibrary } from '../pages/library.js';

export function showImportDialog() {
  document.getElementById('importOverlay').classList.add('show');
  document.getElementById('importText').value = '';
  document.getElementById('importPreview').innerHTML = '';
  document.getElementById('importConfirmBtn').style.display = 'none';
}

export function closeImportDialog() {
  document.getElementById('importOverlay').classList.remove('show');
}

export function previewImport() {
  const text = document.getElementById('importText').value.trim();
  const preview = document.getElementById('importPreview');
  const confirmBtn = document.getElementById('importConfirmBtn');
  const strategy = document.getElementById('importStrategy').value;

  if (!text) {
    preview.innerHTML = '<div style="color:var(--text3);">请粘贴 JSON 数据</div>';
    confirmBtn.style.display = 'none';
    return;
  }

  try {
    const data = typeof text === 'string' ? JSON.parse(text) : text;
    if (!data || !Array.isArray(data.plans)) throw new Error('格式错误');

    let html = '<div style="margin-bottom:8px;font-weight:700;">📋 导入预览</div>';
    html += `<div style="font-size:13px;color:var(--text2);">共 ${data.plans.length} 个计划 · 策略：${strategy}</div>`;
    const simulatedIds = new Set(state.plans.map(p => p.id));

    data.plans.forEach(p => {
      if (strategy === 'append') {
        let finalId = p.id;
        let counter = 2;
        while (simulatedIds.has(finalId)) {
          finalId = `${p.id}_${counter++}`;
        }
        simulatedIds.add(finalId);
        const renamed = finalId !== p.id;
        html += `<div style="font-size:13px;padding:4px 0;${renamed ? 'color:var(--warning);' : ''}">➕ ${p.name} (${finalId})${renamed ? ' — 自动重命名' : ''}</div>`;
        return;
      }

      const exists = simulatedIds.has(p.id);
      simulatedIds.add(p.id);
      html += `<div style="font-size:13px;padding:4px 0;${exists ? 'color:var(--warning);' : ''}">${exists ? '🔄' : '➕'} ${p.name} (${p.id})${exists ? ' — 将覆盖' : ''}</div>`;
    });

    preview.innerHTML = html;
    confirmBtn.style.display = 'flex';
  } catch (e) {
    preview.innerHTML = `<div style="color:var(--danger);">❌ 解析失败: ${e.message}</div>`;
    confirmBtn.style.display = 'none';
  }
}

export function confirmImport() {
  const text = document.getElementById('importText').value.trim();
  const strategy = document.getElementById('importStrategy').value;
  const result = importPlans(text, strategy);
  if (!result.ok) {
    showToast('❌ ' + result.msg);
    return;
  }
  closeImportDialog();
  renderLibrary();
  showToast(`✅ 导入完成：${result.imported} 新增，${result.updated} 更新`);
}
