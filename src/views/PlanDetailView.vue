<script setup>
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppHeader from '../components/ui/AppHeader.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import BottomSheet from '../components/ui/BottomSheet.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import ModuleSection from '../components/training/ModuleSection.vue';
import ExerciseEditSheet from '../components/training/ExerciseEditSheet.vue';
import { useCatalogStore } from '../stores/catalog.js';
import { useTrainingStore } from '../stores/training.js';
import { useUiStore } from '../stores/ui.js';
import { MODULE_TYPES, MODULE_ORDER, LOAD_KINDS } from '../core/config.js';
import { estimatePlanMinutes } from '../core/metrics.js';
import { ensurePermission } from '../services/notifications.js';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const catalog = useCatalogStore();
const training = useTrainingStore();
const ui = useUiStore();

const found = computed(() => catalog.findPlan(props.id));
const plan = computed(() => found.value?.plan);
const group = computed(() => found.value?.group);
const coachingOpen = ref(true);

const COACHING_META = [
  { key: 'objective', label: '训练目标' },
  { key: 'frequency', label: '频率' },
  { key: 'progressionRule', label: '进阶规则' },
  { key: 'safetyRule', label: '安全边界' },
  { key: 'readinessCriteria', label: '开始前确认' }
];
const coachingItems = computed(() =>
  COACHING_META
    .map(({ key, label }) => ({ key, label, value: plan.value?.coaching?.[key] }))
    .filter((item) => item.value && (Array.isArray(item.value) ? item.value.length : true))
);

const exCount = computed(() => plan.value?.modules.reduce((s, m) => s + m.exercises.length, 0) || 0);

// ---------- 训练入口 ----------
async function startTraining() {
  if (!plan.value) return;
  await ensurePermission();
  training.start(plan.value);
  router.push('/training');
}
const continueActive = computed(() => training.isActive && training.session.planId === props.id);

// ---------- 动作编辑 ----------
const editSheet = reactive({ open: false, exerciseId: null, moduleId: null });
function openEdit(exerciseId) {
  editSheet.exerciseId = exerciseId;
  editSheet.moduleId = null;
  editSheet.open = true;
}
function openAdd(moduleId) {
  editSheet.exerciseId = null;
  editSheet.moduleId = moduleId;
  editSheet.open = true;
}

// ---------- 模块编辑 ----------
const modSheet = reactive({ open: false, moduleId: null });
const modForm = reactive({ name: '', type: 'main', intent: '' });
function openModuleSheet(module) {
  modSheet.moduleId = module?.id || null;
  modSheet.open = true;
  modForm.name = module?.name || '';
  modForm.type = module?.type || 'main';
  modForm.intent = module?.intent || '';
}
async function saveModule() {
  if (!modForm.name.trim()) return;
  if (modSheet.moduleId) {
    catalog.updateModule(modSheet.moduleId, { ...modForm });
    ui.toast('已保存', 'success');
  } else {
    catalog.addModule(props.id, { ...modForm });
    ui.toast('已添加模块', 'success');
  }
  modSheet.open = false;
}
async function removeModule() {
  const ok = await ui.confirmAsync({ title: `删除模块「${modForm.name}」？`, confirmText: '删除', danger: true });
  if (!ok) return;
  catalog.removeModule(modSheet.moduleId);
  modSheet.open = false;
  ui.toast('已删除模块');
}

const TYPE_OPTIONS = MODULE_ORDER.map((t) => ({ value: t, label: MODULE_TYPES[t].label }));

function loadLabel(ex) {
  const cfg = LOAD_KINDS[ex.load?.kind];
  return cfg && ex.load.kind !== 'none' ? cfg.label : null;
}
</script>

