<script setup>
// AI 面板：为选中动作生成/编辑/保存详解（enrichment）
import { computed, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';
import { useCatalogStore } from '../../stores/catalog.js';
import { useSettingsStore } from '../../stores/settings.js';
import { useUiStore } from '../../stores/ui.js';
import { generateEnrichment } from '../../services/ai.js';
import { renderMarkdown } from '../../utils/markdown.js';

const props = defineProps({ exerciseId: { type: String, default: null } });

const catalog = useCatalogStore();
const settings = useSettingsStore();
const ui = useUiStore();

const found = computed(() => (props.exerciseId ? catalog.findExercise(props.exerciseId) : null));
const exercise = computed(() => found.value?.exercise || null);

const busy = ref(false);
const editing = ref(false);
const draft = ref('');

async function generate() {
  if (!exercise.value || busy.value) return;
  if (!settings.ai.apiKey) {
    ui.toast('请先在「我的 → AI 辅助」配置 API Key', 'error');
    return;
  }
  busy.value = true;
  try {
    const result = await generateEnrichment(exercise.value, settings.ai);
    catalog.updateExercise(exercise.value.id, { enrichment: result });
    ui.toast('已生成详解', 'success');
  } catch (e) {
    ui.toast(`生成失败：${e.message}`, 'error');
  } finally {
    busy.value = false;
  }
}

function startEdit() {
  draft.value = exercise.value?.enrichment?.content || '';
  editing.value = true;
}
function saveEdit() {
  if (!exercise.value) return;
  catalog.updateExercise(exercise.value.id, {
    enrichment: { ...(exercise.value.enrichment || {}), content: draft.value, generatedAt: exercise.value.enrichment?.generatedAt || new Date().toISOString(), model: exercise.value.enrichment?.model || 'manual' }
  });
  editing.value = false;
  ui.toast('详解已保存', 'success');
}
async function clearEnrichment() {
  const ok = await ui.confirmAsync({ title: '删除该动作的 AI 详解？', confirmText: '删除', danger: true });
  if (!ok || !exercise.value) return;
  catalog.updateExercise(exercise.value.id, { enrichment: undefined });
}
</script>

<template>
  <div v-if="exercise" class="aip">
    <div class="aip-head">
      <h4>{{ exercise.name }}</h4>
      <button class="btn btn-sm btn-primary" :disabled="busy" @click="generate">
        <AppIcon :name="busy ? 'sync' : 'sparkles'" :size="15" :class="{ spin: busy }" />
        {{ busy ? '生成中…' : exercise.enrichment ? '重新生成' : '生成详解' }}
      </button>
    </div>

    <template v-if="exercise.enrichment?.content && !editing">
      <div class="aip-meta t-mini">
        {{ exercise.enrichment.model }} · {{ (exercise.enrichment.generatedAt || '').slice(0, 10) }}
      </div>
      <div class="markdown-body aip-content" v-html="renderMarkdown(exercise.enrichment.content)" />
      <div class="aip-actions">
        <button class="btn btn-ghost btn-sm" @click="startEdit">编辑</button>
        <button class="btn btn-danger btn-sm" @click="clearEnrichment">删除</button>
      </div>
    </template>

    <template v-else-if="editing">
      <textarea v-model="draft" class="field-textarea" rows="16" />
      <div class="aip-actions">
        <button class="btn btn-ghost btn-sm" @click="editing = false">取消</button>
        <button class="btn btn-primary btn-sm" @click="saveEdit">保存</button>
      </div>
    </template>

    <div v-else class="aip-empty">
      <AppIcon name="sparkles" :size="26" />
      <p>还没有 AI 详解。生成后可编辑保存，训练时会展示在动作详情里。</p>
    </div>
  </div>
  <div v-else class="aip-none">在表格中选中一个动作</div>
</template>

<style scoped>
.aip {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.aip-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.aip-head h4 {
  font-size: 15px;
  font-weight: 800;
}
.aip-meta {
  margin-top: -6px;
}
.aip-content {
  background: var(--bg-elev-1);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 12px 14px;
}
.aip-actions {
  display: flex;
  gap: 8px;
}
.aip-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--text-3);
  text-align: center;
  padding: 40px 20px;
  font-size: 13px;
  line-height: 1.6;
}
.aip-empty svg {
  color: var(--accent);
}
.aip-none {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-3);
  font-size: 13px;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
