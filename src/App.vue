<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppTabBar from './components/ui/AppTabBar.vue';
import ToastHost from './components/ui/ToastHost.vue';
import ConfirmHost from './components/ui/ConfirmHost.vue';
import AppIcon from './components/ui/AppIcon.vue';

const route = useRoute();
const showTabBar = computed(() => Boolean(route.meta.tab));

// 桌面端顶栏：引导进入动作工作台
const isWide = ref(false);
let media = null;
const showWorkbenchHint = computed(() => isWide.value && route.name !== 'workbench');
onMounted(() => {
  media = window.matchMedia('(min-width: 1024px)');
  isWide.value = media.matches;
  media.addEventListener('change', onMediaChange);
});
function onMediaChange(e) {
  isWide.value = e.matches;
}
onBeforeUnmount(() => media?.removeEventListener('change', onMediaChange));
</script>

<template>
  <div class="app-shell" :class="{ 'shell-wide': route.name === 'workbench' }">
    <router-link v-if="showWorkbenchHint" class="workbench-hint" to="/workbench">
      <AppIcon name="braces" :size="16" />
      <span>桌面模式：动作库工作台（编辑 / JSON / 导入导出）</span>
      <AppIcon name="chevron-right" :size="16" />
    </router-link>

    <div class="app-body" :class="{ 'with-hint': showWorkbenchHint }">
      <router-view v-slot="{ Component }">
        <component :is="Component" :key="route.path" />
      </router-view>
    </div>

    <AppTabBar v-if="showTabBar" />
    <ToastHost />
    <ConfirmHost />
  </div>
</template>

<style scoped>
.app-shell.shell-wide {
  max-width: none;
  border: none;
  box-shadow: none;
}
.workbench-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 12.5px;
  color: var(--accent);
  background: var(--accent-dim);
  text-decoration: none;
  flex-shrink: 0;
}
.workbench-hint span {
  color: var(--text-2);
}
.app-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
@media (max-width: 1023px) {
  .workbench-hint {
    display: none;
  }
}
</style>
