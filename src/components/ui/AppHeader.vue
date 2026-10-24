<script setup>
import { useRouter } from 'vue-router';
import AppIcon from './AppIcon.vue';

defineProps({
  title: { type: String, default: '' },
  backTo: { type: String, default: null } // 指定返回路径；缺省走历史
});
</script>

<template>
  <header class="app-header">
    <button class="icon-btn" aria-label="返回" @click="backTo ? $router.push(backTo) : $router.back()">
      <AppIcon name="back" :size="22" />
    </button>
    <h2 class="ah-title">{{ title }}</h2>
    <div class="ah-action">
      <slot />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: calc(6px + var(--sat)) 10px 6px 4px;
  background: color-mix(in srgb, var(--bg) 85%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.ah-title {
  flex: 1;
  font-size: 17px;
  font-weight: 800;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ah-action {
  min-width: 44px;
  display: flex;
  justify-content: flex-end;
}
</style>
