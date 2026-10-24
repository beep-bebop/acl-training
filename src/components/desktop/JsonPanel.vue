<script setup>
// JSON 面板：CodeMirror 6（懒加载），查看/编辑选中计划子树或全部目录，校验后应用
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import SegmentedControl from '../ui/SegmentedControl.vue';
import AppIcon from '../ui/AppIcon.vue';
import { useCatalogStore } from '../../stores/catalog.js';
import { useUiStore } from '../../stores/ui.js';
import { normalizeCatalog, validateCatalog } from '../../core/schema.js';
import { migrateCatalogInput } from '../../core/migration.js';

const props = defineProps({ planId: { type: String, default: null } });

const catalog = useCatalogStore();
const ui = useUiStore();

const SCOPE_OPTIONS = [
  { value: 'plan', label: '当前计划' },
  { value: 'all', label: '全部目录' }
];
const scope = ref('plan');

const host = ref(null);
const editor = shallowRef(null);
let EditorView = null;
let loaded = false;
let applying = false;

const scopeData = computed(() => {
  if (scope.value === 'plan' && props.planId) {
    const found = catalog.findPlan(props.planId);
    return found ? { planGroups: [{ ...found.group, plans: [{ ...found.plan }] }] } : { planGroups: [] };
  }
  return { planGroups: catalog.planGroups };
});

function docText() {
  return JSON.stringify(scopeData.value, null, 2);
}

onMounted(async () => {
  const [{ EditorView: EV, basicSetup }, { json }] = await Promise.all([import('codemirror'), import('@codemirror/lang-json')]);
  EditorView = EV;
  loaded = true;
  await nextTick();
  if (!host.value) return;
  editor.value = new EditorView({
    doc: docText(),
    extensions: [basicSetup, json(), EditorView.lineWrapping],
    parent: host.value
  });
});

// 数据变化（且非自身应用引起）→ 刷新编辑器内容
// 用 store.$subscribe 监听任何目录变更（比 deep watch 更可靠），叠加 scope/planId 切换
function refreshDoc() {
  if (!loaded || applying || !editor.value) return;
  const text = docText();
  if (editor.value.state.doc.toString() !== text) {
    editor.value.dispatch({
      changes: { from: 0, to: editor.value.state.doc.length, insert: text }
    });
  }
}
watch([scope, () => props.planId], () => refreshDoc());
onMounted(() => {
  catalog.$subscribe(() => refreshDoc(), { detached: true });
});

onBeforeUnmount(() => editor.value?.destroy());

const error = ref('');
async function applyJson() {
  if (!editor.value) return;
  error.value = '';
  let data;
  try {
    data = JSON.parse(editor.value.state.doc.toString());
  } catch (e) {
    error.value = `JSON 语法错误：${e.message}`;
    return;
  }
  const incoming = migrateCatalogInput(data) || normalizeCatalog(data);
  const valid = validateCatalog(incoming);
  if (!valid.ok) {
    error.value = `校验失败：${valid.msg}`;
    return;
  }

  if (scope.value === 'plan') {
    // 当前计划范围：合并该计划所在分组
    const group = incoming.planGroups[0];
    if (!group || !group.plans.length) {
      error.value = '内容为空：缺少计划';
      return;
    }
    const ok = await ui.confirmAsync({ title: '应用当前计划的修改？', body: '该计划将被 JSON 内容覆盖。', confirmText: '应用' });
    if (!ok) return;
    applying = true;
    catalog.importCatalog(incoming, 'merge');
    applying = false;
    ui.toast('当前计划已更新', 'success');
  } else {
    const ok = await ui.confirmAsync({
      title: '用 JSON 替换整个动作库？',
      body: `共 ${incoming.planGroups.length} 个阶段 / ${incoming.planGroups.reduce((s, g) => s + g.plans.length, 0)} 个计划，将完全替换现有目录。`,
      confirmText: '替换',
      danger: true
    });
    if (!ok) return;
    applying = true;
    catalog.hydrate(incoming);
    applying = false;
    ui.toast('动作库已替换', 'success');
  }
}

async function copyJson() {
  if (!editor.value) return;
  try {
    await navigator.clipboard.writeText(editor.value.state.doc.toString());
    ui.toast('已复制', 'success');
  } catch {
    ui.toast('复制失败', 'error');
  }
}
</script>

<template>
  <div class="jp">
    <div class="jp-toolbar">
      <SegmentedControl v-model="scope" :options="SCOPE_OPTIONS" />
      <button class="icon-btn" title="复制" style="width: 34px; height: 34px" @click="copyJson">
        <AppIcon name="copy" :size="15" />
      </button>
    </div>
    <div ref="host" class="jp-editor" />
    <div class="jp-foot">
      <div v-if="error" class="jp-error">{{ error }}</div>
      <button class="btn btn-primary btn-block" @click="applyJson">校验并应用</button>
      <p class="t-mini" style="text-align: center">左侧表格的修改会实时同步到这里；编辑 JSON 后点应用写回</p>
    </div>
  </div>
</template>

<style scoped>
.jp {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.jp-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 0;
}
.jp-toolbar :deep(.segmented) {
  flex: 1;
}
.jp-editor {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  margin: 12px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--bg-elev-1);
}
.jp-editor :deep(.cm-editor) {
  height: 100%;
  font-size: 12.5px;
}
.jp-editor :deep(.cm-scroller) {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
}
.jp-editor :deep(.cm-gutters) {
  background: var(--bg-elev-1);
  border-right: 1px solid var(--border);
  color: var(--text-3);
}
.jp-foot {
  padding: 0 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.jp-error {
  font-size: 12.5px;
  color: var(--danger);
  background: var(--danger-dim);
  border-radius: var(--r-sm);
  padding: 8px 10px;
}
</style>
