<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppTabBar from './components/ui/AppTabBar.vue';
import ToastHost from './components/ui/ToastHost.vue';
import ConfirmHost from './components/ui/ConfirmHost.vue';

const route = useRoute();
const showTabBar = computed(() => Boolean(route.meta.tab));
</script>

<template>
  <div class="app-shell" :class="{ 'shell-wide': route.name === 'workbench' }">
    <div class="app-body">
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
.app-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.app-shell.shell-wide {
  max-width: none;
  border: none;
  box-shadow: none;
}
</style>
