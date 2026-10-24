<script setup>
// 桌面动作工作台：左树导航 / 中编辑区 / 右侧面板（处方表单 · JSON · AI）
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppIcon from '../components/ui/AppIcon.vue';
import BottomSheet from '../components/ui/BottomSheet.vue';
import ImportSheet from '../components/ui/ImportSheet.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import TreeNav from '../components/desktop/TreeNav.vue';
import ExerciseTable from '../components/desktop/ExerciseTable.vue';
import RightPanel from '../components/desktop/RightPanel.vue';
import ExportSheet from '../components/desktop/ExportSheet.vue';
import { useCatalogStore } from '../stores/catalog.js';
import { useUiStore } from '../stores/ui.js';
import { SCHEMA_VERSION } from '../core/schema.js';
import { downloadJson, copyText } from '../utils/export.js';

const router = useRouter();
const catalog = useCatalogStore();
const ui = useUiStore();

const isWide = ref(true);
onMounted(() => {
  isWide.value = window.matchMedia('(min-width: 1024px)').matches;
});

// ---------- 选择状态 ----------
const sel = reactive({ planId: null, moduleId: null, exerciseId: null });
const selectedPlan = computed(() => catalog.findPlan(sel.planId)?.plan || null);
const selectedGroup = computed(() => catalog.findPlan(sel.planId)?.group || null);
const selectedModule = computed(() => (sel.moduleId ? catalog.findModule(sel.moduleId)?.module : null));

function selectPlan(planId) {
  sel.planId = planId;
  const plan = catalog.findPlan(planId)?.plan;
  sel.moduleId = plan?.modules?.[0]?.id || null;
  sel.exerciseId = plan?.modules?.[0]?.exercises?.[0]?.id || null;
}
function selectModule(moduleId) {
  sel.moduleId = moduleId;
  const mod = catalog.findModule(moduleId)?.module;
  sel.exerciseId = mod?.exercises?.[0]?.id || null;
}
function selectExercise(exerciseId) {
  sel.exerciseId = exerciseId;
}

// 默认选中第一个计划
if (catalog.flatPlans.length) {
  selectPlan(catalog.flatPlans[0].id);
}

// ---------- 计划级 coaching ----------
const coachingForm = reactive({ objective: '', frequency: '', progressionRule: '', safetyRule: '', readinessCriteria: [] });
const coachingDirty = ref(false);
function syncCoachingForm() {
  const c = selectedPlan.value?.coaching || {};
  coachingForm.objective = c.objective || '';
  coachingForm.frequency = c.frequency || '';
  coachingForm.progressionRule = c.progressionRule || '';
  coachingForm.safetyRule = c.safetyRule || '';
  coachingForm.readinessCriteria = [...(c.readinessCriteria || [])];
  coachingDirty.value = false;
}
syncCoachingForm();
function onCoachingInput() {
  coachingDirty.value = true;
}
function saveCoaching() {
  catalog.updatePlan(sel.planId, { coaching: { ...coachingForm, readinessCriteria: coachingForm.readinessCriteria.filter(Boolean) } });
  coachingDirty.value = false;
  ui.toast('计划处方已保存', 'success');
}

// ---------- 导入导出 ----------
const importOpen = ref(false);
const exportOpen = ref(false);
</script>

