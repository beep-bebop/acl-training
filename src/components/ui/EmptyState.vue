<script setup>
import AppIcon from './AppIcon.vue';
defineProps({
  icon: { type: String, default: 'info' },
  title: { type: String, required: true },
  desc: { type: String, default: '' }
});
</script>

<template>
  <div class="empty">
    <div class="empty-icon">
      <AppIcon :name="icon" :size="26" />
    </div>
    <div class="empty-title">{{ title }}</div>
    <div v-if="desc" class="empty-desc">{{ desc }}</div>
    <div v-if="$slots.default" class="empty-action">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 44px 24px;
  gap: 8px;
}
.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--r-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  background: var(--bg-elev-2);
  margin-bottom: 4px;
}
.empty-title {
  font-size: 16px;
  font-weight: 700;
}
.empty-desc {
  font-size: 13px;
  color: var(--text-2);
  max-width: 260px;
  line-height: 1.6;
}
.empty-action {
  margin-top: 12px;
}
</style>