<template>
  <div v-if="plan" class="plan-page">
    <AppHeader :title="plan.name" back-to="/library">
      <button class="icon-btn" aria-label="模块操作" @click="openModuleSheet(null)">
        <AppIcon name="plus" :size="20" />
      </button>
    </AppHeader>

    <div class="app-page no-tabbar detail-body">
      <div class="pd-hero" :style="{ '--stage': group?.color }">
        <span class="chip stage-bg stage-text">{{ group?.name }}</span>
        <h1 class="pd-name">{{ plan.name }}</h1>
        <div class="pd-meta num">
          <span>{{ plan.modules.length }} 模块</span>
          <span>{{ exCount }} 动作</span>
          <span>~{{ estimatePlanMinutes(plan) }} 分钟</span>
        </div>
      </div>

      <!-- 教练处方 -->
      <div v-if="coachingItems.length" class="card card-pad coaching">
        <button class="coaching-head tap-row" @click="coachingOpen = !coachingOpen">
          <AppIcon name="info" :size="17" />
          <span class="t-title" style="font-size: 14px">教练处方</span>
          <AppIcon name="chevron" :size="16" class="coaching-chevron" :class="{ open: coachingOpen }" />
        </button>
        <div v-if="coachingOpen" class="coaching-body">
          <div v-for="item in coachingItems" :key="item.key" class="co-item">
            <span class="co-label">{{ item.label }}</span>
            <template v-if="Array.isArray(item.value)">
              <ul class="co-list">
                <li v-for="(v, i) in item.value" :key="i">{{ v }}</li>
              </ul>
            </template>
            <p v-else class="co-text">{{ item.value }}</p>
          </div>
        </div>
      </div>

      <!-- 模块与动作 -->
      <div class="modules">
        <ModuleSection v-for="mod in plan.modules" :key="mod.id" :module="mod" mode="view">
          <div
            v-for="ex in mod.exercises"
            :key="ex.id"
            class="ex-row card tap-row"
            @click="openEdit(ex.id)"
          >
            <div class="exr-main">
              <div class="exr-name">{{ ex.name }}</div>
              <div class="exr-meta num">
                <span class="chip">{{ ex.sets }} × {{ ex.mode === 'timed' ? `${ex.duration}s` : ex.reps }}</span>
                <span v-if="loadLabel(ex)" class="chip chip-outline">{{ loadLabel(ex) }}</span>
                <span class="chip chip-outline">休 {{ ex.rest }}s</span>
              </div>
            </div>
            <AppIcon name="chevron-right" :size="16" class="exr-arrow" />
          </div>
          <button class="btn btn-ghost ex-add" @click="openAdd(mod.id)">
            <AppIcon name="plus" :size="16" /> 添加动作
          </button>
          <button class="mod-edit-link" @click="openModuleSheet(mod)">编辑模块</button>
        </ModuleSection>
      </div>
    </div>

    <!-- 开始训练 -->
    <div class="start-bar">
      <button v-if="continueActive" class="btn btn-primary start-btn" @click="router.push('/training')">
        <AppIcon name="play" :size="18" /> 继续训练
      </button>
      <button v-else class="btn btn-primary start-btn" @click="startTraining">
        <AppIcon name="play" :size="18" /> 开始训练
      </button>
    </div>

    <ExerciseEditSheet v-model:open="editSheet.open" :exercise-id="editSheet.exerciseId" :module-id="editSheet.moduleId" />

    <BottomSheet v-model="modSheet.open" :title="modSheet.moduleId ? '编辑模块' : '添加模块'">
      <div class="modform">
        <div class="field">
          <span class="field-label">模块名称</span>
          <input v-model="modForm.name" class="field-input" placeholder="如：主训练 A" />
        </div>
        <div class="field">
          <span class="field-label">类型</span>
          <select v-model="modForm.type" class="field-select">
            <option v-for="opt in TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div class="field">
          <span class="field-label">训练意图（可选）</span>
          <input v-model="modForm.intent" class="field-input" placeholder="如：为主训练建立动作状态" />
        </div>
        <button v-if="modSheet.moduleId" class="btn btn-danger btn-block" @click="removeModule">删除模块</button>
      </div>
      <template #footer>
        <button class="btn btn-ghost" @click="modSheet.open = false">取消</button>
        <button class="btn btn-primary" @click="saveModule">保存</button>
      </template>
    </BottomSheet>
  </div>

  <div v-else class="app-page">
    <AppHeader title="计划不存在" back-to="/library" />
    <EmptyState icon="warn" title="找不到该计划" desc="可能已被删除" />
  </div>
</template>

<style scoped>
.plan-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.detail-body {
  flex: 1;
  padding-bottom: 110px;
}
.pd-hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 14px;
}
.pd-name {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.pd-meta {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--text-3);
  font-weight: 600;
}
.coaching {
  margin-bottom: 14px;
}
.coaching-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  color: var(--text-2);
}
.coaching-chevron {
  margin-left: auto;
  transition: transform var(--dur-mid) ease;
}
.coaching-chevron.open {
  transform: rotate(180deg);
}
.coaching-body {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.co-label {
  font-size: 11.5px;
  font-weight: 800;
  color: var(--text-3);
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 4px;
}
.co-text {
  font-size: 13.5px;
  color: var(--text-2);
  line-height: 1.65;
}
.co-list {
  padding-left: 18px;
  font-size: 13.5px;
  color: var(--text-2);
  line-height: 1.7;
}
.modules {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ex-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 12px 14px;
}
.exr-main {
  flex: 1;
  min-width: 0;
}
.exr-name {
  font-size: 14px;
  font-weight: 650;
  margin-bottom: 6px;
}
.exr-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.exr-meta .chip {
  font-size: 11px;
  padding: 2px 8px;
}
.exr-arrow {
  color: var(--text-3);
}
.ex-add {
  border-style: dashed;
}
.mod-edit-link {
  align-self: flex-start;
  font-size: 12px;
  color: var(--text-3);
  padding: 2px 4px;
  text-decoration: underline dotted;
}
.start-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  padding: 12px 16px calc(14px + var(--sab));
  background: color-mix(in srgb, var(--bg) 85%, transparent);
  backdrop-filter: blur(16px);
  border-top: 1px solid var(--border);
  z-index: 35;
}
.start-btn {
  width: 100%;
  min-height: 52px;
  font-size: 16px;
}
.modform {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
