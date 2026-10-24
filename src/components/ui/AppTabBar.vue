<script setup>
import { useRoute } from 'vue-router';
import AppIcon from './AppIcon.vue';

const route = useRoute();
const TABS = [
  { key: 'today', label: '今日', icon: 'today', to: '/' },
  { key: 'library', label: '计划', icon: 'library', to: '/library' },
  { key: 'progress', label: '数据', icon: 'chart', to: '/progress' },
  { key: 'settings', label: '我的', icon: 'me', to: '/settings' }
];
</script>

<template>
  <nav class="tabbar" aria-label="主导航">
    <router-link v-for="tab in TABS" :key="tab.key" :to="tab.to" class="tab-item" :class="{ active: route.meta.tab === tab.key }">
      <AppIcon :name="tab.icon" :size="23" />
      <span>{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  display: flex;
  padding: 6px 8px calc(6px + var(--sab));
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-top: 1px solid var(--border);
  z-index: 40;
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 0 4px;
  border-radius: var(--r-md);
  color: var(--text-3);
  font-size: 10.5px;
  font-weight: 600;
  text-decoration: none;
  transition: color var(--dur-fast) ease;
}
.tab-item.active {
  color: var(--accent);
}
.tab-item:active {
  transform: scale(0.94);
}
</style>