<template>
  <!-- 窄屏提示 -->
  <div v-if="!isWide" class="app-page">
    <EmptyState icon="braces" title="工作台需要桌面端" desc="动作库的结构化编辑、JSON 同步与批量操作请在 ≥1024px 宽度的屏幕上使用">
      <button class="btn btn-primary" @click="router.push('/')">返回应用</button>
    </EmptyState>
  </div>

  <div v-else class="wb">
    <!-- 顶栏 -->
    <header class="wb-top">
      <div class="wb-brand">
        <AppIcon name="braces" :size="18" />
        <span>动作工作台</span>
      </div>
      <div v-if="selectedPlan" class="wb-crumb">
        {{ selectedGroup?.name }} <AppIcon name="chevron-right" :size="13" /> {{ selectedPlan?.name }}
        <template v-if="selectedModule">
          <AppIcon name="chevron-right" :size="13" /> {{ selectedModule.name }}
        </template>
      </div>
      <div class="wb-top-actions">
        <button class="btn btn-sm btn-ghost" @click="importOpen = true">
          <AppIcon name="upload" :size="15" /> 导入
        </button>
        <button class="btn btn-sm btn-ghost" @click="exportOpen = true">
          <AppIcon name="download" :size="15" /> 导出
        </button>
        <router-link class="btn btn-sm btn-soft" to="/">回到应用</router-link>
      </div>
    </header>

    <!-- 主体三栏 -->
    <div class="wb-body">
      <TreeNav :selected-plan-id="sel.planId" :selected-module-id="sel.moduleId" @select-plan="selectPlan" @select-module="selectModule" />

      <main class="wb-main">
        <template v-if="selectedPlan">
          <!-- 计划处方 -->
          <section class="wb-card">
            <div class="wb-card-head">
              <h3>计划处方 · {{ selectedPlan.name }}</h3>
              <button v-if="coachingDirty" class="btn btn-sm btn-primary" @click="saveCoaching">保存</button>
            </div>
            <div class="coach-grid">
              <label class="field">
                <span class="field-label">训练目标</span>
                <textarea :value="coachingForm.objective" rows="2" class="field-textarea" @input="coachingForm.objective = $event.target.value; onCoachingInput()" />
              </label>
              <label class="field">
                <span class="field-label">频率</span>
                <textarea :value="coachingForm.frequency" rows="2" class="field-textarea" @input="coachingForm.frequency = $event.target.value; onCoachingInput()" />
              </label>
              <label class="field">
                <span class="field-label">进阶规则</span>
                <textarea :value="coachingForm.progressionRule" rows="2" class="field-textarea" @input="coachingForm.progressionRule = $event.target.value; onCoachingInput()" />
              </label>
              <label class="field">
                <span class="field-label">安全边界</span>
                <textarea :value="coachingForm.safetyRule" rows="2" class="field-textarea" @input="coachingForm.safetyRule = $event.target.value; onCoachingInput()" />
              </label>
            </div>
            <div class="field">
              <span class="field-label">开始前确认（每行一条）</span>
              <textarea
                :value="coachingForm.readinessCriteria.join('\n')"
                rows="2"
                class="field-textarea"
                @input="coachingForm.readinessCriteria = $event.target.value.split('\n'); onCoachingInput()"
              />
            </div>
          </section>

          <!-- 模块与动作 -->
          <ExerciseTable
            v-for="mod in selectedPlan.modules"
            :key="mod.id"
            :module="mod"
            :plan-id="selectedPlan.id"
            :selected="mod.id === sel.moduleId"
            :selected-exercise-id="sel.exerciseId"
            @select="selectModule(mod.id)"
            @select-exercise="selectExercise"
          />
        </template>
        <EmptyState v-else icon="library" title="选择一个计划" desc="在左侧选择阶段与计划开始编辑" />
      </main>

      <RightPanel :plan-id="sel.planId" :module-id="sel.moduleId" :exercise-id="sel.exerciseId" />
    </div>

    <ImportSheet v-model:open="importOpen" mode="catalog" />
    <ExportSheet v-model:open="exportOpen" />
  </div>
</template>

<style scoped>
.wb {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.wb-top {
  height: 52px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.wb-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  font-size: 15px;
  color: var(--accent);
}
.wb-crumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-3);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wb-top-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
  align-items: center;
}
.wb-top-actions a {
  text-decoration: none;
}
.wb-body {
  flex: 1;
  min-height: 0;
  display: flex;
}
.wb-main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 20px 22px 60px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* flex 子项禁止收缩：内容超出时撑出滚动 */
.wb-main > :deep(*) {
  flex-shrink: 0;
}
.wb-card {
  background: var(--bg-elev-1);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wb-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.wb-card-head h3 {
  font-size: 14.5px;
  font-weight: 800;
}
.coach-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
</style>
