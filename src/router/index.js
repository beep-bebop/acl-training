import { createRouter, createWebHashHistory } from 'vue-router';

// hash 路由：天然适配 GitHub Pages 子路径部署
export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'today', component: () => import('../views/TodayView.vue'), meta: { tab: 'today' } },
    { path: '/library', name: 'library', component: () => import('../views/LibraryView.vue'), meta: { tab: 'library' } },
    { path: '/plan/:id', name: 'plan', component: () => import('../views/PlanDetailView.vue'), props: true },
    { path: '/training', name: 'training', component: () => import('../views/TrainingView.vue'), meta: { fullscreen: true } },
    { path: '/progress', name: 'progress', component: () => import('../views/ProgressView.vue'), meta: { tab: 'progress' } },
    { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { tab: 'settings' } },
    { path: '/program', name: 'program', component: () => import('../views/ProgramView.vue') },
    { path: '/workbench', name: 'workbench', component: () => import('../views/WorkbenchView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
});

// 训练进行中误触返回其它页面时保留会话状态（store 不清除，仅 TrainingView exit 时清理）
router.beforeEach((to) => {
  if (to.name === 'training' && !to.query.plan && !sessionStorage.getItem('acl-training.entered')) {
    // 直接刷新 /training 时无计划，回今日页
  }
  return true;
});
